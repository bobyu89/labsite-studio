// GitHub 備份 (admin): the token that copies every saved version of each
// site to its GitHub repository. Same rules as the AI key: pasted once,
// tested before it is stored, then only its last four characters are shown.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";

const fmt = (t) => (t ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(t) : "");
const STATUS = { ok: "已備份到最新", partial: "備份中", error: "失敗", skipped: "沒有權杖，略過" };

export default function BackupSettings({ p, setConfirm }) {
  const [view, setView] = useState(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [repos, setRepos] = useState(null);
  useEffect(() => {
    p.cloudCalls.backupSettings().then(setView).catch((e) => setNote({ ok: false, text: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run = async (work) => {
    setBusy(true);
    setNote(null);
    try {
      await work();
    } catch (e) {
      setNote({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };
  const fromEnv = view?.source === "env";
  const test = (candidate) =>
    run(async () => {
      const r = await p.cloudCalls.testBackupToken(candidate || undefined);
      setRepos(r.repos);
      setNote(r.ok ? { ok: true, text: `權杖可以寫入所有網站的儲存庫（結尾 …${r.last4}）。` } : { ok: false, text: r.error || "有些儲存庫無法寫入，見下方。" });
      return r;
    });
  const save = () =>
    run(async () => {
      const candidate = token.trim();
      const r = await p.cloudCalls.testBackupToken(candidate);
      setRepos(r.repos);
      if (!r.ok) return setNote({ ok: false, text: (r.error || "這把權杖沒辦法寫入所有網站的儲存庫，見下方。") + " 權杖沒有儲存。" });
      setView(await p.cloudCalls.saveBackupToken(candidate));
      setToken("");
      setNote({ ok: true, text: `已儲存（結尾 …${r.last4}）。按「現在備份」或等整點後自動備份。` });
    });
  const backupNow = () =>
    run(async () => {
      const r = await p.cloudCalls.runBackup();
      setView(r.view);
      setNote({ ok: true, text: r.done.length ? "已執行備份，結果見下方。" : "沒有需要備份的網站。" });
    });
  const remove = () =>
    setConfirm({
      title: "移除 GitHub 備份權杖？",
      description: "之後網站的新版本不會再備份到 GitHub；已經備份的內容不受影響。",
      confirmLabel: "移除權杖",
      action: () => run(async () => setView(await p.cloudCalls.removeBackupToken())),
    });

  if (!view) return note ? <p className="error-text">{note.text}</p> : <p className="muted">正在讀取備份設定…</p>;
  return (
    <div className="settings-card">
      <section>
        <h2>GitHub 備份權杖</h2>
        {fromEnv ? (
          <p className="small-note">權杖由 Cloudflare 的 <code>GITHUB_BACKUP_TOKEN</code> 提供（結尾 …{view.last4}）。</p>
        ) : (
          <>
            <p className="settings-status">
              {view.configured ? (
                <>
                  目前的權杖結尾是 <strong>…{view.last4}</strong>。每個小時會把網站最新的版本備份到它的 GitHub 儲存庫。
                </>
              ) : (
                "還沒有權杖，所以網站只存在 LabSite（Cloudflare）一個地方。"
              )}
            </p>
            <label className="field">
              <span>{view.configured ? "新的權杖" : "權杖"}</span>
              <input type="password" value={token} autoComplete="off" spellCheck={false} placeholder="github_pat_…" onChange={(e) => setToken(e.target.value)} />
            </label>
            <p className="small-note">
              到 GitHub 的{" "}
              <a className="text-link" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">
                Fine-grained tokens
              </a>{" "}
              建立：Repository access 選各網站的儲存庫，Permissions 的 Contents 設為 Read and write。儲存前會先檢查每個儲存庫都寫得進去。
            </p>
          </>
        )}
        <div className="settings-actions">
          {!fromEnv && (
            <Button color="orange" disabled={busy || token.trim().length < 20} onClick={save}>
              {busy ? "處理中" : "儲存"}
            </Button>
          )}
          <Button variant="surface" color="gray" disabled={busy || (!view.configured && token.trim().length < 20)} onClick={() => test(token.trim())}>
            測試權杖
          </Button>
          {view.configured && (
            <Button variant="surface" color="gray" disabled={busy} onClick={backupNow}>
              現在備份
            </Button>
          )}
        </div>
        {note && (
          <p className={"settings-status " + (note.ok ? "settings-ok" : "error-text")} role="status">
            {note.text}
          </p>
        )}
        {repos && repos.length > 0 && (
          <ul className="settings-list">
            {repos.map((r) => (
              <li key={r.repo}>
                <code>{r.repo}</code> <span className={r.ok ? "settings-ok" : "error-text"}>{r.ok ? "可以寫入" : r.error}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>各網站的備份</h2>
        {view.sites.map((s) => (
          <div key={s.slug} className="settings-row">
            <span>
              {s.name}
              <span className="muted"> {s.repo ? s.repo : "沒有對應的 GitHub 儲存庫"}</span>
            </span>
            <span className={s.status === "error" ? "error-text" : "muted"}>
              {s.repo ? (STATUS[s.status] || "等待下一次備份") + (s.at ? "・" + fmt(s.at) : "") + (s.status === "error" && s.error ? "：" + s.error : "") : ""}
            </span>
          </div>
        ))}
      </section>
      {view.configured && !fromEnv && (
        <section className="settings-foot">
          <span>權杖只用來寫入備份，不會傳到任何人的瀏覽器。</span>
          <Button variant="surface" color="red" disabled={busy} onClick={remove}>
            移除權杖
          </Button>
        </section>
      )}
    </div>
  );
}
