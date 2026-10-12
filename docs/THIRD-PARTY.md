# 第三方素材與授權

LabSite 編輯器內建、可以放進研究室網站的素材，以及它們的授權。

| 素材 | 位置 | 授權 | 備註 |
|---|---|---|---|
| Health Icons（醫療護理圖示，精選 149 個，線條／實心） | `library/healthicons/` → 打包成 `dist/library/healthicons.json` | MIT，© Resolve to Save Lives（`library/healthicons/LICENSE`） | 來源 https://healthicons.org ，固定在 commit `36887b268d2cb61f8d91622ad459bdf07910c2b0`。放進網站的 SVG 檔內附授權註解。 |
| DiceBear Open Peeps（手繪人物） | `@dicebear/open-peeps` → `dist/library/people.js` | 圖像 CC0 1.0（Pablo Stanley）；程式 MIT | |
| DiceBear Notionists（線條人物） | `@dicebear/notionists` | 圖像 CC0 1.0（Zoish）；程式 MIT | |
| DiceBear Lorelei（可愛頭像） | `@dicebear/lorelei` | 圖像 CC0 1.0（Lisa Wischofsky）；程式 MIT | |
| 背景與裝飾 | `src/site/assetLibrary.js`（程式產生） | LabSite 自製 | |
| 動畫元件 | `src/site/blockCatalog.js`、`src/site/blockRuntime.js` | LabSite 自製 | 參考常見 UI 模式的名稱與分類（如 UI Design Dictionary），程式與樣式為自行撰寫。 |

## 不內建、只提供連結的

| 網站 | 原因 |
|---|---|
| ガーリー素材 https://girlysozai.com/ | 可以免費用在網站上、不用標示來源，但條款禁止把素材再散布或放進第三方服務，所以只在素材庫提供連結與「下載後上傳」的說明，由老師自己下載使用。 |
