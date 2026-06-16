# oidc-worker

Cloudflare Workers 上的輕量 OIDC Identity Provider，內建 Admin UI、Allowed Domains、OIDC Clients、登入驗證碼、Turnstile、Login page branding 與活動記錄。

## 功能特色

- **OIDC Authorization Code Flow + PKCE (S256)** — 標準 OIDC 流程，支援 ChatGPT 等第三方整合
- **JWT Access Token (HS256)** — 無需額外 KV 查詢即可驗證
- **多語系 (i18n)** — 英文、繁體中文、簡體中文，Admin UI 與登入頁皆支援
- **用戶端管理** — 每個 Client 獨立設定 Redirect URI 與允許的信箱域名
- **登入頁主題** — Glass / Modern / Minimal 三種主題，支援背景圖片輪換與自訂品牌
- **登入驗證碼** — 可設定使用次數限制的一次性驗證碼
- **Cloudflare Turnstile** — 選配的人機驗證
- **操作日誌** — 記錄所有授權與管理操作
- **自動分頁** — 表格依視窗高度自動分頁，不產生頁面滾動
- **一鍵部署** — 支援 Cloudflare Deploy Button

## 一鍵部署到 Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/grape2556/oidc-worker)

這個按鈕會把此 Worker 部署到你的 Cloudflare 帳號，並依照 `wrangler.toml` 自動建立與綁定 Worker 需要的 Cloudflare 資源，例如 `OIDC_KV` KV namespace 與 static assets。

> Cloudflare Deploy button 適用於 public GitHub/GitLab repository。如果你使用 private fork，請改用下方 CLI 部署流程。

### 部署後必填設定

部署完成後，到 Cloudflare Dashboard 的 Worker 設定頁加入下列 Variables / Secrets。

| 名稱 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| `ISSUER_URL` | Variable | Yes | 你的 IdP 公開網址，例如 `https://sso.example.com`。這個值必須和 OIDC discovery / token 裡的 issuer 一致。 |
| `ADMIN_PASSWORD` | Secret | Yes | Admin UI 登入密碼。 |
| `ADMIN_SECRET` | Secret | Yes | Admin JWT 簽章密鑰，建議使用隨機長字串。 |
| `TURNSTILE_SITE_KEY` | Variable | No | Cloudflare Turnstile site key。未設定時 Turnstile 開關會自動停用。 |
| `TURNSTILE_SECRET_KEY` | Secret | No | Cloudflare Turnstile secret key。 |

建議用這個方式產生 `ADMIN_SECRET`：

```bash
openssl rand -base64 32
```

完成後開啟：

```text
https://你的網域/admin/index.html
```

## CLI 完整部署流程

如果不使用一鍵部署按鈕，可以用 Wrangler 手動部署。

```bash
npm ci
npx wrangler login
npx wrangler kv namespace create OIDC_KV
```

把 Cloudflare 回傳的 KV namespace `id` 更新到 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "OIDC_KV"
id = "你的 KV namespace id"
```

設定必要 secrets：

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SECRET
```

如果要啟用 Turnstile：

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

並在 `wrangler.toml` 或 Cloudflare Dashboard 設定：

```toml
[vars]
ISSUER_URL = "https://你的網域"
TURNSTILE_SITE_KEY = "你的 Turnstile site key"
```

最後部署：

```bash
npm run deploy
```

## 主要端點

| 路徑 | 用途 |
| --- | --- |
| `/.well-known/openid-configuration` | OIDC discovery document |
| `/jwks.json` | JWKS public keys |
| `/authorize` | OIDC authorization endpoint |
| `/token` | OIDC token endpoint |
| `/userinfo` | OIDC userinfo endpoint |
| `/admin/index.html` | Admin UI |

## 參考

- [Cloudflare Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- [Cloudflare Workers CLI deploy guide](https://developers.cloudflare.com/workers/get-started/guide/)
