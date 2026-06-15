import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import worker from '../src/index';
import { handleAdminApi } from '../src/admin/api';
import { handleAuthorizeGet, handleAuthorizePost } from '../src/oidc/authorize';
import { createAdminJwt } from '../src/crypto';

function createKv() {
  const store = new Map<string, string>();

  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(options?: { prefix?: string }) {
      const keys = Array.from(store.keys())
        .filter((name) => !options?.prefix || name.startsWith(options.prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    },
    dump(key: string) {
      return store.get(key) ?? null;
    },
  };
}

function createEnv() {
  return {
    OIDC_KV: createKv(),
    ASSETS: { fetch: async () => new Response('asset') },
    ADMIN_PASSWORD: 'admin-password',
    ADMIN_SECRET: 'admin-secret',
    ISSUER_URL: 'https://issuer.example',
  };
}

test('admin branding save persists custom theme settings and rotated backgrounds', async () => {
  const env = createEnv();
  const token = await createAdminJwt(env.ADMIN_SECRET);
  const branding = {
    title: 'Custom Login',
    icon_url: 'https://cdn.example/icon.png',
    bg_image_url: 'https://cdn.example/a.jpg\nhttps://cdn.example/b.jpg',
    bg_rotate: true,
    theme: 'minimal',
    theme_color_map: {
      'https://cdn.example/a.jpg': '#aa5500',
      'https://cdn.example/b.jpg': '#0055aa',
    },
    theme_settings: {
      modern: {
        bg_color: '#111111',
        btn_color: '#222222',
        theme_color_auto: true,
        gradient: false,
        gradient_start: '#222222',
        gradient_end: '#333333',
      },
      minimal: {
        btn_color: '#123456',
        theme_color_auto: true,
        bg_color: '#abcdef',
        border_width: 3,
        border_radius: 18,
      },
      glass: {
        opacity: 31,
        blur: 27,
        btn_color: '#fedcba',
        theme_color_auto: true,
      },
    },
    external_links: [
      { name: 'Portal', icon_url: 'https://cdn.example/portal.png', url: 'https://portal.example' },
      { name: 'Docs', icon_url: 'https://cdn.example/docs.png', url: 'https://docs.example' },
    ],
  };

  const response = await handleAdminApi(new Request('https://issuer.example/api/admin/branding', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(branding),
  }), env as any, '/api/admin/branding');

  assert.equal(response.status, 200);
  const stored = JSON.parse(env.OIDC_KV.dump('config:branding') ?? 'null');
  assert.equal(stored.bg_rotate, true);
  assert.deepEqual(stored.theme_color_map, branding.theme_color_map);
  assert.deepEqual(stored.theme_settings, branding.theme_settings);
  assert.deepEqual(stored.external_links, [branding.external_links[0]]);
});

test('authorize login page renders persisted theme settings', async () => {
  const env = createEnv();
  await env.OIDC_KV.put('config:clients', JSON.stringify([{
    client_id: 'client-id',
    client_secret_hash: 'secret-hash',
    redirect_uris: ['https://app.example/callback'],
    name: 'Example App',
    created_at: '2026-06-10T00:00:00.000Z',
  }]));
  await env.OIDC_KV.put('config:branding', JSON.stringify({
    title: 'Custom Login',
    icon_url: 'https://cdn.example/icon.png',
    bg_image_url: 'https://cdn.example/a.jpg',
    bg_rotate: false,
    theme: 'minimal',
    theme_color_map: {
      'https://cdn.example/a.jpg': '#aa5500',
    },
    theme_settings: {
      minimal: {
        btn_color: '#123456',
        theme_color_auto: true,
        bg_color: '#abcdef',
        border_width: 3,
        border_radius: 18,
      },
    },
  }));

  const response = await handleAuthorizeGet(
    new Request('https://issuer.example/authorize?client_id=client-id&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&response_type=code&scope=openid'),
    env as any,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /--theme-color:#aa5500/);
  assert.match(html, /background: var\(--theme-color\)/);
  assert.match(html, /var loginBgUrl="https:\/\/cdn\.example\/a\.jpg"/);
  assert.match(html, /var themeColorAuto=true/);
  assert.doesNotMatch(html, /function resolveAutoThemeColor/);
  assert.doesNotMatch(html, /theme-image/);
  assert.match(html, /background: #abcdef/);
  assert.match(html, /border: 3px solid/);
  assert.match(html, /border-radius: 18px/);
});

test('authorize login page renders external links below submit and sizes logo to title block', async () => {
  const env = createEnv();
  await env.OIDC_KV.put('config:clients', JSON.stringify([{
    client_id: 'client-id',
    client_secret_hash: 'secret-hash',
    redirect_uris: ['https://app.example/callback'],
    name: 'Example App',
    created_at: '2026-06-10T00:00:00.000Z',
  }]));
  await env.OIDC_KV.put('config:branding', JSON.stringify({
    title: 'Banana SSO',
    icon_url: 'https://cdn.example/logo.png',
    bg_image_url: '',
    theme: 'glass',
    external_links: [
      { name: 'Portal', icon_url: 'https://cdn.example/portal.png', url: 'https://portal.example' },
      { name: 'Support', icon_url: 'https://cdn.example/support.png', url: 'https://support.example' },
    ],
  }));

  const response = await handleAuthorizeGet(
    new Request('https://issuer.example/authorize?client_id=client-id&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&response_type=code&scope=openid'),
    env as any,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /class="brand has-logo"/);
  assert.match(html, /class="brand-icon"/);
  assert.match(html, /height:52px/);
  assert.match(html, /class="external-links"/);
  assert.match(html, /href="https:\/\/portal\.example\/"/);
  assert.match(html, /src="https:\/\/cdn\.example\/portal\.png"/);
  assert.match(html, />Portal<\/span>/);
  assert.doesNotMatch(html, /support\.example/);
  assert.doesNotMatch(html, />Support<\/span>/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /\.external-links\{[^}]*margin-top:32px/);
});

test('authorize login page prefills email from login_hint', async () => {
  const env = createEnv();
  await env.OIDC_KV.put('config:clients', JSON.stringify([{
    client_id: 'client-id',
    client_secret_hash: 'secret-hash',
    redirect_uris: ['https://app.example/callback'],
    name: 'Example App',
    created_at: '2026-06-10T00:00:00.000Z',
  }]));

  const response = await handleAuthorizeGet(
    new Request('https://issuer.example/authorize?client_id=client-id&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&response_type=code&scope=openid&login_hint=user%40example.com'),
    env as any,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<input type="email" id="email" name="email" placeholder="you@company\.com" value="user@example\.com" required autofocus>/);
});

test('authorize login page does not remember last email when login_hint is absent', async () => {
  const env = createEnv();
  await env.OIDC_KV.put('config:clients', JSON.stringify([{
    client_id: 'client-id',
    client_secret_hash: 'secret-hash',
    redirect_uris: ['https://app.example/callback'],
    name: 'Example App',
    created_at: '2026-06-10T00:00:00.000Z',
  }]));

  const response = await handleAuthorizeGet(
    new Request('https://issuer.example/authorize?client_id=client-id&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&response_type=code&scope=openid'),
    env as any,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.doesNotMatch(html, /login_email/);
  assert.doesNotMatch(html, /restoreEmail/);
  assert.doesNotMatch(html, /rememberEmail/);
});

test('authorize login page includes login code field', async () => {
  const env = createEnv();
  await env.OIDC_KV.put('config:clients', JSON.stringify([{
    client_id: 'client-id',
    client_secret_hash: 'secret-hash',
    redirect_uris: ['https://app.example/callback'],
    name: 'Example App',
    created_at: '2026-06-10T00:00:00.000Z',
  }]));

  const response = await handleAuthorizeGet(
    new Request('https://issuer.example/authorize?client_id=client-id&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&response_type=code&scope=openid'),
    env as any,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<label for="loginCode" id="lLoginCode"><\/label>/);
  assert.match(html, /<input type="password" id="loginCode" name="login_code" required autocomplete="one-time-code">/);
});

test('authorize post rejects admin password when it is not a managed login code', async () => {
  const env = createEnv();
  await env.OIDC_KV.put('config:domains', JSON.stringify(['example.com']));

  const response = await handleAuthorizePost(new Request('https://issuer.example/authorize', {
    method: 'POST',
    body: new URLSearchParams({
      email: 'user@example.com',
      login_code: 'admin-password',
      client_id: 'client-id',
      redirect_uri: 'https://app.example/callback',
      scope: 'openid profile email',
      state: 'state-value',
    }),
  }), env as any);
  const html = await response.text();
  const codes = await env.OIDC_KV.list({ prefix: 'code:' });

  assert.equal(response.status, 401);
  assert.match(html, /Invalid email or verification code/);
  assert.equal(codes.keys.length, 0);
});

test('admin can create limited and unlimited login codes', async () => {
  const env = createEnv();
  const token = await createAdminJwt(env.ADMIN_SECRET);

  const limited = await handleAdminApi(new Request('https://issuer.example/api/admin/login-codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code: 'LIMITED-1', max_uses: 3 }),
  }), env as any, '/api/admin/login-codes');
  const unlimited = await handleAdminApi(new Request('https://issuer.example/api/admin/login-codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code: 'FOREVER', max_uses: null }),
  }), env as any, '/api/admin/login-codes');
  const list = await handleAdminApi(new Request('https://issuer.example/api/admin/login-codes', {
    headers: { Authorization: `Bearer ${token}` },
  }), env as any, '/api/admin/login-codes');
  const data = await list.json() as { login_codes: Array<{ code_hash?: string; code_hint: string; max_uses: number | null; used: number }> };

  assert.equal(limited.status, 200);
  assert.equal(unlimited.status, 200);
  assert.equal(list.status, 200);
  assert.equal(data.login_codes.length, 2);
  assert.deepEqual(data.login_codes.map(c => c.max_uses), [3, null]);
  assert.equal(data.login_codes[0].used, 0);
  assert.equal(data.login_codes[0].code_hash, undefined);
  assert.match(data.login_codes[0].code_hint, /1$/);
});

test('admin login codes expose full code and auto-generate when omitted', async () => {
  const env = createEnv();
  const token = await createAdminJwt(env.ADMIN_SECRET);

  const manual = await handleAdminApi(new Request('https://issuer.example/api/admin/login-codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code: 'VISIBLE-CODE', max_uses: null }),
  }), env as any, '/api/admin/login-codes');
  const generated = await handleAdminApi(new Request('https://issuer.example/api/admin/login-codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ max_uses: 2 }),
  }), env as any, '/api/admin/login-codes');
  const manualData = await manual.json() as { login_code: { code?: string; code_hash?: string } };
  const generatedData = await generated.json() as { login_code: { code?: string; code_hash?: string } };
  const list = await handleAdminApi(new Request('https://issuer.example/api/admin/login-codes', {
    headers: { Authorization: `Bearer ${token}` },
  }), env as any, '/api/admin/login-codes');
  const data = await list.json() as { login_codes: Array<{ code?: string; code_hash?: string; max_uses: number | null }> };

  assert.equal(manual.status, 200);
  assert.equal(generated.status, 200);
  assert.equal(manualData.login_code.code, 'VISIBLE-CODE');
  assert.equal(manualData.login_code.code_hash, undefined);
  assert.match(generatedData.login_code.code || '', /^[a-f0-9]{20}$/);
  assert.equal(generatedData.login_code.code_hash, undefined);
  assert.deepEqual(data.login_codes.map(c => c.code), ['VISIBLE-CODE', generatedData.login_code.code]);
  assert.equal(data.login_codes[1].max_uses, 2);
});

test('authorize post accepts managed login code and consumes limited uses', async () => {
  const env = createEnv();
  const token = await createAdminJwt(env.ADMIN_SECRET);
  await env.OIDC_KV.put('config:domains', JSON.stringify(['example.com']));
  await handleAdminApi(new Request('https://issuer.example/api/admin/login-codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code: 'ONE-TIME', max_uses: 1 }),
  }), env as any, '/api/admin/login-codes');

  const first = await handleAuthorizePost(new Request('https://issuer.example/authorize', {
    method: 'POST',
    body: new URLSearchParams({
      email: 'user@example.com',
      login_code: 'ONE-TIME',
      client_id: 'client-id',
      redirect_uri: 'https://app.example/callback',
      scope: 'openid profile email',
      state: 'state-value',
    }),
  }), env as any);
  const second = await handleAuthorizePost(new Request('https://issuer.example/authorize', {
    method: 'POST',
    body: new URLSearchParams({
      email: 'user@example.com',
      login_code: 'ONE-TIME',
      client_id: 'client-id',
      redirect_uri: 'https://app.example/callback',
      scope: 'openid profile email',
      state: 'state-value',
    }),
  }), env as any);
  const codes = await env.OIDC_KV.list({ prefix: 'code:' });

  assert.equal(first.status, 302);
  assert.match(first.headers.get('Location') || '', /^https:\/\/app\.example\/callback\?code=/);
  assert.match(first.headers.get('Location') || '', /state=state-value/);
  assert.equal(second.status, 401);
  assert.equal(codes.keys.length, 1);
});

test('authorize login page renders Turnstile widget when configured', async () => {
  const env = createEnv();
  (env as any).TURNSTILE_SITE_KEY = 'site-key';
  (env as any).TURNSTILE_SECRET_KEY = 'secret-key';
  await env.OIDC_KV.put('config:clients', JSON.stringify([{
    client_id: 'client-id',
    client_secret_hash: 'secret-hash',
    redirect_uris: ['https://app.example/callback'],
    name: 'Example App',
    created_at: '2026-06-10T00:00:00.000Z',
  }]));

  const response = await handleAuthorizeGet(
    new Request('https://issuer.example/authorize?client_id=client-id&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&response_type=code&scope=openid'),
    env as any,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(html, /class="cf-turnstile"/);
  assert.match(html, /data-sitekey="site-key"/);
});

test('authorize post requires successful Turnstile verification when secret is configured', async () => {
  const env = createEnv();
  const token = await createAdminJwt(env.ADMIN_SECRET);
  (env as any).TURNSTILE_SITE_KEY = 'site-key';
  (env as any).TURNSTILE_SECRET_KEY = 'secret-key';
  await env.OIDC_KV.put('config:domains', JSON.stringify(['example.com']));
  await handleAdminApi(new Request('https://issuer.example/api/admin/login-codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code: 'LOGIN-CODE', max_uses: null }),
  }), env as any, '/api/admin/login-codes');

  const originalFetch = globalThis.fetch;
  let verificationCalls = 0;
  globalThis.fetch = async () => {
    verificationCalls++;
    return Response.json({ success: false });
  };

  try {
    const failed = await handleAuthorizePost(new Request('https://issuer.example/authorize', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'user@example.com',
        login_code: 'LOGIN-CODE',
        'cf-turnstile-response': 'bad-token',
        client_id: 'client-id',
        redirect_uri: 'https://app.example/callback',
      }),
    }), env as any);
    assert.equal(failed.status, 401);
    assert.equal(verificationCalls, 1);

    globalThis.fetch = async () => {
      verificationCalls++;
      return Response.json({ success: true });
    };
    const passed = await handleAuthorizePost(new Request('https://issuer.example/authorize', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'user@example.com',
        login_code: 'LOGIN-CODE',
        'cf-turnstile-response': 'good-token',
        client_id: 'client-id',
        redirect_uri: 'https://app.example/callback',
      }),
    }), env as any);
    assert.equal(passed.status, 302);
    assert.equal(verificationCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin security settings can disable Turnstile and login code globally', async () => {
  const env = createEnv();
  const token = await createAdminJwt(env.ADMIN_SECRET);
  (env as any).TURNSTILE_SITE_KEY = 'site-key';
  (env as any).TURNSTILE_SECRET_KEY = 'secret-key';
  await env.OIDC_KV.put('config:clients', JSON.stringify([{
    client_id: 'client-id',
    client_secret_hash: 'secret-hash',
    redirect_uris: ['https://app.example/callback'],
    name: 'Example App',
    created_at: '2026-06-10T00:00:00.000Z',
  }]));
  await env.OIDC_KV.put('config:domains', JSON.stringify(['example.com']));

  const saved = await handleAdminApi(new Request('https://issuer.example/api/admin/security', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ turnstile_enabled: false, login_code_enabled: false }),
  }), env as any, '/api/admin/security');
  const listed = await handleAdminApi(new Request('https://issuer.example/api/admin/security', {
    headers: { Authorization: `Bearer ${token}` },
  }), env as any, '/api/admin/security');
  const settings = await listed.json() as { security: { turnstile_enabled: boolean; login_code_enabled: boolean; turnstile_configured?: boolean } };
  const loginPage = await handleAuthorizeGet(
    new Request('https://issuer.example/authorize?client_id=client-id&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&response_type=code&scope=openid'),
    env as any,
  );
  const html = await loginPage.text();

  const originalFetch = globalThis.fetch;
  let verificationCalls = 0;
  globalThis.fetch = async () => {
    verificationCalls++;
    return Response.json({ success: false });
  };

  try {
    const posted = await handleAuthorizePost(new Request('https://issuer.example/authorize', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'user@example.com',
        client_id: 'client-id',
        redirect_uri: 'https://app.example/callback',
      }),
    }), env as any);

    assert.equal(saved.status, 200);
    assert.equal(settings.security.turnstile_enabled, false);
    assert.equal(settings.security.login_code_enabled, false);
    assert.equal(settings.security.turnstile_configured, true);
    assert.doesNotMatch(html, /class="cf-turnstile"/);
    assert.doesNotMatch(html, /name="login_code"/);
    assert.equal(posted.status, 302);
    assert.equal(verificationCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin security settings report and enforce Turnstile env availability', async () => {
  const env = createEnv();
  const token = await createAdminJwt(env.ADMIN_SECRET);

  const saved = await handleAdminApi(new Request('https://issuer.example/api/admin/security', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ turnstile_enabled: true, login_code_enabled: true }),
  }), env as any, '/api/admin/security');
  const listed = await handleAdminApi(new Request('https://issuer.example/api/admin/security', {
    headers: { Authorization: `Bearer ${token}` },
  }), env as any, '/api/admin/security');
  const savedData = await saved.json() as { security: { turnstile_enabled: boolean; login_code_enabled: boolean; turnstile_configured?: boolean } };
  const listedData = await listed.json() as { security: { turnstile_enabled: boolean; login_code_enabled: boolean; turnstile_configured?: boolean } };

  assert.equal(saved.status, 200);
  assert.equal(savedData.security.login_code_enabled, true);
  assert.equal(savedData.security.turnstile_enabled, false);
  assert.equal(savedData.security.turnstile_configured, false);
  assert.equal(listedData.security.turnstile_enabled, false);
  assert.equal(listedData.security.turnstile_configured, false);
});

test('branding UI labels button color as theme color and exposes auto checkbox', () => {
  const i18n = readFileSync('public/assets/i18n.js', 'utf8');
  const brandingPage = readFileSync('public/admin/branding.html', 'utf8');

  assert.match(i18n, /theme_btn_color: 'Theme Color'/);
  assert.match(i18n, /theme_auto: 'Auto'/);
  assert.match(i18n, /theme_btn_color: '主題色'/);
  assert.match(i18n, /theme_auto: '自動'/);
  assert.match(brandingPage, /id="s-auto"/);
  assert.match(brandingPage, /theme_color_auto/);
  assert.match(brandingPage, /theme_color_map/);
  assert.match(brandingPage, /computeThemeColorMap/);
  assert.match(brandingPage, /apiImage\('\/theme-image'/);
  assert.match(brandingPage, /disabled = auto\.checked/);
});

test('branding UI exposes single external link editor next to organization card', () => {
  const i18n = readFileSync('public/assets/i18n.js', 'utf8');
  const brandingPage = readFileSync('public/admin/branding.html', 'utf8');

  assert.match(i18n, /branding_links_title/);
  assert.match(i18n, /branding_link_name/);
  assert.match(i18n, /外部跳轉/);
  assert.match(brandingPage, /class="branding-grid"/);
  assert.match(brandingPage, /id="externalLinkName"/);
  assert.match(brandingPage, /id="externalLinkIcon"/);
  assert.match(brandingPage, /id="externalLinkUrl"/);
  assert.match(brandingPage, /loadExternalLink/);
  assert.match(brandingPage, /getExternalLinkForSave/);
  assert.match(brandingPage, /external_links/);
  assert.doesNotMatch(brandingPage, /addExternalLink/);
  assert.doesNotMatch(brandingPage, /externalLinksList/);
});

test('branding UI exposes global login security toggles beside save button', () => {
  const brandingPage = readFileSync('public/admin/branding.html', 'utf8');

  assert.match(brandingPage, /class="btn-group branding-actions"/);
  assert.match(brandingPage, /id="loginCodeEnabled"/);
  assert.match(brandingPage, /id="turnstileEnabled"/);
  assert.match(brandingPage, /loadSecurity/);
  assert.match(brandingPage, /saveSecurity/);
  assert.match(brandingPage, /\/security/);
  assert.match(brandingPage, /turnstile_configured/);
  assert.match(brandingPage, /turnstile\.disabled/);
});

test('branding theme previews render login security and external link appearance settings', () => {
  const brandingPage = readFileSync('public/admin/branding.html', 'utf8');

  assert.match(brandingPage, /loginCodePreviewEnabled/);
  assert.match(brandingPage, /turnstilePreviewEnabled/);
  assert.match(brandingPage, /updateAllPreviews\(\)/);
  assert.match(brandingPage, /Verification Code/);
  assert.match(brandingPage, /turnstile-preview/);
  assert.match(brandingPage, /\.external-links\{[^}]*margin-top:18px/);
  assert.match(brandingPage, /externalLinkForPreview/);
});

test('admin UI exposes login code management page without global security toggles', () => {
  const i18n = readFileSync('public/assets/i18n.js', 'utf8');
  const page = readFileSync('public/admin/login-codes.html', 'utf8');

  assert.match(i18n, /nav_login_codes/);
  assert.match(i18n, /login_codes_title/);
  assert.match(page, /renderSidebar\('login-codes'\)/);
  assert.match(page, /\/login-codes/);
  assert.match(page, /max_uses/);
  assert.match(page, /unlimited/);
  assert.match(i18n, /login_codes_auto_hint/);
  assert.match(i18n, /login_codes_copied/);
  assert.match(i18n, /登入驗證碼/);
  assert.doesNotMatch(page, /\/security/);
  assert.doesNotMatch(page, /id="loginCodeEnabled"/);
  assert.doesNotMatch(page, /id="turnstileEnabled"/);
  assert.doesNotMatch(page, /toggleTurnstile/);
  assert.doesNotMatch(page, /toggleLoginCode/);
  assert.match(page, /copyCode/);
  assert.match(page, /class="usage-input"/);
  assert.doesNotMatch(page, /login_codes_required/);
});

test('admin theme image proxy requires auth and fetches images for save-time color extraction', async () => {
  const env = createEnv();
  const token = await createAdminJwt(env.ADMIN_SECRET);

  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls++;
    return new Response('fake image', { headers: { 'Content-Type': 'image/png' } });
  };

  try {
    const unauthenticated = await worker.fetch(
      new Request('https://issuer.example/api/admin/theme-image?src=https%3A%2F%2Fcdn.example%2Fa.jpg'),
      env as any,
      {} as any,
    );
    assert.equal(unauthenticated.status, 401);
    assert.equal(upstreamCalls, 0);

    const allowed = await worker.fetch(
      new Request('https://issuer.example/api/admin/theme-image?src=https%3A%2F%2Fcdn.example%2Fa.jpg', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env as any,
      {} as any,
    );
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('Content-Type'), 'image/png');
    assert.equal(upstreamCalls, 1);

    const invalid = await worker.fetch(
      new Request('https://issuer.example/api/admin/theme-image?src=file%3A%2F%2F%2Fetc%2Fpasswd', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env as any,
      {} as any,
    );
    assert.equal(invalid.status, 400);
    assert.equal(upstreamCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
