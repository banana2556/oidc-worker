import { Env } from './types';
import { handleDiscovery } from './oidc/discovery';
import { handleJwks } from './oidc/jwks';
import { handleAuthorizeGet, handleAuthorizePost } from './oidc/authorize';
import { handleToken } from './oidc/token';
import { handleUserinfo } from './oidc/userinfo';
import { handleAdminApi } from './admin/api';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight for any path
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    let response: Response;

    try {
      // OIDC endpoints
      if (path === '/.well-known/openid-configuration') {
        response = handleDiscovery(env);
      } else if (path === '/jwks.json') {
        response = await handleJwks(env);
      } else if (path === '/authorize') {
        response = request.method === 'POST'
          ? await handleAuthorizePost(request, env)
          : await handleAuthorizeGet(request, env);
      } else if (path === '/token' && request.method === 'POST') {
        response = await handleToken(request, env);
      } else if (path === '/userinfo' && request.method === 'GET') {
        response = await handleUserinfo(request, env);
      }
      // Admin API
      else if (path.startsWith('/api/admin/')) {
        response = await handleAdminApi(request, env, path);
      }
      // Everything else falls through to static assets
      else {
        return env.ASSETS.fetch(request);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      response = Response.json({ error: message }, { status: 500 });
    }

    // Add CORS headers to API responses
    if (path.startsWith('/api/')) {
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
