import { Env, TokenRecord } from '../types';

export async function handleUserinfo(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return Response.json({ error: 'invalid_token' }, { status: 401 });
  }

  const token = auth.slice(7);
  const recordJson = await env.OIDC_KV.get(`token:${token}`);
  if (!recordJson) {
    return Response.json({ error: 'invalid_token' }, { status: 401 });
  }

  const record: TokenRecord = JSON.parse(recordJson);

  return Response.json({
    sub: record.sub,
    email: record.email,
    email_verified: true,
    name: record.name,
    given_name: record.given_name,
    family_name: record.family_name,
  });
}
