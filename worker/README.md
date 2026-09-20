# labsite-oauth Worker

GitHub 登入的後端，只有一個 `POST /exchange` 端點：把 GitHub 回傳給瀏覽器的 `code` 換成 access token。client secret 只存在這裡，永遠不進網頁。

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
3. 回到編輯器 repo，把 `public/labsite.config.json` 填好：
   ```json
   { "githubClientId": "<Client ID>", "oauthWorkerUrl": "https://labsite-oauth.<帳號>.workers.dev" }
   ```
   push 之後 GitHub Pages 會重新建置，「用 GitHub 登入」按鈕就會出現。

本機開發（`npm run dev`）也能登入：OAuth App 可另建一個 callback 為 `http://127.0.0.1:4180/` 的 App，或在同一個 App 的 callback 填 Pages 網址即可（GitHub 允許 callback 的子路徑，但不同 origin 需另建 App）。

`ALLOWED_ORIGINS` 限制哪些網站能呼叫這個 Worker；換網址時記得更新。
