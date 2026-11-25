# LabSite Cloud

讓老師不需要 GitHub 帳號，就能用 Email 和密碼登入、編輯自己的實驗室網站、保存版本、自己發布。整套跑在 Cloudflare 上。

## 架構

```
老師的瀏覽器
   │  用 Email + 密碼登入（第一次用管理者給的登入連結）→ 90 天登入，有在用就自動延長
   ▼
labsite-studio-cloud  (Worker：編輯器 + /api)
   │        │
   │        └── D1  labsite   版本紀錄、成員、登入，以及檔案內容
   │                          （以 SHA-256 為名分塊存放，同內容只存一份；之後可改放 R2）
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
| `src/auth.js` | 判斷登入者：Cloudflare Access 的 JWT（有設定時）或登入 cookie |
| `src/sessions.js` | 邀請連結與登入狀態，只存 SHA-256 |
| `src/blobs.js` | 檔案內容存放：有 R2 綁定用 R2，否則存 D1 分塊 |
| `scripts/invite.js` | 從指令列產生第一位管理者的登入連結 |
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

目前上線中：

| | 網址 |
|---|---|
| 編輯器 | <https://labsite-studio-cloud.shiftguard-navicare.workers.dev> |
| 公開網站 | `https://labsite-sites.shiftguard-navicare.workers.dev/<代稱>/` |

檔案內容存在 D1（以 base64 分塊）。

### 更新程式：推到 `main` 就自動部署

`.github/workflows/deploy-cloud.yml` 在每次推到 `main` 時跑測試、套用新的 D1 migration、部署兩個 Worker，不需要在自己的電腦裝 Node 或 wrangler。只要設定一次：

1. Cloudflare 儀表板 → 右上角頭像 → **My Profile** → **API Tokens** → **Create Token** → 選 **Edit Cloudflare Workers** 範本，在 Permissions 再加一列 **Account → D1 → Edit** → 建立後複製 token。
2. GitHub `labsite-studio` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**：名稱 `CLOUDFLARE_API_TOKEN`，貼上 token。（token 看得到不只一個 Cloudflare 帳號時，再加 `CLOUDFLARE_ACCOUNT_ID`，在儀表板 Workers & Pages 右側可以找到。）
3. **Actions** → **Deploy LabSite Cloud to Cloudflare** → **Run workflow** 部署一次。

沒設定 token 時這個 workflow 只會略過、不會失敗。手動部署仍然可以：

```bash
npm --prefix cloud run migrate:remote           # 有新的 migrations/*.sql 時
npm --prefix cloud run deploy                   # 建置編輯器並部署兩個 Worker
```

### 登入：邀請連結與密碼

- 第一位管理者用指令產生連結：`npm --prefix cloud run invite -- 你的Email`。
- 之後管理者在編輯器裡產生：網站卡片的「成員」每位老師旁有「登入連結」，或用「產生登入連結」卡片給任意 Email。
- 連結只能用一次、14 天內有效；登入後 90 天內不用再登入，有在用就自動延長。資料庫只存連結與登入狀態的 SHA-256。
- 用連結登入後可以設定密碼，之後在登入頁用 Email + 密碼登入。
- 管理者名單在 `wrangler.api.toml` 的 `ADMIN_EMAILS`。

### 匯入網站、加入老師

管理者登入後，在「從 GitHub 匯入網站」輸入 `bobyu89/sung-lab-website` 等。在網站卡片的「成員」加入老師的 Email，再按「產生登入連結」把連結傳給老師；老師第一次登入後按右上角「設定密碼」，之後就用 Email 和密碼登入。

### （選用）發布後自動備份到 GitHub

建立一個 fine-grained token，只授權要備份的儲存庫、權限 **Contents: Read and write**：

```bash
npx --prefix cloud wrangler secret put GITHUB_BACKUP_TOKEN -c cloud/wrangler.api.toml
```

沒有設定時備份會顯示「未設定備份 token」，不影響發布。單次發布超過 40 個檔案變更時不自動備份（免費方案每個請求最多 50 個對外連線），請改用「下載整站」。

### （選用）AI 助手與 AI 外觀

- **AI 助手**：老師在編輯畫面右上角用一句話寫想怎麼改，Claude（`claude-opus-5-5`）回覆提案卡片（修改文字、新增最新消息、修改研究室資料、新增論文），老師按「套用」才會改；助手不會發布。伺服器只轉送並清理提案（`cloud/src/ai.js` 的 `aiAssist`），不改任何檔案。
- **AI 外觀**：在「外觀」用一句話描述想要的感覺，產生 3 組配色與字體；每一組都修正到 WCAG AA 對比才回傳。

兩者共用一把 Anthropic API 金鑰、每個網站每天的次數上限（預設 20）與各網站的開關，每次使用都記在 `events` 表。

**放金鑰**：管理者登入後，在「我的網站」下方的「管理者 › 平台設定」貼上金鑰（到 <https://console.anthropic.com/settings/keys> 建立）。儲存前會先測試連線；儲存後頁面只顯示最後 4 碼。金鑰存在 D1 的 `settings` 表（明文），只有 Worker 呼叫 API 時讀取，任何 API 回應都不含金鑰。想把金鑰放在 Cloudflare 而不是資料庫，可以改設 secret，它會優先於頁面上的設定：

```bash
npx --prefix cloud wrangler secret put ANTHROPIC_API_KEY -c cloud/wrangler.api.toml
```

沒有金鑰時，編輯器不顯示這兩個功能。本機想試介面但沒有金鑰：`npm --prefix cloud run dev:node:ai-mock` 會回傳固定的模擬回應，不呼叫 API；加上 `-- --no-key` 則從沒有金鑰的狀態開始，用來試「平台設定」頁（任何 `sk-ant-…` 格式的字串都會通過模擬的連線測試）。

### 自動保存

雲端網站的修改在停止輸入 20 秒後（或分頁切到背景時）自動存成草稿，版本紀錄標「自動保存」。同一人兩小時內連續的自動保存只留一筆（新的取代舊的，`commits.auto_since`）；已發布、已備份到 GitHub 的版本不會被取代。外觀的修改不自動保存。被取代版本的檔案內容目前不會回收。

### （選用）改用 R2 存檔案

網站變多、圖片變大時再做：在儀表板啟用 R2，`npx wrangler r2 bucket create labsite-blobs`，把兩個 `wrangler.*.toml` 裡註解掉的 `r2_buckets` 打開。新上傳的檔案會進 R2；舊檔案要先複製過去。

### （選用）改用 Cloudflare Access 的 Email 驗證碼

老師人數變多、想要更強的登入時：Workers & Pages → `labsite-studio-cloud` → Settings → Domains & Routes → `workers.dev` 那一列按 **Enable Cloudflare Access**，在允許名單填 Email，把視窗中的 POLICY_AUD 與 TEAM_DOMAIN 填進 `wrangler.api.toml` 的 `ACCESS_AUD`、`ACCESS_TEAM_DOMAIN` 再部署。邀請連結仍可同時使用。

### （之後）自訂網域

買了網域並加到 Cloudflare 後：

- 編輯器：給 `labsite-studio-cloud` 加一個自訂網域（例如 `studio.你的網域`）。
- 公開網站：`wrangler.sites.toml` 設 `SITE_DOMAIN = "你的網域"`，加路由 `*.你的網域/*`，每個實驗室就是 `<代稱>.你的網域`。
- `wrangler.api.toml` 的 `SITE_URL_TEMPLATE` 改成 `https://{slug}.你的網域/`；`scripts/invite.js` 的預設網址也一起改。

## 費用（試用規模）

| 項目 | 免費額度 | 兩個網站的用量 |
|---|---|---|
| Workers | 每天 10 萬次請求 | 遠低於 |
| D1 儲存 | 5 GB | 兩站約 3 MB，加上歷史版本 |
| D1 寫入 | 每天 10 萬列 | 匯入一個網站約 110 列，一次保存約 5 列 |
| D1 讀取 | 每天 500 萬列 | 每個公開頁面約 4 列 |

## 備份與還原

- 版本紀錄本身就是備份：任何一版都能在編輯器「版本紀錄」還原。
- D1 內建 30 天時光回溯：`npx wrangler d1 time-travel restore labsite --timestamp=<時間>`。
- 「下載整站」會給一個 zip，內容就是當下的網站檔案。
