# LabSite Studio v3

研究室網站工作台。v3 的重點是**真實網站模式**：直接開啟 `sung-lab-website`、`ycho-lab-website` 這類靜態網站的原始檔，用拖拉與表單修改內容，寫回原檔；設計、腳本與其餘原始碼一字不改。範例模式（虛構的「知行研究室」）仍保留，並改用 IndexedDB 保存草稿。

## 開啟方式

- **快速檢視**：直接用瀏覽器開啟 `dist/index.html`。真實網站模式在 Chrome／Edge 可用「選擇資料夾」；其他瀏覽器只能用線上唯讀模式。
- **開發模式**（建議）：
  1. `npm ci`
  2. 複製 `labsite.local.example.json` 為 `labsite.local.json`，把 `siteDir` 改成你 clone 下來的網站資料夾（絕對或相對路徑皆可）。也可改用環境變數 `LABSITE_SITE_DIR`。
  3. `npm run dev`，開啟 `http://127.0.0.1:4180`，在「真實網站」頁按「開啟 ＜資料夾名＞」。
- 本機儲存依瀏覽器及網址隔離；直接開啟檔案與 localhost 預覽不共用草稿。

## 真實網站模式（v3 新增）

| 功能 | 行為 |
| --- | --- |
| 開啟來源 | 本機資料夾（File System Access API，Chrome／Edge）、開發伺服器指定的資料夾（任何瀏覽器）、GitHub Pages 網址（唯讀，可下載修改後的頁面） |
| 頁面 | 根目錄與 `en/` 下所有 `.html`，中文與英文分組；在預覽裡點導覽連結會切換到對應頁面 |
| 區塊 | `<body>` 直屬的 `<section>`：拖拉或按鈕排序、複製、刪除；分隔線與前置註解跟著區塊移動 |
| 欄位 | 選定區塊內每一段文字（含 `<span>` 高亮片段）、連結網址、圖片 `src`／`alt`；點預覽中的元素即跳到對應欄位 |
| 圖片 | 更換圖片會寫入網站的 `assets/`，並把 `src` 改為相對路徑（英文頁自動加 `../`） |
| 頁面資訊 | `<title>` 與 description，同步更新 og／twitter 標籤 |
| 網站資料 | `js/data.js` 的 `SITE` 字串欄位（名稱、標語、主持人、聯絡方式），逐值原地替換 |
| 預覽 | 執行網站自己的 CSS 與腳本（header、footer、最新消息、照片都是真的），跳過純裝飾動畫 |
| 保存 | 逐頁寫回或全部寫回；未保存時關閉或離開會提醒。**寫回後請用 git 檢視變更再提交** |
| 復原 | 每頁獨立的復原／重做；同一欄位連續輸入合併為一步 |

寫回的檔案只在你改過的地方與原檔不同：換行格式（CRLF／LF）、多行標籤、`&` 未跳脫的屬性、自閉合的 SVG、無值屬性等都會還原。兩個實驗室網站共 42 頁經驗證，未修改直接寫回時與原檔逐字元相同。

尚未實作：GitHub 提交與推送、發布、多人協作、新增全新區塊類型、修改導覽列與頁尾（在 `js/components.js`）、非 `<section>` 結構的頁面。

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
- `src/site/source.js`：三種來源（資料夾、開發伺服器、網址）的共同介面與路徑解析。
- `src/site/preview.js`：組出可執行的預覽文件，並注入點選回報的橋接腳本。
- `src/site/siteData.js`：`SITE` 設定的讀取與原地替換。
- `src/hooks/useProject.js`：專案狀態、每頁歷史、保存、圖片寫入。
- `src/views/Project.jsx`、`src/components/SectionList.jsx`、`FieldInspector.jsx`、`SitePreview.jsx`、`SiteDataPanel.jsx`、`ProjectOpen.jsx`：真實網站介面。
- `vite.config.js`：開發伺服器的 `/__labsite/` 讀寫橋接（只在 `vite dev` 存在，不進建置）。
- `src/domain/`、`src/views/`（其餘）、`src/model.js`、`src/Site.jsx`：範例模式，同 v2。

## 驗證

`npm test`：33 項測試（範例模式 21 項、真實網站 12 項），使用 linkedom 提供 DOM。`npm run build` 產出單一 HTML。實際瀏覽器操作與 42 頁 round-trip 結果見 `VALIDATION.md`。

範例「知行研究室」為虛構示範內容。平台沒有保存任何 GitHub 憑證，也不會把草稿或網站內容傳到外部服務；預覽中的最新消息與照片是網站自己的腳本向 Google 試算表／Drive 讀取的。

設計沿用 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) 的原則（DESIGN_VARIANCE 4、MOTION_INTENSITY 2、VISUAL_DENSITY 5）。
