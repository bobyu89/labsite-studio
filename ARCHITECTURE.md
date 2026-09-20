# LabSite Studio v3 架構

v3 在 v2 的範例模式之外加入「真實網站模式」，讓編輯器直接操作靜態網站 repo 的原始檔。兩種模式各有資料模型，共用歷史 reducer、UI 元件與 IndexedDB 層。

## 真實網站模式資料流

```mermaid
flowchart TD
    S[來源 SiteSource<br/>資料夾 / 開發伺服器 / 網址] -->|readText| H[頁面 HTML 字串]
    H --> P[parsePage → DOM + 原始格式記錄]
    P --> L[listSections / collectFields]
    L --> UI[SectionList / FieldInspector / 頁面資訊 / 網站資料]
    UI -->|editHtml(mutate)| P2[parse → 變更 → serializePage]
    P2 --> H2[新 HTML 字串]
    H2 --> HIST[historyReducer（每頁一份，字串狀態）]
    HIST --> PV[buildPreview：內嵌 CSS/JS、圖片 blob URL、橋接腳本]
    PV --> IF[iframe 預覽 → 點選回報 select / navigate]
    HIST -->|writeText| S
```

### 為什麼歷史狀態是字串

每頁 HTML 只有 10～30 KB，把整份字串當作歷史的一個狀態最簡單也最安全：復原就是換回舊字串，不需要 DOM 快照或反向操作。每次操作重新解析一次，成本在毫秒以內。

### 寫回時如何維持原檔格式

瀏覽器的序列化會把標籤與文字改寫成「標準形」：屬性以單一空格連接、值一律雙引號、`&` 變成 `&amp;`、無值屬性變成 `name=""`、空的 SVG 葉節點變成 `<path></path>`。`parsePage` 先掃描原始文字，對每個與標準形不同的標籤與文字段落，記下「標準形 → 原文」；`serializePage` 在瀏覽器輸出上把符合標準形的片段換回原文。使用者改過的片段不再符合標準形，就保留瀏覽器的寫法。另外還原 DOCTYPE、`<html>` 與 `<head>` 之間的換行、`</body>` 之後的尾端、CRLF。這使 git diff 只包含實際修改。

### 區塊與欄位定位

- 區塊 = `<body>` 的直屬 `<section>`。搬移時把每個區塊（含緊鄰其前的註解橫幅）換成標記，再依新順序放回，因此分隔線 `div.ecg-divider`、腳本與其他節點都留在原地。
- 欄位以「從區塊根節點起的 childNodes 索引路徑」定位文字節點或元素，重新解析後路徑仍然穩定。設定文字時保留節點原有的前後空白。
- 預覽在區塊與擁有文字的元素上蓋 `data-ls="s{區塊索引}/{路徑}"`；點選時把 id 送回主視窗即可對應到欄位。

### 來源介面

```text
{ kind, name, writable,
  readText(path), readBlob(path), writeText(path, text), writeBlob(path, blob),
  listPages() }
```

- 資料夾：File System Access API，重新開啟時再次請求權限；handle 存在 IndexedDB。
- 開發伺服器：`vite.config.js` 的 `/__labsite/{info,list,file/*}`，限制在設定的資料夾內，只在 `vite dev` 存在。
- 網址：`fetch` GitHub Pages（有 CORS），頁面清單來自 `sitemap.xml`；不可寫。

路徑一律相對網站根目錄，`resolveFrom(pagePath, ref)` 處理 `en/` 頁的 `../`，`normalizePath` 拒絕跳出根目錄。

## 範例模式（v2 文件契約不變）

```text
schemaVersion: 2
name / english / email / theme / pages[] / collections / assets[]
```

v3 的差異：

| 項目 | v2 | v3 |
| --- | --- | --- |
| 歷史去重 | `JSON.stringify` 全文件比較 | `deepEqual` 結構比較，字串先比參照 |
| 髒污判斷 | 每次 render `JSON.stringify` | `useMemo` + `deepEqual` |
| 保存位置 | localStorage `labsite-studio-v1` | IndexedDB `labsite-studio/drafts`，同 key；舊紀錄首次讀入 |
| 跨分頁衝突 | `storage` 事件 | `BroadcastChannel` + expectedRevision |

## 模組責任

| 模組 | 責任 |
| --- | --- |
| `site/page.js` | 解析／序列化與格式還原、區塊操作、欄位擷取與設定、頁面 head |
| `site/source.js` | 來源實作、路徑正規化與解析 |
| `site/preview.js` | 預覽文件組裝、資源快取、橋接腳本 |
| `site/siteData.js` | `SITE` 字串欄位讀取與原地替換 |
| `hooks/useProject.js` | 專案開啟／關閉、每頁歷史、保存、圖片寫入、記住資料夾 |
| `components/SectionList.jsx` | pointer 事件拖拉排序（滑鼠、觸控、筆），按鈕同功能 |
| `components/FieldInspector.jsx` | 欄位表單、點選聚焦、圖片更換 |
| `components/SitePreview.jsx` | iframe 預覽、訊息橋接、捲動位置保存 |
| `domain/equal.js`、`domain/db.js` | 結構比較、IndexedDB 包裝 |
| `domain/history.js` | 純函式歷史 reducer，兩種模式共用 |
| 其餘 `domain/`、`views/`、`Site.jsx` | 範例模式，同 v2 |

## 邊界

- 只處理 `<body>` 直屬 `<section>` 的頁面結構；其他結構的頁面仍可開啟，但沒有區塊可拖拉。
- 導覽列、頁尾、最新消息、照片牆由網站腳本產生，不在此編輯；`SITE` 字串欄位可改。
- 寫回即改檔，沒有自動備份；以 git 為安全網。
- 尚未接 GitHub 提交、推送與 Pages 發布。
