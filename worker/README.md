# labsite-oauth Worker

GitHub 登入的後端。client secret 只存在這裡，永遠不進網頁。兩個端點，都只接受 `ALLOWED_ORIGINS` 列出的來源：

| 端點 | 用途 |
|---|---|
| `POST /state` | 簽發 OAuth `state`：帶 HMAC 簽章、綁定呼叫的 origin、10 分鐘後過期。網頁把它存進 sessionStorage 並帶去 GitHub。 |
| `POST /exchange` | 把 GitHub 回傳的 `code` 換成 access token。必須帶 `{ code, state, redirect_uri }`；Worker 會驗 state 的簽章、過期與 origin，並確認 `redirect_uri` 的 origin 等於呼叫者的 origin，全部通過才會聯絡 GitHub。 |

### 防護內容

- **Origin 白名單**：不在 `ALLOWED_ORIGINS` 的來源拿不到 CORS 許可，也拿不到 state 或 token。比對時忽略大小寫與結尾斜線，但不支援萬用字元。
- **state 由 Worker 簽發並驗證**：state 格式是 `<發行秒數>.<nonce>.<簽章>`，簽章用 `STATE_SECRET`（未設定時退回用 `GITHUB_CLIENT_SECRET`）對 `origin|發行秒數|nonce` 做 HMAC-SHA256。給 localhost 簽的 state 不能在 Pages 網址上使用；改過任何一段都會被拒；超過 `STATE_TTL_SECONDS`（600 秒）失效。瀏覽器端仍會比對 sessionStorage 的副本，兩層都要過。
- **redirect_uri 綁定 origin**：避免有人拿別的網址上取得的 code 來這裡換 token。
- 所有回應都帶 `Cache-Control: no-store`。

## 部署（一次）

1. 到 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App：
   - Homepage URL：`https://bobyu89.github.io/labsite-studio/`
   - Authorization callback URL：`https://bobyu89.github.io/labsite-studio/`
   - 建好後記下 **Client ID**，並產生一組 **Client secret**。
2. 在這個資料夾：
   ```bash
   npx wrangler login
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler deploy
   ```
   `wrangler.toml` 的 `GITHUB_CLIENT_ID` 先填上 Client ID 再 deploy。部署完成會印出 Worker 網址，例如 `https://labsite-oauth.<你的帳號>.workers.dev`。
   想讓 state 簽章的金鑰與 client secret 分開，可另外 `npx wrangler secret put STATE_SECRET`（選用）。
3. 回到編輯器 repo，把 `public/labsite.config.json` 填好：
   ```json
   { "githubClientId": "<Client ID>", "oauthWorkerUrl": "https://labsite-oauth.<帳號>.workers.dev" }
   ```
   push 之後 GitHub Pages 會重新建置，「用 GitHub 登入」按鈕就會出現。

本機開發（`npm run dev`）也能登入：OAuth App 可另建一個 callback 為 `http://127.0.0.1:4180/` 的 App，或在同一個 App 的 callback 填 Pages 網址即可（GitHub 允許 callback 的子路徑，但不同 origin 需另建 App）。

`ALLOWED_ORIGINS` 限制哪些網站能呼叫這個 Worker；換網址時記得更新。

### 升級順序

網頁從 v3.3 起登入前會先呼叫 `/state`。**先 deploy 這個 Worker，再 push 前端**；順序反過來會在按下登入時看到「登入服務版本過舊」的訊息，Worker 部署完即恢復。

### 測試

Worker 的行為由 `tests/worker.test.js` 覆蓋（origin 白名單、state 簽發／驗證／過期、redirect_uri 綁定、每個守門都在聯絡 GitHub 之前觸發），`npm test` 會一起跑。
