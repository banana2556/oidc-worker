import { Env } from '../types';
import { getOrCreateKeyPair } from '../crypto';

export async function handleJwks(env: Env, request: Request): Promise<Response> {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const { publicJwk } = await getOrCreateKeyPair(env.OIDC_KV);
  const cleanJwk = {
    kty: publicJwk.kty,
    n: publicJwk.n,
    e: publicJwk.e,
    kid: 'key-1',
    use: 'sig',
    alg: 'RS256',
  };
  const response = Response.json({ keys: [cleanJwk] }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });

  request.method === 'GET' && cache.put(request, response.clone());
  return response;
}
