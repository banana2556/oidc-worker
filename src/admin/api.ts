import { Env, OIDCClient, LogEntry, BrandingConfig, LoginCode, SecuritySettings } from '../types';
import { createAdminJwt, verifyAdminJwt, generateRandomString, sha256Hex } from '../crypto';

const DEFAULT_SECURITY: SecuritySettings = {
  turnstile_enabled: true,
  login_code_enabled: true,
};

export async function writeLog(env: Env, entry: LogEntry): Promise<void> {
  const key = `log:${Date.now()}-${generateRandomString(4)}`;
  await env.OIDC_KV.put(key, JSON.stringify(entry), { expirationTtl: 604800 });
}

async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const valid = await verifyAdminJwt(auth.slice(7), env.ADMIN_SECRET);
  if (!valid) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
  return null;
}

export async function handleAdminApi(request: Request, env: Env, path: string): Promise<Response> {
  // Login doesn't require auth
  if (path === '/api/admin/login' && request.method === 'POST') {
    const body = await request.json() as { password: string };
    if (body.password !== env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }
    const token = await createAdminJwt(env.ADMIN_SECRET);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    await writeLog(env, { action: 'admin_login', ip, timestamp: new Date().toISOString() });
    return Response.json({ token });
  }

  // All other endpoints require admin auth
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  if (path === '/api/admin/theme-image' && request.method === 'GET') {
    return proxyAdminThemeImage(request);
  }

  // --- Security Settings ---
  if (path === '/api/admin/security') {
    if (request.method === 'GET') {
      const security = await getSecuritySettings(env);
      return Response.json({ security });
    }
    if (request.method === 'PUT') {
      const body = await request.json() as Partial<SecuritySettings>;
      const security = normalizeSecuritySettings(body);
      await saveSecuritySettings(env, security);
      return Response.json({ security });
    }
  }

  // --- Login Codes ---
  if (path === '/api/admin/login-codes') {
    if (request.method === 'GET') {
      const codes = await getLoginCodes(env);
      return Response.json({ login_codes: codes.map(publicLoginCode) });
    }
    if (request.method === 'POST') {
      const body = await request.json() as { code?: string; max_uses?: number | null };
      const code = String(body.code || '').trim() || generateRandomString(10);

      const maxUses = normalizeMaxUses(body.max_uses);
      if (maxUses === 0) return Response.json({ error: 'Max uses must be a positive integer or null' }, { status: 400 });

      const codes = await getLoginCodes(env);
      const codeHash = await sha256Hex(code);
      if (codes.some(c => c.code_hash === codeHash)) {
        return Response.json({ error: 'Code already exists' }, { status: 409 });
      }

      const loginCode: LoginCode = {
        id: generateRandomString(12),
        code,
        code_hash: codeHash,
        code_hint: `****${code.slice(-4)}`,
        max_uses: maxUses,
        used: 0,
        created_at: new Date().toISOString(),
      };
      codes.push(loginCode);
      await saveLoginCodes(env, codes);
      return Response.json({ login_code: publicLoginCode(loginCode) });
    }
    if (request.method === 'DELETE') {
      const body = await request.json() as { id?: string };
      const id = String(body.id || '');
      const codes = await getLoginCodes(env);
      await saveLoginCodes(env, codes.filter(code => code.id !== id));
      return Response.json({ ok: true });
    }
  }

  // --- Domains ---
  if (path === '/api/admin/domains') {
    if (request.method === 'GET') {
      const raw = await env.OIDC_KV.get('config:domains');
      return Response.json({ domains: raw ? JSON.parse(raw) : [] });
    }
    if (request.method === 'POST') {
      const { domain } = await request.json() as { domain: string };
      const d = domain.toLowerCase().trim();
      if (!d) return Response.json({ error: 'Domain required' }, { status: 400 });
      const raw = await env.OIDC_KV.get('config:domains');
      const domains: string[] = raw ? JSON.parse(raw) : [];
      if (!domains.includes(d)) domains.push(d);
      await env.OIDC_KV.put('config:domains', JSON.stringify(domains));
      return Response.json({ domains });
    }
    if (request.method === 'DELETE') {
      const { domain } = await request.json() as { domain: string };
      const raw = await env.OIDC_KV.get('config:domains');
      let domains: string[] = raw ? JSON.parse(raw) : [];
      domains = domains.filter(d => d !== domain);
      await env.OIDC_KV.put('config:domains', JSON.stringify(domains));
      return Response.json({ domains });
    }
  }

  // --- Users ---
  if (path === '/api/admin/users') {
    if (request.method === 'GET') {
      const list = await env.OIDC_KV.list({ prefix: 'user:' });
      const users = [];
      for (const key of list.keys) {
        const val = await env.OIDC_KV.get(key.name);
        if (val) users.push(JSON.parse(val));
      }
      return Response.json({ users });
    }
    if (request.method === 'DELETE') {
      const { email } = await request.json() as { email: string };
      await env.OIDC_KV.delete(`user:${email}`);
      return Response.json({ ok: true });
    }
  }

  // --- Clients ---
  if (path === '/api/admin/clients') {
    if (request.method === 'GET') {
      const raw = await env.OIDC_KV.get('config:clients');
      const clients: OIDCClient[] = raw ? JSON.parse(raw) : [];
      return Response.json({ clients: clients.map(c => ({ ...c, client_secret_hash: '***' })) });
    }
    if (request.method === 'POST') {
      const { name, redirect_uris } = await request.json() as { name: string; redirect_uris: string[] };
      const clientId = generateRandomString(16);
      const clientSecret = generateRandomString(32);
      const secretHash = await sha256Hex(clientSecret);
      const newClient: OIDCClient = {
        client_id: clientId,
        client_secret_hash: secretHash,
        redirect_uris: redirect_uris || [],
        name: name || 'Unnamed',
        created_at: new Date().toISOString(),
      };
      const raw = await env.OIDC_KV.get('config:clients');
      const clients: OIDCClient[] = raw ? JSON.parse(raw) : [];
      clients.push(newClient);
      await env.OIDC_KV.put('config:clients', JSON.stringify(clients));
      return Response.json({ client_id: clientId, client_secret: clientSecret, name: newClient.name, redirect_uris: newClient.redirect_uris });
    }
    if (request.method === 'PUT') {
      const { client_id, name, redirect_uris } = await request.json() as { client_id: string; name?: string; redirect_uris?: string[] };
      const raw = await env.OIDC_KV.get('config:clients');
      const clients: OIDCClient[] = raw ? JSON.parse(raw) : [];
      const idx = clients.findIndex(c => c.client_id === client_id);
      if (idx === -1) return Response.json({ error: 'Client not found' }, { status: 404 });
      if (name) clients[idx].name = name;
      if (redirect_uris) clients[idx].redirect_uris = redirect_uris;
      await env.OIDC_KV.put('config:clients', JSON.stringify(clients));
      return Response.json({ ok: true });
    }
    if (request.method === 'DELETE') {
      const { client_id } = await request.json() as { client_id: string };
      const raw = await env.OIDC_KV.get('config:clients');
      let clients: OIDCClient[] = raw ? JSON.parse(raw) : [];
      clients = clients.filter(c => c.client_id !== client_id);
      await env.OIDC_KV.put('config:clients', JSON.stringify(clients));
      return Response.json({ ok: true });
    }
  }

  // --- Branding ---
  if (path === '/api/admin/branding') {
    if (request.method === 'GET') {
      const raw = await env.OIDC_KV.get('config:branding');
      const branding: BrandingConfig = raw ? JSON.parse(raw) : { title: 'Sign In', icon_url: '', bg_image_url: '', theme: 'glass' };
      return Response.json({ branding });
    }
    if (request.method === 'PUT') {
      const branding = await request.json() as BrandingConfig;
      if (!['modern', 'minimal', 'glass'].includes(branding.theme)) {
        return Response.json({ error: 'Invalid theme' }, { status: 400 });
      }
      await env.OIDC_KV.put('config:branding', JSON.stringify({
        title: branding.title || 'Sign In',
        icon_url: branding.icon_url || '',
        bg_image_url: branding.bg_image_url || '',
        bg_rotate: branding.bg_rotate || false,
        theme: branding.theme,
        theme_color_map: branding.theme_color_map || {},
        theme_settings: branding.theme_settings || {},
        external_links: normalizeExternalLinks(branding.external_links),
      }));
      return Response.json({ ok: true });
    }
  }

  // --- Logs ---
  if (path === '/api/admin/logs') {
    if (request.method === 'GET') {
      const list = await env.OIDC_KV.list({ prefix: 'log:' });
      const logs: LogEntry[] = [];
      const keys = list.keys.slice(-100);
      for (const key of keys) {
        const val = await env.OIDC_KV.get(key.name);
        if (val) logs.push(JSON.parse(val));
      }
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return Response.json({ logs });
    }
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

async function getLoginCodes(env: Env): Promise<LoginCode[]> {
  const raw = await env.OIDC_KV.get('config:login_codes');
  return raw ? JSON.parse(raw) : [];
}

async function saveLoginCodes(env: Env, codes: LoginCode[]): Promise<void> {
  await env.OIDC_KV.put('config:login_codes', JSON.stringify(codes));
}

function publicLoginCode(code: LoginCode): Omit<LoginCode, 'code_hash'> {
  const { code_hash: _codeHash, ...safeCode } = code;
  return safeCode;
}

export async function getSecuritySettings(env: Env): Promise<SecuritySettings> {
  const raw = await env.OIDC_KV.get('config:security');
  if (!raw) return { ...DEFAULT_SECURITY };

  try {
    return normalizeSecuritySettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SECURITY };
  }
}

async function saveSecuritySettings(env: Env, security: SecuritySettings): Promise<void> {
  await env.OIDC_KV.put('config:security', JSON.stringify(security));
}

function normalizeSecuritySettings(value: Partial<SecuritySettings>): SecuritySettings {
  return {
    turnstile_enabled: typeof value.turnstile_enabled === 'boolean' ? value.turnstile_enabled : DEFAULT_SECURITY.turnstile_enabled,
    login_code_enabled: typeof value.login_code_enabled === 'boolean' ? value.login_code_enabled : DEFAULT_SECURITY.login_code_enabled,
  };
}

function normalizeMaxUses(value: unknown): number | null | 0 {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return 0;
  return n;
}

function normalizeExternalLinks(value: unknown): BrandingConfig['external_links'] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const raw = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        name: String(raw.name || '').trim(),
        icon_url: String(raw.icon_url || '').trim(),
        url: String(raw.url || '').trim(),
      };
    })
    .filter((item) => item.name && item.url)
    .slice(0, 1);
}

async function proxyAdminThemeImage(request: Request): Promise<Response> {
  const src = new URL(request.url).searchParams.get('src') || '';
  let imageUrl: URL;
  try {
    imageUrl = new URL(src);
  } catch {
    return new Response('Invalid image URL', { status: 400 });
  }

  if (!['http:', 'https:'].includes(imageUrl.protocol)) {
    return new Response('Unsupported image URL', { status: 400 });
  }

  const upstream = await fetch(imageUrl.toString(), {
    headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8' },
  });
  if (!upstream.ok || !upstream.body) {
    return new Response('Image fetch failed', { status: 502 });
  }

  const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';
  if (!contentType.toLowerCase().startsWith('image/')) {
    return new Response('URL did not return an image', { status: 415 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
