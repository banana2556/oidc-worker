import { Env } from '../types';
import { getOrCreateKeyPair } from '../crypto';

export async function handleJwks(env: Env): Promise<Response> {
  const { publicJwk } = await getOrCreateKeyPair(env.OIDC_KV);
  const cleanJwk = {
    kty: publicJwk.kty,
    n: publicJwk.n,
    e: publicJwk.e,
    kid: 'key-1',
    use: 'sig',
    alg: 'RS256',
  };
  return Response.json({ keys: [cleanJwk] }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
