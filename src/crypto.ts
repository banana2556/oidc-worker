import { Env } from './types';

export async function getOrCreateKeyPair(kv: KVNamespace): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey; publicJwk: JsonWebKey }> {
  const storedPrivate = await kv.get('config:jwk_private');
  const storedPublic = await kv.get('config:jwk_public');

  if (storedPrivate && storedPublic) {
    const privateJwk = JSON.parse(storedPrivate);
    const publicJwk = JSON.parse(storedPublic);
    const privateKey = await crypto.subtle.importKey('jwk', privateJwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['sign']);
    const publicKey = await crypto.subtle.importKey('jwk', publicJwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify']);
    return { privateKey, publicKey, publicJwk };
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );

  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  await kv.put('config:jwk_private', JSON.stringify(privateJwk));
  await kv.put('config:jwk_public', JSON.stringify(publicJwk));

  return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, publicJwk };
}

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createIdToken(
  privateKey: CryptoKey,
  payload: {
    iss: string; sub: string; aud: string; email: string; name: string; given_name: string; family_name: string; nonce?: string;
  }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: 'key-1' };
  const claims = {
    ...payload,
    iat: now,
    exp: now + 3600,
    auth_time: now,
  };

  const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const sigInput = `${headerB64}.${payloadB64}`;

  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(sigInput));
  return `${sigInput}.${base64url(sig)}`;
}

export async function createAdminJwt(secret: string, expiresInHours = 24): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { role: 'admin', iat: now, exp: now + expiresInHours * 3600 };

  const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sigInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigInput));
  return `${sigInput}.${base64url(sig)}`;
}

export async function verifyAdminJwt(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const sigInput = `${parts[0]}.${parts[1]}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

    const sigBytes = atob(parts[2].replace(/-/g, '+').replace(/_/g, '/'));
    const sigBuf = new Uint8Array(sigBytes.length);
    for (let i = 0; i < sigBytes.length; i++) sigBuf[i] = sigBytes.charCodeAt(i);

    const valid = await crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(sigInput));
    if (!valid) return false;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function generateRandomString(length = 32): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return base64url(buf);
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
