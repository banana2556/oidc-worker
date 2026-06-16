import { Env, OIDCClient, UserRecord, AuthCode, BrandingConfig, LoginCode, SecuritySettings } from '../types';
import { generateRandomString, sha256Hex } from '../crypto';
import { getSecuritySettings, writeLog } from '../admin/api';

const SUPPORTED_SCOPES = new Set(['openid', 'email', 'profile']);

function validateScope(raw: string): string | null {
  const parts = raw.split(' ').filter(Boolean);
  if (!parts.includes('openid')) return null;
  return parts.filter(s => SUPPORTED_SCOPES.has(s)).join(' ');
}

export async function handleAuthorizeGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const responseType = url.searchParams.get('response_type') || '';
  const clientId = url.searchParams.get('client_id') || '';
  const redirectUri = url.searchParams.get('redirect_uri') || '';
  const rawScope = url.searchParams.get('scope') || 'openid';
  const state = url.searchParams.get('state') || '';
  const nonce = url.searchParams.get('nonce') || '';
  const codeChallenge = url.searchParams.get('code_challenge') || '';
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') || '';
  const loginHint = (url.searchParams.get('login_hint') || url.searchParams.get('email') || '').trim();

  if (responseType !== 'code') {
    return Response.json({ error: 'unsupported_response_type', error_description: 'Only response_type=code is supported' }, { status: 400 });
  }

  const scope = validateScope(rawScope);
  if (!scope) {
    return Response.json({ error: 'invalid_scope', error_description: 'scope must include openid' }, { status: 400 });
  }

  const [clientsJson, branding, security] = await Promise.all([
    env.OIDC_KV.get('config:clients'),
    getBranding(env),
    getSecuritySettings(env),
  ]);

  const clients: OIDCClient[] = clientsJson ? JSON.parse(clientsJson) : [];
  const client = clients.find(c => c.client_id === clientId);

  if (!client) {
    return Response.json({ error: 'invalid_request', error_description: 'Invalid client_id' }, { status: 400 });
  }

  if (!client.redirect_uris.includes(redirectUri)) {
    return Response.json({ error: 'invalid_request', error_description: 'Invalid redirect_uri' }, { status: 400 });
  }

  const html = renderLoginPage(
    branding,
    clientId,
    redirectUri,
    scope,
    state,
    nonce,
    codeChallenge,
    codeChallengeMethod,
    undefined,
    loginHint,
    security.login_code_enabled,
    security.turnstile_enabled ? env.TURNSTILE_SITE_KEY : undefined,
  );
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function handleAuthorizePost(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const email = (form.get('email') as string || '').toLowerCase().trim();
  const loginCode = form.get('login_code') as string || '';
  const turnstileToken = form.get('cf-turnstile-response') as string || '';
  const clientId = form.get('client_id') as string || '';
  const redirectUri = form.get('redirect_uri') as string || '';
  const scope = form.get('scope') as string || 'openid';
  const state = form.get('state') as string || '';
  const nonce = form.get('nonce') as string || '';
  const codeChallenge = form.get('code_challenge') as string || '';
  const codeChallengeMethod = form.get('code_challenge_method') as string || '';

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'invalid_request', error_description: 'Invalid email' }, { status: 400 });
  }

  const [security, branding, clientsJson] = await Promise.all([
    getSecuritySettings(env),
    getBranding(env),
    env.OIDC_KV.get('config:clients'),
  ]);
  const turnstileSiteKey = security.turnstile_enabled ? env.TURNSTILE_SITE_KEY : undefined;

  if (!await verifyTurnstile(request, env, turnstileToken, security.turnstile_enabled)) {
    const html = renderLoginPage(branding, clientId, redirectUri, scope, state, nonce, codeChallenge, codeChallengeMethod, 'Human verification failed.', email, security.login_code_enabled, turnstileSiteKey);
    return new Response(html, { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const domain = email.split('@')[1];
  const clients: OIDCClient[] = clientsJson ? JSON.parse(clientsJson) : [];
  const client = clients.find(c => c.client_id === clientId);
  const domains: string[] = client?.allowed_domains || [];

  if (!domains.includes(domain)) {
    const html = renderLoginPage(branding, clientId, redirectUri, scope, state, nonce, codeChallenge, codeChallengeMethod, `Domain "${domain}" is not allowed.`, email, security.login_code_enabled, turnstileSiteKey);
    return new Response(html, { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (security.login_code_enabled && !await consumeLoginCode(env, loginCode)) {
    const html = renderLoginPage(branding, clientId, redirectUri, scope, state, nonce, codeChallenge, codeChallengeMethod, 'Invalid email or verification code.', email, true, turnstileSiteKey);
    return new Response(html, { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  let user: UserRecord;
  const existingUser = await env.OIDC_KV.get(`user:${email}`);
  if (existingUser) {
    user = JSON.parse(existingUser);
    user.last_login = new Date().toISOString();
  } else {
    const localPart = email.split('@')[0];
    user = {
      sub: crypto.randomUUID(),
      email,
      name: `User ${localPart}`,
      given_name: 'User',
      family_name: localPart,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    };
  }
  await env.OIDC_KV.put(`user:${email}`, JSON.stringify(user));

  const code = generateRandomString(32);
  const authCode: AuthCode = {
    client_id: clientId,
    email: user.email,
    sub: user.sub,
    redirect_uri: redirectUri,
    scope,
    nonce: nonce || undefined,
    code_challenge: codeChallenge || undefined,
    code_challenge_method: codeChallengeMethod || undefined,
    expires_at: Date.now() + 600_000,
    used: false,
  };
  await env.OIDC_KV.put(`code:${code}`, JSON.stringify(authCode), { expirationTtl: 600 });

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  await writeLog(env, { action: 'authorize', email, client_id: clientId, ip, timestamp: new Date().toISOString() });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  return Response.redirect(redirectUrl.toString(), 302);
}

async function getBranding(env: Env): Promise<BrandingConfig> {
  const raw = await env.OIDC_KV.get('config:branding');
  if (raw) return JSON.parse(raw);
  return { title: 'Sign In', icon_url: '', bg_image_url: '', theme: 'glass' };
}

async function consumeLoginCode(env: Env, submittedCode: string): Promise<boolean> {
  const code = submittedCode.trim();
  if (!code) return false;

  const codeHash = await sha256Hex(code);
  const raw = await env.OIDC_KV.get(`logincode:${codeHash}`);
  if (!raw) return false;

  const match: LoginCode = JSON.parse(raw);
  if (match.max_uses !== null && match.used >= match.max_uses) return false;

  match.used += 1;
  await env.OIDC_KV.put(`logincode:${codeHash}`, JSON.stringify(match));
  return true;
}

async function verifyTurnstile(request: Request, env: Env, token: string, enabled: boolean): Promise<boolean> {
  if (!enabled || !env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) body.set('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return false;

  const data = await res.json() as { success?: boolean };
  return data.success === true;
}

function renderLoginPage(
  branding: BrandingConfig,
  clientId: string, redirectUri: string, scope: string, state: string, nonce: string,
  codeChallenge: string, codeChallengeMethod: string,
  error?: string,
  emailHint?: string,
  loginCodeEnabled = true,
  turnstileSiteKey?: string
): string {
  const ts = branding.theme_settings || {};
  const ms = ts.modern || {} as Record<string, string | number | boolean>;
  const mis = ts.minimal || {} as Record<string, string | number | boolean>;
  const gs = ts.glass || {} as Record<string, string | number | boolean>;
  const glassOp = ((Number(gs.opacity) || 15) / 100).toFixed(2);
  const glassBlur = Number(gs.blur) || 20;
  const glassBtnBlur = Math.min(glassBlur + 10, 48);
  const modernBtnColor = (ms.btn_color as string) || (ms.gradient_start as string) || '#8A6B52';
  const modernGradient = ms.gradient !== undefined ? ms.gradient : true;
  const modernBtnBg = modernGradient
    ? `linear-gradient(135deg, ${modernBtnColor}, ${ms.gradient_end || '#768D6A'})`
    : modernBtnColor;
  const modernBgHex = (ms.bg_color as string) || '#1e1a15';
  const mBgR = parseInt(modernBgHex.slice(1, 3), 16) || 30;
  const mBgG = parseInt(modernBgHex.slice(3, 5), 16) || 26;
  const mBgB = parseInt(modernBgHex.slice(5, 7), 16) || 21;
  const minBw = mis.border_width != null ? Number(mis.border_width) : 1;
  const minBr = mis.border_radius != null ? Number(mis.border_radius) : 8;
  const minBtnR = Math.max(minBr - 2, 4);
  const minBtnHex = (mis.btn_color as string) || '#111111';
  const minBgColor = (mis.bg_color as string) || '#ffffff';
  const glassBtnHex = (gs.btn_color as string) || '#ffffff';
  const activeSettings = (branding.theme === 'modern' ? ms : branding.theme === 'minimal' ? mis : gs);
  const themeColorAuto = activeSettings.theme_color_auto === true;
  const fallbackThemeColor = normalizeHexColor(
    branding.theme === 'modern' ? modernBtnColor : branding.theme === 'minimal' ? minBtnHex : glassBtnHex,
    '#111111',
  );

  const themes: Record<string, { card: string; bg: string; btn: string; input: string; text: string; focus: string }> = {
    modern: {
      bg: (ms.bg_color as string) || '#1e1a15',
      card: `background: rgba(${mBgR},${mBgG},${mBgB},0.85); border: 1px solid rgba(var(--theme-color-rgb),0.3); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); padding: 48px 40px;`,
      btn: `background: ${modernBtnBg.replace(modernBtnColor, 'var(--theme-color)')}; color: #fff; border: none; border-radius: 12px; padding: 14px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; width: 100%;`,
      input: 'background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 14px 16px; color: #f0e8df; font-size: 15px; width: 100%; box-sizing: border-box; outline: none; transition: border 0.3s;',
      text: 'color: #f0e8df;',
      focus: 'var(--theme-color-focus)',
    },
    minimal: {
      bg: '#f5f5f5',
      card: `background: ${minBgColor}; border: ${minBw}px solid rgba(var(--theme-color-rgb),0.35); border-radius: ${minBr}px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 48px 40px;`,
      btn: `background: var(--theme-color); color: #fff; border: none; border-radius: ${minBtnR}px; padding: 14px; font-size: 15px; font-weight: 500; cursor: pointer; width: 100%; transition: background 0.2s;`,
      input: `background: #fff; border: ${minBw}px solid rgba(var(--theme-color-rgb),0.4); border-radius: ${minBtnR}px; padding: 14px 16px; color: #111; font-size: 15px; width: 100%; box-sizing: border-box; outline: none;`,
      text: 'color: #333;',
      focus: 'var(--theme-color-focus)',
    },
    glass: {
      bg: 'linear-gradient(135deg, #0ea5e9, #8b5cf6, #ec4899)',
      card: `background: rgba(255,255,255,${glassOp}); backdrop-filter: blur(${glassBlur}px) saturate(180%); -webkit-backdrop-filter: blur(${glassBlur}px) saturate(180%); border: 1px solid rgba(255,255,255,0.3); border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); padding: 48px 40px;`,
      btn: `background: rgba(var(--theme-color-rgb),0.25); backdrop-filter: blur(${glassBtnBlur}px); border: 1px solid rgba(var(--theme-color-rgb),0.4); border-radius: 14px; padding: 14px; font-size: 16px; font-weight: 600; color: #fff; cursor: pointer; width: 100%; transition: all 0.3s;`,
      input: `background: rgba(255,255,255,${glassOp}); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 12px; padding: 14px 16px; color: #fff; font-size: 15px; width: 100%; box-sizing: border-box; outline: none;`,
      text: 'color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.25);',
      focus: 'var(--theme-color-focus)',
    },
  };

  const t = themes[branding.theme] || themes.glass;
  let bgUrl = branding.bg_image_url;
  if (branding.bg_rotate && bgUrl) {
    const urls = bgUrl.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length > 0) {
      bgUrl = urls[Math.floor(Math.random() * urls.length)];
    }
  }
  const bgStyle = bgUrl
    ? `background: url('${bgUrl}') center/cover fixed no-repeat`
    : `background: ${t.bg}`;
  const storedThemeColor = bgUrl ? branding.theme_color_map?.[bgUrl] : undefined;
  const selectedThemeColor = normalizeHexColor(
    themeColorAuto && storedThemeColor ? storedThemeColor : fallbackThemeColor,
    fallbackThemeColor,
  );
  const selectedThemeRgb = parseHexColor(selectedThemeColor, [17, 17, 17]).join(',');

  const i18n: Record<string, Record<string, string>> = {
    en: {
      subtitle: loginCodeEnabled ? 'Enter your email and verification code to continue' : 'Enter your email to continue',
      email: 'Email Address',
      code: 'Verification Code',
      btn: 'Continue',
      toggle: '繁中',
    },
    zh: {
      subtitle: loginCodeEnabled ? '請輸入電子信箱與驗證碼以繼續' : '請輸入電子信箱以繼續',
      email: '電子信箱',
      code: '驗證碼',
      btn: '繼續',
      toggle: '简中',
    },
    zh_cn: {
      subtitle: loginCodeEnabled ? '请输入电子邮箱与验证码以继续' : '请输入电子邮箱以继续',
      email: '电子邮箱',
      code: '验证码',
      btn: '继续',
      toggle: 'EN',
    },
  };
  const emailValueAttr = emailHint ? ` value="${escapeHtml(emailHint)}"` : '';
  const turnstileScript = turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '';
  const turnstileWidget = turnstileSiteKey
    ? `<div class="turnstile-wrap"><div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey)}"></div></div>`
    : '';
  const loginCodeField = loginCodeEnabled
    ? `<label for="loginCode" id="lLoginCode"></label>
<input type="password" id="loginCode" name="login_code" required autocomplete="one-time-code">`
    : '';
  const externalLinks = (branding.external_links || []).slice(0, 1)
    .map((link) => ({
      name: String(link.name || '').trim(),
      icon_url: String(link.icon_url || '').trim(),
      url: normalizeExternalUrl(link.url),
    }))
    .filter((link): link is { name: string; icon_url: string; url: string } => Boolean(link.name && link.url));
  const externalLinksHtml = externalLinks.length
    ? `<div class="external-links">${externalLinks.map((link) => `
<a class="external-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
${link.icon_url ? `<img class="external-link-icon" src="${escapeHtml(link.icon_url)}" alt="">` : '<span class="external-link-icon external-link-fallback"></span>'}
<span>${escapeHtml(link.name)}</span>
</a>`).join('')}
</div>`
    : '';
  const brandClass = branding.icon_url ? 'brand has-logo' : 'brand';
  const brandIconHtml = branding.icon_url ? `<img class="brand-icon" src="${escapeHtml(branding.icon_url)}" alt="">` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/favicon.png" type="image/png">
<title>${escapeHtml(branding.title)}</title>
${turnstileScript}
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--theme-color:${selectedThemeColor};--theme-color-rgb:${selectedThemeRgb};--theme-color-focus:rgba(${selectedThemeRgb},0.6)}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;${bgStyle}}
.card{${t.card};max-width:420px;width:90vw;position:relative}
.lang-toggle{position:absolute;top:16px;right:16px;background:none;border:1px solid rgba(128,128,128,0.3);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;${t.text};opacity:0.7;transition:opacity .2s;min-width:68px;text-align:center}
.lang-toggle:hover{opacity:1}
.brand{margin-bottom:32px;padding-right:72px}
.brand.has-logo{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:12px;row-gap:6px;align-items:start}
.brand-icon{grid-row:1 / span 2;height:52px;width:auto;max-width:96px;border-radius:8px;object-fit:contain}
h1{font-size:24px;${t.text};margin:0}
.subtitle{font-size:14px;line-height:1.4;margin:8px 0 0;opacity:0.7;${t.text}}
.brand.has-logo .subtitle{grid-column:2;margin-top:0}
label{display:block;font-size:13px;font-weight:500;margin-bottom:6px;${t.text}}
input[type=email],input[type=text],input[type=password]{${t.input};margin-bottom:16px}
input:focus{border-color:${t.focus}}
input::placeholder{opacity:0.5}
.turnstile-wrap{margin:4px 0 12px}
button[type=submit]{${t.btn};margin-top:8px}
button[type=submit]:hover{opacity:0.9;transform:translateY(-1px)}
.external-links{display:flex;justify-content:center;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-top:32px}
.external-link{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:92px;text-align:center;text-decoration:none;font-size:12px;line-height:1.25;${t.text};opacity:0.86;transition:opacity .2s,transform .2s}
.external-link:hover{opacity:1;transform:translateY(-1px)}
.external-link-icon{width:44px;height:44px;border-radius:999px;object-fit:cover;background:rgba(255,255,255,0.16);border:1px solid rgba(var(--theme-color-rgb),0.35);box-shadow:0 4px 14px rgba(0,0,0,0.16)}
.external-link-fallback{display:block}
.error{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;margin-bottom:20px;color:#fca5a5;font-size:14px}
</style>
</head>
<body>
<div class="card">
<button class="lang-toggle" onclick="toggleLang()" id="langBtn"></button>
<div class="${brandClass}">${brandIconHtml}<h1>${escapeHtml(branding.title)}</h1>
<p class="subtitle" id="subtitle"></p>
</div>
${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
<form method="POST" action="/authorize">
<input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
<input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
<input type="hidden" name="scope" value="${escapeHtml(scope)}">
<input type="hidden" name="state" value="${escapeHtml(state)}">
<input type="hidden" name="nonce" value="${escapeHtml(nonce)}">
<input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
<input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">
<label for="email" id="lEmail"></label>
<input type="email" id="email" name="email" placeholder="you@company.com"${emailValueAttr} required autofocus>
${loginCodeField}
${turnstileWidget}
<button type="submit" id="submitBtn"></button>
${externalLinksHtml}
</form>
</div>
<script>
var loginBgUrl=${JSON.stringify(bgUrl || '')};
var themeColorAuto=${themeColorAuto ? 'true' : 'false'};
var i18n=${JSON.stringify(i18n)};
function getLang(){return localStorage.getItem('login_lang')||'en'}
function setLang(l){localStorage.setItem('login_lang',l);applyLang()}
function toggleLang(){var c=getLang();setLang(c==='en'?'zh':c==='zh'?'zh_cn':'en')}
function applyLang(){
  var l=i18n[getLang()]||i18n.en;
  document.getElementById('subtitle').textContent=l.subtitle;
  document.getElementById('lEmail').textContent=l.email;
  var loginCodeLabel=document.getElementById('lLoginCode');
  if(loginCodeLabel) loginCodeLabel.textContent=l.code;
  document.getElementById('submitBtn').textContent=l.btn;
  document.getElementById('langBtn').textContent=l.toggle;
}
applyLang();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseHexColor(hex: string, fallback: [number, number, number]): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return fallback;
  }

  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function normalizeHexColor(hex: unknown, fallback: string): string {
  if (typeof hex !== 'string') {
    return fallback;
  }

  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : fallback;
}
