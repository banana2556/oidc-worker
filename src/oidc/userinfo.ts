import { Env } from '../types';
import { verifyAccessToken } from '../crypto';

export async function handleUserinfo(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return Response.json({ error: 'invalid_token' }, { status: 401 });
  }

  const token = auth.slice(7);
  const record = await verifyAccessToken(token, env.ADMIN_SECRET);
  if (!record) {
    return Response.json({ error: 'invalid_token' }, { status: 401 });
  }

  return Response.json({
    sub: record.sub,
    email: record.email,
    email_verified: true,
    name: record.name,
    given_name: record.given_name,
    family_name: record.family_name,
  });
}
