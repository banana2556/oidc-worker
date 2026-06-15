import { TokenRecord } from './types';

let cachedKeyPair: { privateKey: CryptoKey; publicKey: CryptoKey; publicJwk: JsonWebKey } | null = null;

export async function getOrCreateKeyPair(kv: KVNamespace): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey; publicJwk: JsonWebKey }> {
  if (cachedKeyPair) return cachedKeyPair;

  const [storedPrivate, storedPublic] = await Promise.all([
    kv.get('config:jwk_private'),
    kv.get('config:jwk_public'),
  ]);

  if (storedPrivate && storedPublic) {
    const privateJwk = JSON.parse(storedPrivate);
    const publicJwk = JSON.parse(storedPublic);
    const [privateKey, publicKey] = await Promise.all([
      crypto.subtle.importKey('jwk', privateJwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['sign']),
      crypto.subtle.importKey('jwk', publicJwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify']),
    ]);
    cachedKeyPair = { privateKey, publicKey, publicJwk };
    return cachedKeyPair;
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair;

  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey) as JsonWebKey;
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey) as JsonWebKey;

  await Promise.all([
    kv.put('config:jwk_private', JSON.stringify(privateJwk)),
    kv.put('config:jwk_public', JSON.stringify(publicJwk)),
  ]);

  cachedKeyPair = { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, publicJwk };
  return cachedKeyPair!;
}

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): ArrayBuffer {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer as ArrayBuffer;
}

export async function createIdToken(
  privateKey: CryptoKey,
  payload: {
    iss: string; sub: string; aud: string; email: string; name: string;
    given_name: string; family_name: string; nonce?: string; at_hash?: string;
  }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: 'key-1' };
  const claims = {
    ...payload,
    email_verified: true,
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

export async function computeAtHash(accessToken: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken));
  return base64url(hash.slice(0, 16));
}

export async function createAccessToken(
  secret: string,
  payload: { sub: string; email: string; name: string; given_name: string; family_name: string; client_id: string; scope: string }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'at+jwt' };
  const claims = { ...payload, iat: now, exp: now + 3600 };

  const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const sigInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigInput));
  return `${sigInput}.${base64url(sig)}`;
}

export async function verifyAccessToken(token: string, secret: string): Promise<TokenRecord | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const sigInput = `${parts[0]}.${parts[1]}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

    const valid = await crypto.subtle.verify('HMAC', key, base64urlDecode(parts[2]), new TextEncoder().encode(sigInput));
    if (!valid) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      given_name: payload.given_name,
      family_name: payload.family_name,
      client_id: payload.client_id,
      scope: payload.scope,
    };
  } catch {
    return null;
  }
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

    const valid = await crypto.subtle.verify('HMAC', key, base64urlDecode(parts[2]), new TextEncoder().encode(sigInput));
    if (!valid) return false;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) diff |= viewA[i] ^ viewB[i];
  return diff === 0;
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
