# LabSite 交接文件

給接手維護 LabSite 的人。讀完這份，你應該知道：系統在哪裡、每天自動做什麼、出事時先看哪裡、哪些事一定要管理者本人做。程式細節在 `cloud/README.md` 和 `README.md`；每一版做了什麼、怎麼驗證，在 `VALIDATION.md`。

## 1. 系統一覽

| 東西 | 在哪裡 | 用途 |
|---|---|---|
| 程式碼 | GitHub `bobyu89/labsite-studio` | 編輯器（`src/`）、雲端（`cloud/`）、模板（`templates/`）、素材（`library/`） |
| 編輯器 | https://labsite-studio-cloud.shiftguard-navicare.workers.dev/ | 老師登入、修改、發布 |
| 公開網站 | https://labsite-sites.shiftguard-navicare.workers.dev/<網站代稱>/ | 訪客看到的版本 |
| 資料庫 | Cloudflare D1 `labsite` | 所有網站的每一個版本、帳號、設定（AI 金鑰、GitHub 權杖） |
| 網站備份 | 每個網站對應的 GitHub 儲存庫（例如 `bobyu89/sung-lab-website`） | 每小時把最新版本推上去；要在「平台設定」放權杖才會啟用 |
| 部署 | GitHub Actions `.github/workflows/deploy-cloud.yml` | 推到 `main` 就跑測試、資料庫遷移、部署兩個 Worker |

Cloudflare 帳號、GitHub 帳號、Anthropic 帳號都是管理者（bobyu89）本人的。接手的人需要被加入這些帳號，或由管理者轉移。

## 2. 每小時自動做的事

`cloud/src/api.js` 的 `scheduled`，每小時第 17 分：

0. **預約發布**（`cloud/src/schedule.js`）：每 10 分鐘也會跑一次，把到時間的預約發布出去。
1. **搬離 Google 試算表**（`cloud/src/sheets.js`）：還在讀試算表的網站，把內容搬進 `js/data.js`。
2. **一次性網站修正**（`cloud/src/patches.js`）：只在檔案剛好是指定版本時套用一次。
3. **GitHub 備份**（`cloud/src/github.js`）：把還沒備份的最新版本推到各網站的儲存庫。

這三件事都會在網站的「舊版本」留下紀錄，作者分別是「LabSite 自動搬移」「LabSite 自動修正」；出問題可以直接還原。

## 3. 常見狀況

| 狀況 | 怎麼處理 |
|---|---|
| 老師忘記密碼、換電腦進不去 | 管理者登入 →「我的網站」下方「管理者 › 產生登入連結」，把連結傳給老師；老師登入後按右上角「設定密碼」。 |
| 新老師要加入 | 「我的網站」該網站的「成員」加入 Email，再給登入連結。學生或助理加入後，把身分改成「學生、助理」：他們能改、不能直接發布。 |
| 學生說「請老師發布」沒反應 | 老師要用自己的帳號打開「我的網站」才會看到；請求存在 D1 `settings` 的 `review:<網站 id>`，發布後清除。 |
| 新增一個研究室網站 | 「管理者 › 新增網站（用模板）」或「從 GitHub 匯入網站」。 |
| 改錯、發布錯 | 編輯器左上「舊版本」→ 選一版「還原成這一版」→ 發布。剛發布完也可以在完成視窗按「回到上一版」。 |
| AI 助手沒出現 | 「平台設定」看金鑰是否還在、該網站有沒有開啟、今天的次數是否用完。 |
| 預約發布沒有上線 | 「我的網站」與編輯器上方會顯示「預約發布沒有成功」和原因；預約存在 D1 `settings` 的 `schedule:<網站 id>`。Cloudflare 的 cron 要有 `*/10 * * * *`（`cloud/wrangler.api.toml`）。 |
| 造訪數字怪怪的 | 只算網頁（.html）被打開的次數，同一人重新整理也算一次；機器人用 User-Agent 排除，不是百分之百。資料在 D1 `page_views`。 |
| ORCID 新論文提醒沒出現 | 該網站要先用「一次匯入多篇 › ORCID」並勾「記住這個 ORCID」；每台瀏覽器每天最多查一次。ORCID 存在 D1 `settings` 的 `orcid:<網站 id>`。 |
| AI 費用 | Anthropic Console 看用量；「平台設定」可調每站每日上限。 |
| 備份失敗 | 「平台設定 › GitHub 備份」會列出每個網站的狀態與錯誤；常見原因是權杖過期或沒有該儲存庫的寫入權限。 |
| 部署失敗 | GitHub → Actions → Deploy LabSite Cloud to Cloudflare，看失敗的步驟。測試沒過不會部署。 |

## 4. 修改程式的流程

1. 在分支上改，跑 `npm test`、`npm run build`。
2. 本機試：`npm run build && npm --prefix cloud run dev:node`（加 `-- --ai-mock` 不用 AI 金鑰）。資料在 `cloud/.wrangler/node-dev/`。
3. 開 PR；合併到 `main` 會自動部署到正式站。
4. 改資料庫結構：在 `cloud/migrations/` 加新的 `00NN_*.sql`，只新增、不要改舊的；部署時自動套用。
5. 要改某個網站的檔案而不經過老師：寫一個 `cloud/src/patches.js` 的修正（指定檔案的 SHA-256），不要直接改資料庫。

## 5. 一定要管理者本人做的事

- Cloudflare、GitHub、Anthropic 帳號與帳單。
- 建立或更換 API 金鑰、GitHub 權杖（貼在「平台設定」，不要傳到聊天或 Email）。
- 決定網域、費用與合作。

## 5.5 設計規範（v4.28）

- 規則、反模式、指令都在 `src/site/design.js`；AI 讀的是這份程式。改規則後執行 `npm test`（`tests/design.test.js` 會檢查 `docs/DESIGN-STANDARD.md` 有沒有跟上）。
- 風格包在 `src/site/stylePacks.js`；新增一包要通過對比檢查，且套到版型後設計檢查要是零（測試會擋）。
- 每個網站的研究室檔案存在 D1 `settings` 的 `lab:<siteId>`（JSON）；老師在「今天想改什麼 › 研究室檔案」修改。

## 5.6 v4.29

- 老師可以自己邀請學生和助理（只限「學生、助理」身分）。同一位學生要加入兩個研究室、或要加其他老師，仍由管理者在網站卡片的「成員」處理。
- 每月體檢結果存在 `settings` 的 `health:<siteId>`；「我的網站」看得到各網站上次體檢的分數，超過一個月沒體檢會標示。

## 5.7 v4.30

- 「從我的資料帶入」讀履歷或舊網站一次算 1 次 AI（事件 `ai_import`），放進每一頁再各算 1 次助手。每日上限照「AI 助手設定」。
- 第一次使用的三步驟記在瀏覽器（`labsite.firstrun.v1`），老師換新電腦會再看到一次，可以直接關掉。

## 6. 定期檢查（建議每月一次）

- 「總覽」看各網站最後修改與發布時間，太久沒動的可以提醒老師；「我的網站」看各網站上次體檢的分數。
- 「平台設定」看 AI 本月用量與備份狀態。
- 素材庫的每月更新 PR（自動排程開的）：確認新素材的授權後再合併。
- 依賴套件更新：`npm outdated`、`npm --prefix cloud outdated`，更新後跑完整測試。

## 7. 已知限制

見 `VALIDATION.md` 每一版的「尚未驗證／已知」段落。目前最重要的幾項：

- 兩人同時改同一頁不會自動合併，後存的人要重新開啟。
- 被取代的自動保存，其檔案內容沒有回收。
- 跨瀏覽器（Firefox、Safari）沒有在每次修改後重測。
