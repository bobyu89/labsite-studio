# LabSite Studio v3

研究室網站工作台。v3 的重點是**真實網站模式**：直接開啟 `sung-lab-website`、`ycho-lab-website` 這類靜態網站的原始檔，用拖拉與表單修改內容，寫回原檔；設計、腳本與其餘原始碼一字不改。範例模式（虛構的「知行研究室」）仍保留，並改用 IndexedDB 保存草稿。

**線上版**：<https://bobyu89.github.io/labsite-studio/>（推到 `main` 會由 GitHub Actions 自動建置部署）。

## 開啟方式

- **線上版 + GitHub 直接編輯**（建議）：打開上面的網址 → 「從 GitHub 直接編輯」→ 用 GitHub 登入（或貼上 token）→ 選擇儲存庫 → 開啟並編輯。每次「保存此頁」就是一個 commit，網站的 GitHub Pages 一兩分鐘後自動更新，不需要本機 clone 或 git。登入按鈕需要先部署一次 OAuth 服務，步驟見 [`worker/README.md`](worker/README.md)；在那之前可用 fine-grained token（只需 `Contents: Read and write` 權限、限定兩個網站 repo）。
- **快速檢視**：直接用瀏覽器開啟 `dist/index.html`。真實網站模式在 Chrome／Edge 可用「選擇資料夾」；其他瀏覽器只能用線上唯讀模式。
- **開發模式**（建議）：
  1. `npm ci`
  2. 複製 `labsite.local.example.json` 為 `labsite.local.json`，把 `siteDir` 改成你 clone 下來的網站資料夾（絕對或相對路徑皆可）。也可改用環境變數 `LABSITE_SITE_DIR`。
  3. `npm run dev`，開啟 `http://127.0.0.1:4180`，在「真實網站」頁按「開啟 ＜資料夾名＞」。
- 本機儲存依瀏覽器及網址隔離；直接開啟檔案與 localhost 預覽不共用草稿。

## 真實網站模式（v3 新增）

| 功能 | 行為 |
| --- | --- |
| 開啟來源 | **GitHub 儲存庫**（API 讀寫；每次保存是一個 commit，頁面、換的圖片與 `js/data.js` 走 Git Data API 一起提交，「全部保存」也只有一個 commit；未登入可唯讀）、本機資料夾（File System Access API，Chrome／Edge）、開發伺服器指定的資料夾（任何瀏覽器）、GitHub Pages 網址（唯讀，可下載修改後的頁面） |
| 頁面 | 根目錄與 `en/` 下所有 `.html`，中文與英文分組；在預覽裡點導覽連結會切換到對應頁面 |
| 區塊 | `<body>` 直屬的 `<section>`：拖拉或按鈕排序、複製、刪除；分隔線與前置註解跟著區塊移動 |
| 欄位 | 選定區塊內每一段文字（含 `<span>` 高亮片段）、連結網址、圖片 `src`／`alt`；點預覽中的元素即跳到對應欄位 |
| 項目清單（v3.1） | 自動偵測「同一容器下 tag 與 class 相同的重複元素」：成員卡、研究領域卡、文獻 `<li>`、表格列、膠囊標籤、條列 `<li>`。可新增（複製鄰近項目）、刪除、拖拉排序；巢狀清單（卡片裡的學經歷條列、標籤）一樣可編輯；`1. 2. 3.` 這類編號會自動重排 |
| 圖片 | 更換圖片先暫存在瀏覽器並立即出現在預覽，保存該頁時才寫入網站的 `assets/`（與頁面同一個 commit）；`src` 改為相對路徑（英文頁自動加 `../`） |
| 中英對照（v3.2） | 每頁自動配對 `x.html` ↔ `en/x.html`，一鍵切換語言；「中英對照」分頁把同一區塊的中文與英文欄位逐一並排，直接翻譯。新增／刪除／排序區塊或項目時，只要兩頁結構相同就自動同步到另一語言頁（新項目先帶原文）；結構不同的頁面在選單標 ⚠ 並停止同步，可用「檢查全部頁面的結構」一次載入所有配對頁 |
| 頁面資訊 | `<title>` 與 description，同步更新 og／twitter 標籤 |
| 網站資料 | `js/data.js` 的 `SITE` 字串欄位（名稱、標語、主持人、聯絡方式），逐值原地替換 |
| 預覽 | 執行網站自己的 CSS 與腳本（header、footer、最新消息、照片都是真的），跳過純裝飾動畫 |
| 保存 | 逐頁寫回或全部寫回；未保存時關閉或離開會提醒。**寫回後請用 git 檢視變更再提交** |
| 復原 | 每頁獨立的復原／重做；同一欄位連續輸入合併為一步 |

寫回的檔案只在你改過的地方與原檔不同：換行格式（CRLF／LF）、多行標籤、`&` 未跳脫的屬性、自閉合的 SVG、無值屬性等都會還原。兩個實驗室網站共 42 頁經驗證，未修改直接寫回時與原檔逐字元相同。

GitHub 模式的注意事項：token 只存在瀏覽器的 localStorage；保存前會把每個檔案的 blob sha 與開啟時看到的比對，遠端已被別人改過就點名拒絕、什麼都不上傳；分支指標更新不使用 force，中途插進來的 commit 會讓提交失敗而不是被蓋掉。

尚未實作：多人協作、新增全新區塊類型、修改導覽列與頁尾（在 `js/components.js`）、非 `<section>` 結構的頁面、私有儲存庫（OAuth 只要求 `public_repo`）。

網站要長什麼樣子才能被編輯（區塊、欄位、清單的判斷規則，以及存檔時哪些寫法會被原樣保留）見 [`docs/markup-convention.md`](docs/markup-convention.md)。

## 和其他工具的差別

| | LabSite Studio | Decap／Sveltia／Pages CMS | Silex／GrapesJS 類頁面建構器 | CloudCannon／Sitecake |
|---|---|---|---|---|
| 編輯對象 | **現成的靜態 HTML 原檔** | Markdown／YAML／JSON 內容檔，交給 SSG 產生 HTML | 建構器自己的專案格式，匯出時重寫整份 HTML | HTML，但要先加 `data-editable`／`sc-content` 之類的標記 |
| 需要設定檔或 schema | 不需要，靠結構判斷 | 需要（collections、fields） | 不需要，但網站得從建構器裡做 | 需要在 HTML 加標記與設定 |
| 存檔後的 git diff | 只有改到的節點；換行、引號、實體、SVG 寫法全部原樣 | 內容檔的 diff | 整頁重寫 | 依產品 |
| 後端 | 純前端 + 一支只換 token 的 Worker | 純前端 + OAuth proxy（Pages CMS 有資料庫） | 需伺服器 | 商業服務／PHP |
| 適合 | 已經有一個手寫或模板產生的靜態網站，想讓不會 git 的人改內容 | 新網站，內容與版型分離 | 從零開始視覺化建站 | 願意改造 HTML、可付費 |

一句話：**不需要 SSG、不需要 schema、直接開現成的 HTML 改內容，存回去的 git diff 只有你改的那幾行。**

## 範例模式（沿用 v2）

| 功能 | 行為 |
| --- | --- |
| 工作台 | 範例網站即時縮圖、建站路徑、快捷入口、最近草稿 |
| 範例編輯 | 主視覺、全站名稱、Email、主色、字體、圓角、間距、字級、兩種主視覺版型 |
| 四種區塊 | 主視覺、研究方向、最新消息、研究團隊；新增、排序、複製、隱藏、確認刪除 |
| 共用集合 | 新增、編輯、搜尋、排序、刪除；引用區塊同步 |
| 素材 | JPG/PNG/WebP、每張 2 MB、最多 8 張、替代文字 |
| 本機草稿 | **IndexedDB** 保存（v3 起），最近 15 份快照；舊版 localStorage 草稿會自動讀入，第一次保存後改存新位置 |
| 多分頁 | expectedRevision 檢查、Web Locks、BroadcastChannel 通知衝突 |
| 備份 | JSON 匯出／匯入（v1／v2）、自足 HTML 匯出 |
| 發布檢查 | 只做演練，不呼叫 GitHub、不宣稱上線 |

## v3 對效能與儲存的修正

- 歷史與髒污判斷改用結構比較（`domain/equal.js`），不再對整份文件 `JSON.stringify`。未變動的圖片字串以參照比較，成本為零。
- 草稿與快照改存 IndexedDB（`domain/db.js`），不受 localStorage 約 5 MB 上限限制。
- 真實網站模式的圖片不進文件，直接寫入網站 `assets/`，預覽用 blob URL。

## 程式結構

- `src/site/page.js`：真實頁面模型。解析、區塊操作、欄位擷取、寫回時還原原始格式。
- `src/site/source.js`：來源的共同介面與路徑解析（資料夾、開發伺服器、網址）。
- `src/site/github.js`：GitHub API 來源（trees／contents，sha 快取）、OAuth 登入的瀏覽器端、token 儲存。
- `worker/`：Cloudflare Worker，簽發並驗證 OAuth `state`，再做 code→token 交換；只接受白名單 origin，`redirect_uri` 也綁定 origin。`public/labsite.config.json` 填 client ID 與 Worker 網址。
- `.github/workflows/pages.yml`：測試、建置並部署到 GitHub Pages。
- `src/site/preview.js`：組出可執行的預覽文件，並注入點選回報的橋接腳本。
- `src/site/siteData.js`：`SITE` 設定的讀取與原地替換。
- `src/hooks/useProject.js`：專案狀態、每頁歷史、保存、圖片寫入。
- `src/views/Project.jsx`、`src/components/SectionList.jsx`、`FieldInspector.jsx`（含項目清單）、`PairPanel.jsx`（中英對照）、`SitePreview.jsx`、`SiteDataPanel.jsx`、`ProjectOpen.jsx`：真實網站介面；`src/hooks/useDragReorder.js` 為共用拖拉邏輯。
- `vite.config.js`：開發伺服器的 `/__labsite/` 讀寫橋接（只在 `vite dev` 存在，不進建置）。
- `src/domain/`、`src/views/`（其餘）、`src/model.js`、`src/Site.jsx`：範例模式，同 v2。

## 驗證

`npm test`：64 項測試（範例模式 21 項、真實網站 18 項、外部語料 13 項、GitHub 來源與 OAuth 5 項、Worker 7 項），使用 linkedom 提供 DOM（`tests/dom.js` 補上與瀏覽器一致的跳脫）。`npm run test:e2e` 對真實 repo 跑 GitHub 提交流程（需設 `LABSITE_E2E_TOKEN` 與 `LABSITE_E2E_REPO`，否則略過）。`npm run build` 產出單一 HTML。實際瀏覽器操作、兩個實驗室網站 42 頁與 Greene Lab 模板 6 頁在 Chromium 的 round-trip 結果見 `VALIDATION.md`。

範例「知行研究室」為虛構示範內容。平台沒有保存任何 GitHub 憑證，也不會把草稿或網站內容傳到外部服務；預覽中的最新消息與照片是網站自己的腳本向 Google 試算表／Drive 讀取的。

設計沿用 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) 的原則（DESIGN_VARIANCE 4、MOTION_INTENSITY 2、VISUAL_DENSITY 5）。
