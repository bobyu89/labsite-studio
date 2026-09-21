# v3.3 安全與序列化保真驗證

日期：2026-09-21。Node 24、Chromium（Claude 內建瀏覽器）。

## 自動化

- `npm test`：64 項通過（v3.2 為 43 項）。新增：
  - `tests/worker.test.js`（7 組）：origin 白名單（忽略大小寫與結尾斜線、不接受子網域偽裝）、`/state` 簽發、`state` 簽章／過期／跨 origin／竄改的拒絕、`redirect_uri` 綁定 origin、每個守門都在聯絡 GitHub 之前觸發。
  - `tests/external.test.js`（13 組）：Greene Lab「Lab Website Template」6 頁的逐字元 round-trip、無變更存檔恆等，以及零區塊頁面不拋例外。
  - `tests/site.test.js` 新增一組回歸測試：明確閉合的 SVG 葉節點、原檔直接寫入的 U+00A0、屬性值裡的 `&amp;`，round-trip 與局部編輯皆正確。
- 測試用 DOM 改為共用 `tests/dom.js`：linkedom 加上與瀏覽器一致的屬性值與文字節點跳脫（`&amp;`、`&nbsp;`、`&quot;`），否則含這些字元的頁面在瀏覽器裡正確、在測試裡卻會誤判。

## 這一版修掉的序列化 bug

外部語料一跑就抓到三個既有實驗室網站沒踩到、但其他網站一定會踩到的問題，全部發生在「沒改任何東西直接存檔」：

| 問題 | 症狀 | 修法 |
|---|---|---|
| SVG 葉節點被強制改成自閉合 | 原檔 `<circle …></circle>` 存檔後變 `<circle …/>` | 解析時記錄原檔哪些葉節點真的用 `/>`，只還原那些 |
| 原檔直接寫 U+00A0 的文字沒被記錄 | 存檔後變成 `&nbsp;` | 文字段落的原樣記錄改為同時涵蓋 `&` 與 U+00A0 |
| 沒有預測 HTML parser 對 SVG 名稱的大小寫修正 | 原檔 `viewbox="…"` 存檔後變 `viewBox="…"`（只在真實瀏覽器發生，linkedom 模擬不到） | `canonicalTag` 把屬性名轉小寫，並對 SVG 元素套用規範的「adjust SVG attributes／tag names」表 |

## 真實瀏覽器全站 round-trip

在 Chromium 內以開發伺服器載入編輯器，動態 import `src/site/page.js`，對每一頁執行 `roundTrip` 與無變更的 `editHtml`，比對是否與原檔逐字元相同：

| 語料 | 頁數 | 結果 |
|---|---|---|
| sung-lab-website（GitHub Pages 線上檔） | 24 | 24／24 相同 |
| ycho-lab-website（GitHub Pages 線上檔） | 18 | 18／18 相同 |
| Greene Lab Lab Website Template（Jekyll 產物） | 6 | 6／6 相同；區塊數 0（`<section>` 包在 `<main>` 內），編輯器顯示提示而非空白 |

## OAuth 安全

- Worker 新增 `POST /state`，簽發 HMAC-SHA256 簽章、綁定 origin、600 秒過期的 state；`POST /exchange` 必須帶 state 並通過簽章、過期、origin 與 `redirect_uri` 檢查。以單元測試驗證，未在線上 Worker 實測（需先 `wrangler deploy`）。
- 前端登入流程改為先向 Worker 取 state 再跳轉 GitHub；舊版 Worker 會顯示「登入服務版本過舊」。

## 尚未驗證／限制

- 「選擇本機資料夾」與圖片更換對話框仍需手動操作。
- 未在 Firefox／Safari 實測；程式已對不支援 File System Access API 的瀏覽器停用「選擇資料夾」並顯示提示。
- GitHub 提交流程的端到端測試已寫好（`tests/e2e-github.test.js`：讀取、改欄位、commit、fresh source 讀回、過期 sha 的寫入被拒、還原），但需要一個拋棄式 repo 與 token（`LABSITE_E2E_TOKEN`、`LABSITE_E2E_REPO`），本次未實際執行；`npm test` 在沒有這兩個變數時自動略過。`.github/workflows/e2e.yml` 提供手動與每週排程執行。
- 區塊辨識仍限 `<body>` 直屬 `<section>`；Jekyll 類模板需要另一種區塊定位策略才能編輯。

---

# v3.2 中英對照驗證

日期：2026-09-20。環境同 v3.1。

- `npm test`：43 項通過。新增配對與結構簽章測試（`pairOf`、`structureSignature`：同結構的中英頁簽章相同；中文頁新增項目後不同；英文頁做同樣操作後又相同）。
- members.html「研究團隊」的中英對照分頁：載入 `en/members.html`，顯示「兩頁結構相同」，14 組欄位逐一並排（研究團隊／Research Team、游明勳／Ming-Hsun Yu…）；頁面選單旁出現「English」切換鈕。
- 開啟同步後在中文頁「新增成員」：英文頁同步多一張卡（複製自英文頁自己的最後一張），對照分頁增為 19 組欄位，兩頁都標記未保存，結構仍相同。
- 在對照右欄把新卡名稱改為「New Member (EN)」後「全部保存（2）」：`members.html` 與 `en/members.html` 各只新增一張卡的行數；測試後以 git 還原。
- 結構不同時（例如英文頁少一張卡）：選單標 ⚠、對照分頁顯示區塊數差異、結構操作不再同步並提示。

---

# v3.1 項目清單驗證

日期：2026-09-20。環境同 v3，開發伺服器指向桌面上的 sung-lab-website clone。

- `npm test`：42 項通過。新增 4 項：清單偵測（成員卡、巢狀條列與標籤、單一子元素的 `<ul>`、文獻編號、表格列；表頭 `<tr>` 的 `<th>` 不視為清單）、新增項目複製鄰近項目並保留縮排與重新編號、刪除與搬移保持空白整潔、最後一項不可刪、複製時去除重複 id。
- members.html：「研究團隊」區塊出現「成員 2 項」清單與「新增成員」；新增後預覽立即出現第三張卡，新項目自動展開，顯示名稱、職稱、學經歷條列（巢狀清單）。
- 拖拉第三張卡到最前、刪除（有確認對話框）：清單、預覽同步；復原可逐步回退。
- 寫回後 `git diff` 只包含成員卡的增刪與順序；測試後已用 git 還原該檔。

---

# v3 真實網站模式驗證

日期：2026-09-20。環境：Windows 11、Chromium（Claude 桌面內建瀏覽器）、`npm run dev` 加 `labsite.local.json` 指向 `sung-lab-website` 的本機 clone。下方保留 v2 與初版紀錄。

## 自動化

- `npm test`：33 項通過。新增 12 項涵蓋 round-trip（CRLF、DOCTYPE、自閉合 SVG、無值屬性）、區塊搬移／刪除／複製（含分隔線與註解橫幅）、欄位擷取與設定、head 同步、`SITE` 原地替換、路徑安全、`deepEqual`、字串歷史。
- `npm run build`：成功產生自足 HTML（約 1.5 MB，gzip 約 330 KB）。

## 全站 round-trip

在瀏覽器內用 `parsePage` → `serializePage` 處理兩個實驗室網站的每一頁（sung 24 頁本機、ycho 18 頁由 GitHub Pages 讀取），未做任何修改直接序列化：

| 網站 | 頁數 | 與原檔逐字元相同 |
| --- | --- | --- |
| sung-lab-website | 24 | 24 |
| ycho-lab-website | 18 | 18 |

過程中修掉的差異來源：`&` 未跳脫的屬性值（字型 URL、英文描述）、多行 `<img … onerror>` 標籤、文字內的 `&quot;`、`</body>` 之後的尾端空白、`<html>` 與 `<head>` 間的換行。

## 實際操作（sung-lab-website 本機 clone）

- 開啟專案：偵測到 24 個頁面，首頁預覽顯示網站自己的 header、跑馬燈（來自 Google 試算表）、主視覺插圖（blob URL）。
- 修改主視覺膠囊文字加上「（測試）」：預覽即時更新，側欄與頁面選單出現未保存標記。
- 拖拉「主持人」區塊到最後：清單順序與預覽同步；復原後回到原順序。修正過一個 StrictMode 下重複觸發搬移的問題。
- 點預覽中的主標題高亮片段：左側自動切到該欄位並聚焦；捲動只發生在預覽與欄位面板，不會捲動整個工作台。
- 保存此頁後 `git diff`：`index.html` 只有 1 行文字修改與 1 個區塊搬移（57 行搬移，含註解橫幅），換行維持 CRLF（379 個 CRLF、0 個裸 LF）。
- 網站資料分頁改「標語」並寫回：`js/data.js` 的 diff 只有 1 行，CRLF 保留。
- 切換到 `en/index.html`：`../css`、`../assets`、`../js` 正確解析，英文 header 與插圖正常。
- 開發伺服器橋接拒絕跳出資料夾的路徑（`normalizePath` 測試）。

## 範例模式

- 歷史與髒污判斷改用 `deepEqual`；21 項既有測試不變。
- 草稿改存 IndexedDB：首次載入時資料庫 `labsite-studio` 建立；保存後重新載入可讀回（見下方操作紀錄）。
- 舊 localStorage 紀錄的自動讀入以單元測試覆蓋（`readSavedRecord`），未在瀏覽器手動驗證。

## 尚未驗證／限制

- 「選擇本機資料夾」使用 File System Access API，需在 Chrome／Edge 由使用者手動操作，未在自動化環境驗證（介面與開發伺服器來源相同）。
- 圖片更換的檔案選擇對話框未自動化；寫入路徑與 `src` 改寫邏輯與保存共用同一條通道。
- 未驗證 Firefox／Safari；線上唯讀模式依賴 GitHub Pages 的 CORS 標頭。
- 沒有 GitHub 提交／推送／Pages 發布。

---

# v2 架構調整驗證

日期：2026-09-19。

- `npm test`：21 項測試通過，涵蓋 v1/v2 匯入與往返、格式拒絕、純讀取轉換、固定快照、衝突、復原分組、主題與內容檢查。
- `npm run build`：成功產生自足 HTML。
- 瀏覽器直接讀取原有 v1 本機紀錄，名稱、標題與 v3 歷史仍可見；未要求重新建站。
- 複製主視覺並修改副本標題，原主視覺文字未被更動；兩個操作可復原。
- 選擇「圓潤」，實際預覽元素的 border-radius 為 22px。
- 匯入不支援版本的 JSON，顯示錯誤且「確認取代草稿」不可用。
- 匯入 v1 JSON，摘要顯示 1 頁、4 區塊、7 個內容項目、0 圖片；確認後顯示未保存，復原後研究室名稱回到原值。
- 在同一欄位連續輸入 ABC，按一次復原即回到原名稱。
- 390px 手機主題面板沒有水平溢位；已目視檢查。
- 保存轉換後文件，再開正式建置，能看到本機草稿 v4；console 沒有 error 或 warn。

---

# 初版驗證紀錄

日期：2026-09-19。範圍：本機前端，不含真實身分、雲端保存或部署。

- `npm test`：5 項核心模型測試通過。`npm run build` 通過。安裝時 npm audit：0 vulnerabilities。
- 工作台與編輯器正常呈現；修改標題並保存，重新載入後可讀到保存的文字。
- 主視覺版型切換、區塊排序、版本恢復、多分頁衝突、發布演練、集合搜尋空狀態皆已檢查。
- 在 1440 × 1000 桌面與 390 × 844 手機尺寸檢查；當次 console 未回報 error 或 warn。

設計來源：Taste Skill repository snapshot `e79ca9ec7e071eb3a3b623c4fb752e853fc3ed58`。
