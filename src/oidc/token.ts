import { Env, OIDCClient, AuthCode } from '../types';
import { getOrCreateKeyPair, createIdToken, generateRandomString, sha256, sha256Hex } from '../crypto';

export async function handleToken(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get('content-type') || '';
  let grantType: string, code: string, redirectUri: string, clientId: string, clientSecret: string;
  let codeVerifier: string;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    grantType = form.get('grant_type') as string || '';
    code = form.get('code') as string || '';
    redirectUri = form.get('redirect_uri') as string || '';
    clientId = form.get('client_id') as string || '';
    clientSecret = form.get('client_secret') as string || '';
    codeVerifier = form.get('code_verifier') as string || '';
  } else {
    const body = await request.json() as Record<string, string>;
    grantType = body.grant_type || '';
    code = body.code || '';
    redirectUri = body.redirect_uri || '';
    clientId = body.client_id || '';
    clientSecret = body.client_secret || '';
    codeVerifier = body.code_verifier || '';
  }

  // Support HTTP Basic auth for client credentials
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6));
    const [basicId, basicSecret] = decoded.split(':');
    if (!clientId) clientId = basicId;
    if (!clientSecret) clientSecret = basicSecret;
  }

  if (grantType !== 'authorization_code') {
    return Response.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  const clientsJson = await env.OIDC_KV.get('config:clients');
  const clients: OIDCClient[] = clientsJson ? JSON.parse(clientsJson) : [];
  const client = clients.find(c => c.client_id === clientId);

  if (!client) {
    return Response.json({ error: 'invalid_client' }, { status: 401 });
  }

  // Verify client_secret if provided (not required when using PKCE)
  if (clientSecret) {
    const secretHash = await sha256Hex(clientSecret);
    if (secretHash !== client.client_secret_hash) {
      return Response.json({ error: 'invalid_client' }, { status: 401 });
    }
  }

  const authCodeJson = await env.OIDC_KV.get(`code:${code}`);
  if (!authCodeJson) {
    return Response.json({ error: 'invalid_grant', error_description: 'Code not found or expired' }, { status: 400 });
  }

  const authCode: AuthCode = JSON.parse(authCodeJson);

  if (authCode.used) {
    return Response.json({ error: 'invalid_grant', error_description: 'Code already used' }, { status: 400 });
  }
  if (authCode.expires_at < Date.now()) {
    return Response.json({ error: 'invalid_grant', error_description: 'Code expired' }, { status: 400 });
  }
  if (authCode.client_id !== clientId) {
    return Response.json({ error: 'invalid_grant', error_description: 'Client mismatch' }, { status: 400 });
  }
  if (authCode.redirect_uri !== redirectUri) {
    return Response.json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' }, { status: 400 });
  }

  // PKCE verification
  if (authCode.code_challenge) {
    if (!codeVerifier) {
      return Response.json({ error: 'invalid_grant', error_description: 'code_verifier required' }, { status: 400 });
    }
    const computed = await sha256(codeVerifier);
    if (computed !== authCode.code_challenge) {
      return Response.json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, { status: 400 });
    }
  }

  // Mark code as used
  authCode.used = true;
  await env.OIDC_KV.put(`code:${code}`, JSON.stringify(authCode), { expirationTtl: 60 });

  // Generate tokens
  const accessToken = generateRandomString(48);
  const { privateKey } = await getOrCreateKeyPair(env.OIDC_KV);

  const userJson = await env.OIDC_KV.get(`user:${authCode.email}`);
  const user = userJson ? JSON.parse(userJson) : { sub: authCode.sub, email: authCode.email, name: authCode.email.split('@')[0], given_name: authCode.email.split('@')[0], family_name: authCode.email.split('@')[0] };

  const idToken = await createIdToken(privateKey, {
    iss: env.ISSUER_URL,
    sub: authCode.sub,
    aud: clientId,
    email: user.email,
    name: user.name,
    given_name: user.given_name,
    family_name: user.family_name,
    nonce: authCode.nonce,
  });

  await env.OIDC_KV.put(`token:${accessToken}`, JSON.stringify({
    sub: authCode.sub,
    email: user.email,
    name: user.name,
    given_name: user.given_name,
    family_name: user.family_name,
    client_id: clientId,
    scope: authCode.scope,
  }), { expirationTtl: 3600 });

  return Response.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    id_token: idToken,
    scope: authCode.scope,
  }, {
    headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' },
  });
}
