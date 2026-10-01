# LabSite Cloud

讓老師不需要 GitHub 帳號，就能用 Email 驗證碼登入、編輯自己的實驗室網站、保存版本、自己發布。整套跑在 Cloudflare 上。

## 架構

```
老師的瀏覽器
   │  Email 一次性驗證碼（Cloudflare Access）
   ▼
labsite-studio-cloud  (Worker：編輯器 + /api)
   │        │
   │        ├── D1  labsite        版本紀錄：sites / trees / commits / members / events
   │        └── R2  labsite-blobs  檔案內容，以 SHA-256 為名，同內容只存一份
   │
   └── 發布後自動備份一份 commit 回 GitHub（選用）

訪客 ──► labsite-sites  (Worker：只讀，提供每個網站「已發布」的版本)
```

這是一個簡化版 git：

- **每次保存是一個版本（commit）**，記錄誰、何時、改了哪些檔、上一版是誰。
- **每個網站有兩個指標**：`draft`（最新保存）與 `published`（訪客看到的）。按「發布」只是移動 `published`。
- **還原**是用舊版本的內容建立一個新版本，歷史永遠不會被改寫。
- **衝突保護**：保存時帶上每個檔案「開啟時的雜湊」，別人已經改過同一個檔就拒絕並點名；改不同檔案的人可以同時保存。

| 檔案 | 職責 |
|---|---|
| `src/repo.js` | 版本庫核心：blob、tree、commit、草稿指標的 compare-and-swap、發布、還原、成員 |
| `src/api.js` | 編輯器用的 API（Hono），每個請求先驗證登入、再檢查是否為該網站成員 |
| `src/auth.js` | 驗證 Cloudflare Access 簽發的 JWT；沒設定 Access 時一律拒絕 |
| `src/sites.js` | 公開網站：依網址找到網站，回應已發布版本的檔案 |
| `src/github.js` | 從 GitHub 匯入（一次下載 tarball）與發布後備份 |
| `migrations/` | D1 資料表 |
| `dev/` | 不需要 workerd 的本機模擬（Node 內建 SQLite + 資料夾） |

## 本機開發

```bash
npm ci && npm --prefix cloud ci
npm run build                 # 產生 ../dist（編輯器）
npm --prefix cloud run dev:node
```

- 編輯器：<http://127.0.0.1:8787>，以 `.dev.vars` 的 `DEV_USER_EMAIL` 身分登入（只在 localhost 有效）。
- 公開網站：<http://127.0.0.1:8788/<代稱>/>
- 資料存在 `cloud/.wrangler/node-dev/`，刪掉就重來。
- 想用 Cloudflare 官方的 `wrangler dev` 也可以（`npm --prefix cloud run dev`），但 Windows 需要較新版的 Microsoft Visual C++ 可轉散發套件。

`cloud/.dev.vars`（不進 git）：

```
DEV_AUTH=on
DEV_USER_EMAIL=you@example.com
SITE_URL_TEMPLATE=http://127.0.0.1:8788/{slug}/
```

測試在專案根目錄跑 `npm test`，`tests/cloud.test.js` 用 Node 內建 SQLite 執行真正的 migration 與 Worker 程式。

## 部署

已完成：D1 資料庫 `labsite`（APAC，id 寫在兩個 `wrangler.*.toml`）與資料表。

### 1. 啟用 R2（儀表板，一次）

Cloudflare 儀表板 → **R2 Object Storage** → 啟用。免費額度每月 10 GB 儲存、流量不收費；啟用時可能要求綁定付款方式，用量在免費額度內不會扣款。啟用後：

```bash
cd cloud
npx wrangler r2 bucket create labsite-blobs
```

### 2. 部署兩個 Worker

```bash
npm --prefix cloud run deploy
```

會先建置編輯器，再部署 `labsite-studio-cloud` 與 `labsite-sites`。此時 API 會拒絕所有人（Access 還沒設定），這是預期的安全預設。

### 3. 設定 Cloudflare Access（老師的 Email 登入）

1. 儀表板 → **Workers & Pages** → `labsite-studio-cloud` → **Settings** → **Domains & Routes**，在 `workers.dev` 那一列按 **Enable Cloudflare Access**。第一次使用會請你建立 Zero Trust 團隊名稱並選 **Free** 方案（50 位使用者內免費）。
2. 跳出的視窗會顯示兩個值，抄下來：**POLICY_AUD**（應用程式的 AUD tag）與 **TEAM_DOMAIN**（`https://<團隊名>.cloudflareaccess.com`）。
3. 按 **Manage Cloudflare Access** 進入這個 Access 應用程式：
   - **Policies**：Action 選 **Allow**，Include 選 **Emails**，填入你和每位試用老師的 Email。
   - **Login methods**：確認 **One-time PIN** 有勾（Email 驗證碼）。
4. 把兩個值填進 `wrangler.api.toml`：`ACCESS_AUD` 填 POLICY_AUD，`ACCESS_TEAM_DOMAIN` 填 TEAM_DOMAIN（含不含 `https://` 都可以），再部署一次：

```bash
npx --prefix cloud wrangler deploy -c cloud/wrangler.api.toml
```

### 4. 匯入網站、加入老師

用管理者 Email（`ADMIN_EMAILS`）登入編輯器網址，在「從 GitHub 匯入網站」輸入 `bobyu89/sung-lab-website` 等。每個網站卡片的「成員」可以加入老師 Email。

> 老師的 Email 要出現在兩個地方：Access 的 Allow 名單（能不能登入）與網站成員（能改哪個網站）。

### 5.（選用）發布後自動備份到 GitHub

建立一個 fine-grained token，只授權要備份的儲存庫、權限 **Contents: Read and write**：

```bash
npx --prefix cloud wrangler secret put GITHUB_BACKUP_TOKEN -c cloud/wrangler.api.toml
```

沒有設定時備份會顯示「未設定備份 token」，不影響發布。單次發布超過 40 個檔案變更時不自動備份（免費方案每個請求最多 50 個對外連線），請改用「下載整站」。

### 6.（之後）自訂網域

買了網域並加到 Cloudflare 後：

- 編輯器：給 `labsite-studio-cloud` 加一個自訂網域（例如 `studio.你的網域`），Access 應用程式改綁這個網域。
- 公開網站：`wrangler.sites.toml` 設 `SITE_DOMAIN = "你的網域"`，加路由 `*.你的網域/*`，每個實驗室就是 `<代稱>.你的網域`。
- `wrangler.api.toml` 的 `SITE_URL_TEMPLATE` 改成 `https://{slug}.你的網域/`。

## 費用（試用規模）

| 項目 | 免費額度 | 兩個網站的用量 |
|---|---|---|
| Workers | 每天 10 萬次請求 | 遠低於 |
| D1 | 5 GB | 數 MB |
| R2 | 10 GB、流量免費 | 約 3 MB 加歷史版本 |
| Access | 50 位使用者 | 試用老師人數 |

## 備份與還原

- 版本紀錄本身就是備份：任何一版都能在編輯器「版本紀錄」還原。
- D1 內建 30 天時光回溯：`npx wrangler d1 time-travel restore labsite --timestamp=<時間>`。
- 「下載整站」會給一個 zip，內容就是當下的網站檔案。
