import { Env, OIDCClient, LogEntry, BrandingConfig, LoginCode, SecuritySettings } from '../types';
import { createAdminJwt, verifyAdminJwt, generateRandomString, sha256Hex, timingSafeEqual } from '../crypto';

const DEFAULT_SECURITY: SecuritySettings = {
  turnstile_enabled: true,
  login_code_enabled: true,
};

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 300;

export async function writeLog(env: Env, entry: LogEntry): Promise<void> {
  const key = `log:${Date.now()}-${generateRandomString(4)}`;
  await env.OIDC_KV.put(key, '', { metadata: entry, expirationTtl: 604800 });
}

async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  const key = `ratelimit:admin:${ip}`;
  const val = await env.OIDC_KV.get(key);
  return val !== null && parseInt(val, 10) >= MAX_LOGIN_ATTEMPTS;
}

async function incrementRateLimit(env: Env, ip: string): Promise<void> {
  const key = `ratelimit:admin:${ip}`;
  const val = await env.OIDC_KV.get(key);
  const count = val ? parseInt(val, 10) + 1 : 1;
  await env.OIDC_KV.put(key, String(count), { expirationTtl: RATE_LIMIT_WINDOW });
}

async function clearRateLimit(env: Env, ip: string): Promise<void> {
  await env.OIDC_KV.delete(`ratelimit:admin:${ip}`);
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

async function kvListAll(kv: KVNamespace, prefix: string): Promise<KVNamespaceListResult<unknown, string>> {
  let keys: KVNamespaceListKey<unknown, string>[] = [];
  let cursor: string | undefined;
  let listComplete = false;
  while (!listComplete) {
    const result: KVNamespaceListResult<unknown, string> = cursor
      ? await kv.list({ prefix, cursor })
      : await kv.list({ prefix });
    keys = keys.concat(result.keys);
    listComplete = result.list_complete;
    cursor = (result as unknown as { cursor?: string }).cursor;
  }
  return { keys, list_complete: true, cacheStatus: null };
}

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) return true;

  const parts = lower.split('.');
  if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
    const octets = parts.map(Number);
    if (octets[0] === 127) return true;
    if (octets[0] === 10) return true;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
    if (octets[0] === 169 && octets[1] === 254) return true;
    if (octets[0] === 0) return true;
  }

  if (lower === '::1' || lower === '[::1]') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;

  return false;
}

export async function handleAdminApi(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/api/admin/login' && request.method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    if (await checkRateLimit(env, ip)) {
      return Response.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
    }

    const body = await request.json() as { password: string };
    const passwordMatch = await timingSafeEqual(body.password || '', env.ADMIN_PASSWORD);

    if (!passwordMatch) {
      await incrementRateLimit(env, ip);
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }

    await clearRateLimit(env, ip);
    const token = await createAdminJwt(env.ADMIN_SECRET);
    await writeLog(env, { action: 'admin_login', ip, timestamp: new Date().toISOString() });
    return Response.json({ token });
  }

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
      const security = normalizeSecuritySettings(body, isTurnstileConfigured(env));
      await saveSecuritySettings(env, security);
      return Response.json({ security });
    }
  }

  // --- Login Codes (individual KV keys) ---
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

      const codeHash = await sha256Hex(code);
      const existing = await env.OIDC_KV.get(`logincode:${codeHash}`);
      if (existing) {
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
      await env.OIDC_KV.put(`logincode:${codeHash}`, JSON.stringify(loginCode));
      return Response.json({ login_code: publicLoginCode(loginCode) });
    }
    if (request.method === 'DELETE') {
      const body = await request.json() as { id?: string };
      const id = String(body.id || '');
      const codes = await getLoginCodes(env);
      const target = codes.find(c => c.id === id);
      if (target) {
        await env.OIDC_KV.delete(`logincode:${target.code_hash}`);
      }
      return Response.json({ ok: true });
    }
  }

  // --- Users ---
  if (path === '/api/admin/users') {
    if (request.method === 'GET') {
      const list = await kvListAll(env.OIDC_KV, 'user:');
      const results = await Promise.all(
        list.keys.map(key => env.OIDC_KV.get(key.name).then(val => val ? JSON.parse(val) : null))
      );
      return Response.json({ users: results.filter(Boolean) });
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
      const clients = await getClientsWithDomainMigration(env);
      return Response.json({ clients: clients.map(c => ({ ...c, client_secret_hash: '***' })) });
    }
    if (request.method === 'POST') {
      const { name, redirect_uris, allowed_domains } = await request.json() as { name: string; redirect_uris: string[]; allowed_domains?: string[] };
      const clientId = generateRandomString(16);
      const clientSecret = generateRandomString(32);
      const secretHash = await sha256Hex(clientSecret);
      const newClient: OIDCClient = {
        client_id: clientId,
        client_secret_hash: secretHash,
        redirect_uris: redirect_uris || [],
        allowed_domains: normalizeDomains(allowed_domains || []),
        name: name || 'Unnamed',
        created_at: new Date().toISOString(),
      };
      const clients = await getClientsWithDomainMigration(env);
      clients.push(newClient);
      await env.OIDC_KV.put('config:clients', JSON.stringify(clients));
      return Response.json({ client_id: clientId, client_secret: clientSecret, name: newClient.name, redirect_uris: newClient.redirect_uris, allowed_domains: newClient.allowed_domains });
    }
    if (request.method === 'PUT') {
      const { client_id, name, redirect_uris, allowed_domains } = await request.json() as { client_id: string; name?: string; redirect_uris?: string[]; allowed_domains?: string[] };
      const clients = await getClientsWithDomainMigration(env);
      const idx = clients.findIndex(c => c.client_id === client_id);
      if (idx === -1) return Response.json({ error: 'Client not found' }, { status: 404 });
      if (name) clients[idx].name = name;
      if (redirect_uris) clients[idx].redirect_uris = redirect_uris;
      if (allowed_domains !== undefined) clients[idx].allowed_domains = normalizeDomains(allowed_domains);
      await env.OIDC_KV.put('config:clients', JSON.stringify(clients));
      return Response.json({ ok: true });
    }
    if (request.method === 'DELETE') {
      const { client_id } = await request.json() as { client_id: string };
      const clients = await getClientsWithDomainMigration(env);
      const filtered = clients.filter(c => c.client_id !== client_id);
      await env.OIDC_KV.put('config:clients', JSON.stringify(filtered));
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

  // --- Logs (metadata-based) ---
  if (path === '/api/admin/logs') {
    if (request.method === 'GET') {
      const list = await kvListAll(env.OIDC_KV, 'log:');
      const recentKeys = list.keys.slice(-100);
      const logs: LogEntry[] = [];
      const fallbackKeys: typeof recentKeys = [];

      for (const key of recentKeys) {
        if (key.metadata && typeof key.metadata === 'object') {
          logs.push(key.metadata as LogEntry);
        } else {
          fallbackKeys.push(key);
        }
      }

      if (fallbackKeys.length > 0) {
        const fallbackResults = await Promise.all(
          fallbackKeys.map(key => env.OIDC_KV.get(key.name).then(val => val ? JSON.parse(val) as LogEntry : null))
        );
        for (const entry of fallbackResults) {
          if (entry) logs.push(entry);
        }
      }

      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return Response.json({ logs });
    }
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function getLoginCodes(env: Env): Promise<LoginCode[]> {
  // Migrate from legacy single-blob format
  const legacyRaw = await env.OIDC_KV.get('config:login_codes');
  if (legacyRaw) {
    const legacyCodes: LoginCode[] = JSON.parse(legacyRaw);
    await Promise.all(
      legacyCodes.map(c => env.OIDC_KV.put(`logincode:${c.code_hash}`, JSON.stringify(c)))
    );
    await env.OIDC_KV.delete('config:login_codes');
  }

  const list = await kvListAll(env.OIDC_KV, 'logincode:');
  const results = await Promise.all(
    list.keys.map(key => env.OIDC_KV.get(key.name).then(val => val ? JSON.parse(val) as LoginCode : null))
  );
  return results.filter((c): c is LoginCode => c !== null);
}

function publicLoginCode(code: LoginCode): Omit<LoginCode, 'code_hash'> {
  const { code_hash: _codeHash, ...safeCode } = code;
  return safeCode;
}

export async function getSecuritySettings(env: Env): Promise<SecuritySettings> {
  const turnstileConfigured = isTurnstileConfigured(env);
  const raw = await env.OIDC_KV.get('config:security');
  if (!raw) return normalizeSecuritySettings(DEFAULT_SECURITY, turnstileConfigured);

  try {
    return normalizeSecuritySettings(JSON.parse(raw), turnstileConfigured);
  } catch {
    return normalizeSecuritySettings(DEFAULT_SECURITY, turnstileConfigured);
  }
}

async function saveSecuritySettings(env: Env, security: SecuritySettings): Promise<void> {
  await env.OIDC_KV.put('config:security', JSON.stringify({
    turnstile_enabled: security.turnstile_enabled,
    login_code_enabled: security.login_code_enabled,
  }));
}

function isTurnstileConfigured(env: Env): boolean {
  return Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}

function normalizeSecuritySettings(value: Partial<SecuritySettings>, turnstileConfigured: boolean): SecuritySettings {
  return {
    turnstile_enabled: turnstileConfigured && (typeof value.turnstile_enabled === 'boolean' ? value.turnstile_enabled : DEFAULT_SECURITY.turnstile_enabled),
    login_code_enabled: typeof value.login_code_enabled === 'boolean' ? value.login_code_enabled : DEFAULT_SECURITY.login_code_enabled,
    turnstile_configured: turnstileConfigured,
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

function normalizeDomains(domains: string[]): string[] {
  return [...new Set(domains.map(d => d.toLowerCase().trim()).filter(Boolean))];
}

async function getClientsWithDomainMigration(env: Env): Promise<OIDCClient[]> {
  const raw = await env.OIDC_KV.get('config:clients');
  const clients: OIDCClient[] = raw ? JSON.parse(raw) : [];

  const needsMigration = clients.some(c => !c.allowed_domains);
  if (!needsMigration) return clients;

  const legacyRaw = await env.OIDC_KV.get('config:domains');
  const legacyDomains: string[] = legacyRaw ? JSON.parse(legacyRaw) : [];

  for (const c of clients) {
    if (!c.allowed_domains) c.allowed_domains = [...legacyDomains];
  }
  await env.OIDC_KV.put('config:clients', JSON.stringify(clients));
  if (legacyRaw) await env.OIDC_KV.delete('config:domains');
  return clients;
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

  if (isPrivateHostname(imageUrl.hostname)) {
    return new Response('URL points to a private/internal address', { status: 403 });
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
