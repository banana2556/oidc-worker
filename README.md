# oidc-worker

跑在 Cloudflare Workers 上的 OIDC Identity Provider。

不需要伺服器、不需要資料庫，一個 Worker + KV 就是一套完整的 SSO。

## 為什麼用這個

| | oidc-worker | Auth0 / Okta | Keycloak / Dex |
|---|---|---|---|
| 基礎設施 | 零 — 跑在 Cloudflare Edge | SaaS，受限於供應商 | 需要自行維運主機與資料庫 |
| 成本 | Workers Free Tier 即可運行 | 免費額度有限，之後按用量收費 | 免費但吃主機資源 |
| 部署 | 一鍵 Deploy 或 `wrangler deploy` | 註冊 + 設定 tenant | Docker / VM + DB + 反向代理 |
| 延遲 | Edge 就近回應 | 取決於 region | 取決於主機位置 |
| 登入頁自訂 | 內建三種主題，支援品牌 Logo、背景圖輪換、外部連結 | 需付費方案或自建 Universal Login | 需手動改 theme template |
| 存取控制 | 每個 Client 獨立設定允許的信箱域名 | 需設定 Rules / Actions | 需設定 Realm roles |
| 管理介面 | 內建，隨 Worker 一起部署 | 獨立的 Dashboard | 獨立的 Admin Console |

## 功能

- **標準 OIDC Authorization Code Flow + PKCE (S256)** — 相容 ChatGPT、Grafana、Outline 等任何支援 OIDC 的服務
- **JWT Access Token** — HS256 簽發，不需要額外 KV 查詢即可驗證
- **Per-Client 域名白名單** — 每個用戶端獨立控制哪些信箱域名可以登入
- **登入驗證碼** — 可設使用次數上限的一次性碼，適合人工審核場景
- **Cloudflare Turnstile** — 原生整合，選配啟用
- **登入頁品牌化** — Glass / Modern / Minimal 三種主題，支援自訂 Logo、背景圖、外部跳轉連結
- **多語系** — 英文 / 繁體中文 / 簡體中文，管理後台與登入頁皆支援切換
- **操作日誌** — 所有授權與管理操作皆有紀錄

## 一鍵部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/banana2556/oidc-worker)

> 適用於 public repository。Private fork 請改用下方 CLI 流程。

### 部署後必填設定

到 Cloudflare Dashboard → Worker → Settings → Variables & Secrets：

| 名稱 | 類型 | 必填 | 說明 |
|---|---|---|---|
| `ISSUER_URL` | Variable | Yes | IdP 公開網址，例如 `https://sso.example.com` |
| `ADMIN_PASSWORD` | Secret | Yes | Admin UI 登入密碼 |
| `ADMIN_SECRET` | Secret | Yes | JWT 簽章密鑰（建議 `openssl rand -base64 32`） |
| `TURNSTILE_SITE_KEY` | Variable | No | Turnstile site key，未設定則自動停用 |
| `TURNSTILE_SECRET_KEY` | Secret | No | Turnstile secret key |

設定完成後開啟 `https://你的網域/admin/` 即可進入管理後台。

## CLI 部署

```bash
npm ci
npx wrangler login
npx wrangler kv namespace create OIDC_KV
```

將回傳的 KV namespace id 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "OIDC_KV"
id = "你的 KV namespace id"
```

設定 secrets：

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SECRET
# 選配：npx wrangler secret put TURNSTILE_SECRET_KEY
```

部署：

```bash
npm run deploy
```

## 端點

| 路徑 | 用途 |
|---|---|
| `/.well-known/openid-configuration` | OIDC Discovery |
| `/jwks.json` | JWKS Public Keys |
| `/authorize` | Authorization Endpoint |
| `/token` | Token Endpoint |
| `/userinfo` | UserInfo Endpoint |
| `/admin/` | Admin UI |
