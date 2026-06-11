import { Env } from '../types';

export function handleDiscovery(env: Env): Response {
  const issuer = env.ISSUER_URL;
  return new Response(JSON.stringify({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['sub', 'email', 'email_verified', 'name', 'given_name', 'family_name', 'iss', 'aud', 'exp', 'iat'],
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code'],
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
