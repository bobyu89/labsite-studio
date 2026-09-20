import React, { useState } from "react";
import { Button, Badge } from "@radix-ui/themes";
import {
  FolderOpen,
  Terminal,
  Globe,
  ClockCounterClockwise,
  X,
  GithubLogo,
  SignOut,
  Key,
} from "@phosphor-icons/react";
import { KNOWN_REPOS, loginAvailable } from "../site/github.js";

const SITES = [
  ["宋建美老師研究室", "https://bobyu89.github.io/sung-lab-website/"],
  ["賀彥中老師實驗室", "https://bobyu89.github.io/ycho-lab-website/"],
];

function GithubCard({ p }) {
  const { gh } = p;
  const [repo, setRepo] = useState(gh.lastRepo || KNOWN_REPOS[0][0]);
  const [custom, setCustom] = useState("");
  const [branch, setBranch] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState("");
  const target = repo === "custom" ? custom : repo;
  const canLogin = loginAvailable(gh.config);
  return (
    <section className="open-card open-card--github">
      <GithubLogo size={30} />
      <div className="open-card__head">
        <h3>從 GitHub 直接編輯</h3>
        <p>不用本機資料夾。每次保存就是一個 commit，GitHub Pages 一兩分鐘後自動更新。</p>
      </div>
      {gh.busy ? (
        <Badge color="gray" variant="soft">
          檢查登入狀態…
        </Badge>
      ) : gh.user ? (
        <div className="gh-user">
          {gh.user.avatar && <img src={gh.user.avatar} alt="" width={26} height={26} />}
          <strong>{gh.user.name}</strong>
          <span className="muted">@{gh.user.login}</span>
          <button type="button" className="text-link" onClick={p.logoutGithub}>
            <SignOut size={15} /> 登出
          </button>
        </div>
      ) : (
        <div className="gh-login">
          <Button size="3" disabled={!canLogin || p.busy} onClick={p.loginGithub}>
            <GithubLogo size={18} />
            用 GitHub 登入
          </Button>
          {!canLogin && (
            <span className="small-note">尚未設定登入服務（見 worker/README.md）。可先用 token。</span>
          )}
          <button type="button" className="text-link" onClick={() => setShowToken((v) => !v)}>
            <Key size={15} /> {showToken ? "收起" : "改用個人 token"}
          </button>
          {showToken && (
            <div className="url-row">
              <input
                type="password"
                placeholder="貼上 GitHub fine-grained token（只存在此瀏覽器）"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                aria-label="GitHub token"
              />
              <Button variant="surface" disabled={!token.trim() || p.busy} onClick={() => p.setGithubToken(token)}>
                使用這個 token
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="url-row">
        <select value={repo} onChange={(e) => setRepo(e.target.value)} aria-label="儲存庫">
          {KNOWN_REPOS.map(([full, name]) => (
            <option key={full} value={full}>
              {name}　{full}
            </option>
          ))}
          <option value="custom">其他儲存庫…</option>
        </select>
        {repo === "custom" && (
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="owner/repo 或 GitHub 網址" aria-label="其他儲存庫" />
        )}
        <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="分支（留空用預設）" aria-label="分支" />
      </div>
      <div className="button-row">
        <Button size="3" disabled={!gh.user || p.busy || !target} onClick={() => p.openGithub(target, branch)}>
          開啟並編輯
        </Button>
        <Button size="3" variant="ghost" disabled={p.busy || !target} onClick={() => p.openGithub(target, branch, { readOnly: true })}>
          不登入，唯讀開啟
        </Button>
      </div>
      {gh.error && <span className="small-note error-text">{gh.error}</span>}
    </section>
  );
}

export default function ProjectOpen({ p }) {
  const [url, setUrl] = useState(SITES[0][1]);
  const canPick = typeof window !== "undefined" && !!window.showDirectoryPicker;
  return (
    <div className="open-grid">
      <GithubCard p={p} />
      {p.remembered && (
        <section className="open-card open-card--remember">
          <ClockCounterClockwise size={26} />
          <div>
            <h3>上次開啟：{p.remembered.name}</h3>
            <p>瀏覽器會再次詢問資料夾的讀寫權限。</p>
          </div>
          <div className="button-row">
            <Button onClick={p.reopenRemembered}>重新開啟</Button>
            <Button variant="ghost" onClick={p.forgetRemembered} aria-label="忘記這個資料夾">
              <X size={16} />
            </Button>
          </div>
        </section>
      )}
      <section className="open-card">
        <FolderOpen size={30} />
        <h3>選擇本機網站資料夾</h3>
        <p>
          打開你 clone 下來的 <code>sung-lab-website</code> 或 <code>ycho-lab-website</code>{" "}
          資料夾。修改直接寫回原檔，之後用 git 檢視、提交與推送。
        </p>
        <Badge color={canPick ? "teal" : "gray"} variant="soft">
          {canPick ? "此瀏覽器支援" : "需要 Chrome 或 Edge"}
        </Badge>
        <Button size="3" disabled={!canPick || p.busy} onClick={p.openDirectory}>
          選擇資料夾
        </Button>
      </section>
      <section className="open-card">
        <Terminal size={30} />
        <h3>開發伺服器指定的資料夾</h3>
        <p>
          在 <code>labsite.local.json</code> 設定 <code>siteDir</code> 後執行{" "}
          <code>npm run dev</code>，任何瀏覽器都能讀寫。
        </p>
        {p.devInfo ? (
          <>
            <Badge color="teal" variant="soft">
              已偵測到：{p.devInfo.name}
            </Badge>
            <Button size="3" disabled={p.busy} onClick={p.openDev}>
              開啟 {p.devInfo.name}
            </Button>
          </>
        ) : (
          <Badge color="gray" variant="soft">
            未偵測到設定
          </Badge>
        )}
      </section>
      <section className="open-card">
        <Globe size={30} />
        <h3>從線上網址讀取（唯讀）</h3>
        <p>直接讀 GitHub Pages 上的版本試改；無法寫回，但可以下載修改後的頁面。</p>
        <div className="url-row">
          <select value={url} onChange={(e) => setUrl(e.target.value)} aria-label="網站">
            {SITES.map(([name, href]) => (
              <option key={href} value={href}>
                {name}
              </option>
            ))}
          </select>
          <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="網站網址" />
        </div>
        <Button size="3" variant="surface" disabled={p.busy || !/^https?:\/\//.test(url)} onClick={() => p.openUrl(url)}>
          讀取網址
        </Button>
      </section>
    </div>
  );
}
