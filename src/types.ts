export interface Env {
  OIDC_KV: KVNamespace;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  ADMIN_SECRET: string;
  ISSUER_URL: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export interface OIDCClient {
  client_id: string;
  client_secret_hash: string;
  redirect_uris: string[];
  allowed_domains: string[];
  name: string;
  created_at: string;
}

export interface UserRecord {
  sub: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  created_at: string;
  last_login: string;
}

export interface AuthCode {
  client_id: string;
  email: string;
  sub: string;
  redirect_uri: string;
  scope: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  expires_at: number;
  used: boolean;
}

export interface TokenRecord {
  sub: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  client_id: string;
  scope: string;
}

export interface BrandingConfig {
  title: string;
  icon_url: string;
  bg_image_url: string;
  bg_rotate?: boolean;
  theme: 'modern' | 'minimal' | 'glass';
  theme_color_map?: Record<string, string>;
  theme_settings?: Record<string, Record<string, string | number | boolean>>;
  external_links?: ExternalLink[];
}

export interface ExternalLink {
  name: string;
  icon_url: string;
  url: string;
}

export interface LoginCode {
  id: string;
  code?: string;
  code_hash: string;
  code_hint: string;
  max_uses: number | null;
  used: number;
  created_at: string;
}

export interface SecuritySettings {
  turnstile_enabled: boolean;
  login_code_enabled: boolean;
  turnstile_configured?: boolean;
}

export interface LogEntry {
  action: string;
  email?: string;
  client_id?: string;
  ip: string;
  timestamp: string;
  detail?: string;
}
