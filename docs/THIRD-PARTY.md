# 第三方素材與授權

LabSite 編輯器內建、可以放進研究室網站的素材，以及它們的授權。

| 素材 | 位置 | 授權 | 備註 |
|---|---|---|---|
| Health Icons（醫療護理圖示，精選 149 個，線條／實心） | `library/healthicons/` → 打包成 `dist/library/healthicons.json` | MIT，© Resolve to Save Lives（`library/healthicons/LICENSE`） | 來源 https://healthicons.org ，固定在 commit `36887b268d2cb61f8d91622ad459bdf07910c2b0`。放進網站的 SVG 檔內附授權註解。 |
| DiceBear Open Peeps（手繪人物） | `@dicebear/open-peeps` → `dist/library/people.js` | 圖像 CC0 1.0（Pablo Stanley）；程式 MIT | |
| DiceBear Notionists（線條人物） | `@dicebear/notionists` | 圖像 CC0 1.0（Zoish）；程式 MIT | |
| DiceBear Lorelei（可愛頭像） | `@dicebear/lorelei` | 圖像 CC0 1.0（Lisa Wischofsky）；程式 MIT | |
| Fluent Emoji（彩色貼圖，精選 76 個 Flat 版） | `library/stickers/fluent/` → `dist/library/stickers.json` | MIT，© Microsoft Corporation（`library/stickers/fluent/LICENSE`） | 來源 https://github.com/microsoft/fluentui-emoji ，commit 記在 `library/stickers/index.json`。放進網站的 SVG 檔內附授權註解。 |
| Bioicons（科學與醫療插圖，CC0 收藏中的 142 個） | `library/stickers/bioicons/` | CC0 1.0（只取 `static/icons/cc-0/`；CC BY、CC BY-SA 的部分沒有收錄） | 來源 https://github.com/duerrsimon/bioicons ，作者逐一記在 `index.json`。由 `tools/fetch-stickers.mjs` 從固定 commit 複製。 |
| 背景與裝飾 | `src/site/assetLibrary.js`（程式產生） | LabSite 自製 | |
| 動畫元件 | `src/site/blockCatalog.js`、`src/site/blockRuntime.js` | LabSite 自製 | 參考常見 UI 模式的名稱與分類（如 UI Design Dictionary），程式與樣式為自行撰寫。 |

## 不內建、只提供連結的

| 網站 | 原因 |
|---|---|
| unDraw、DrawKit、Storyset、Blush、ManyPixels、Glaze、SVG Repo | 條款禁止放進 App 或第三方服務、禁止再散布或做成素材包（2026-11 查證），不內建。 |
| OpenMoji、Wikimedia 的 CC BY-SA 圖 | CC BY-SA（相同方式分享）會連帶要求網站內容，不內建。 |
| Hover.css、Animate.css、Aceternity UI | Hover.css 用在「讓使用者做網站的工具」需要商業授權；Animate.css 為 Hippocratic License；Aceternity 禁止再散布。按鈕動態改由 LabSite 自己撰寫。 |
| ガーリー素材 https://girlysozai.com/ | 可以免費用在網站上、不用標示來源，但條款禁止把素材再散布或放進第三方服務，所以只在素材庫提供連結與「下載後上傳」的說明，由老師自己下載使用。 |
