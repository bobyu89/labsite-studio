// The whole app when served by LabSite Cloud: no demo workspace, no folder or
// GitHub options — a teacher signs in, sees their sites, edits, publishes.
import React, { useEffect, useState } from "react";
import { Button, Badge, AlertDialog } from "@radix-ui/themes";
import {
  Stack,
  CheckCircle,
  X,
  WarningCircle,
  ArrowSquareOut,
  PencilSimple,
  SignOut,
  UsersThree,
  DownloadSimple,
  GithubLogo,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { Field } from "../components/ui";
import Project from "./Project";

const fmt = (t) => (t ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(t) : "");

function Members({ p, site }) {
  const [members, setMembers] = useState(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    p.cloudCalls
      .site(site.id)
      .then((d) => setMembers(d.members || []))
      .catch((e) => setError(e.message));
  }, [site.id]);
  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      setMembers((await fn()).members);
      setEmail("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cloud-members">
      <strong>
        <UsersThree size={16} /> 可以編輯的人
      </strong>
      {members === null && !error && <span className="small-note">讀取中…</span>}
      {members?.length === 0 && <span className="small-note">還沒有成員；只有管理者能編輯。</span>}
      <ul>
        {members?.map((m) => (
          <li key={m.email}>
            <span>{m.email}</span>
            <button
              className="icon-link"
              aria-label={"移除 " + m.email}
              disabled={busy}
              onClick={() => run(() => p.cloudCalls.removeMember(site.id, m.email))}
            >
              <Trash size={15} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="cloud-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) run(() => p.cloudCalls.addMember(site.id, email.trim()));
        }}
      >
        <input type="email" placeholder="老師的 Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="新增成員 Email" />
        <Button size="1" type="submit" disabled={busy || !email.trim()}>
          <Plus size={14} /> 加入
        </Button>
      </form>
      {error && <span className="error-text small-note">{error}</span>}
    </div>
  );
}

function SiteCard({ p, site, admin }) {
  const [manage, setManage] = useState(false);
  const backup = site.backup || {};
  return (
    <section className="open-card cloud-site">
      <div className="cloud-site-head">
        <h3>{site.name}</h3>
        {site.unpublished ? (
          <Badge color="amber" variant="soft">
            有尚未發布的修改
          </Badge>
        ) : (
          <Badge color="teal" variant="soft">
            已發布
          </Badge>
        )}
      </div>
      {site.url && (
        <a className="cloud-site-url" href={site.url} target="_blank" rel="noreferrer">
          {site.url.replace(/^https?:\/\//, "")} <ArrowSquareOut size={13} />
        </a>
      )}
      {admin && site.github && (
        <p className="cloud-backup">
          <GithubLogo size={14} /> 備份到 {site.github}：
          {backup.status === "ok"
            ? "最新 " + fmt(backup.at)
            : backup.status === "error"
              ? "失敗（" + backup.error + "）"
              : backup.status === "too_many"
                ? backup.error
                : backup.status === "skipped"
                  ? "未設定備份 token"
                  : "尚未備份過"}
        </p>
      )}
      <div className="button-row">
        <Button size="3" onClick={() => p.openCloud(site)} disabled={p.busy}>
          <PencilSimple size={18} /> 開啟編輯
        </Button>
        <Button size="3" variant="surface" asChild>
          <a href={p.cloudCalls.exportUrl(site.id, "published")} download>
            <DownloadSimple size={18} /> 下載整站
          </a>
        </Button>
        {admin && (
          <Button size="3" variant="ghost" onClick={() => setManage(!manage)}>
            <UsersThree size={18} /> 成員
          </Button>
        )}
      </div>
      {admin && manage && <Members p={p} site={site} />}
    </section>
  );
}

function ImportCard({ p }) {
  const [form, setForm] = useState({ github: "", slug: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const guess = (repo) => (repo.split("/").pop() || "").replace(/\.git$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return (
    <section className="open-card cloud-import">
      <GithubLogo size={28} />
      <h3>從 GitHub 匯入網站</h3>
      <p>把整個儲存庫複製進雲端，之後老師直接在這裡編輯與發布；每次發布會自動備份回這個儲存庫。</p>
      <form
        className="cloud-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const r = await p.cloudCalls.importSite({
              github: form.github,
              slug: form.slug || guess(form.github),
              name: form.name || guess(form.github),
            });
            await p.refreshCloud();
            setForm({ github: "", slug: "", name: "" });
            p.notify?.(`已匯入「${r.site.name}」，共 ${r.files} 個檔案。`);
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="GitHub 儲存庫" value={form.github} onChange={set("github")} placeholder="bobyu89/sung-lab-website" required />
        <Field label="網址代稱（小寫英文、數字、連字號）" value={form.slug} onChange={set("slug")} placeholder={guess(form.github) || "sung-lab"} />
        <Field label="網站名稱" value={form.name} onChange={set("name")} placeholder="宋建美老師研究室" />
        <Button size="3" type="submit" disabled={busy || !form.github.trim()}>
          {busy ? "匯入中…" : "匯入"}
        </Button>
      </form>
      {error && <span className="error-text small-note">{error}</span>}
    </section>
  );
}

function CloudHome({ p }) {
  const me = p.cloud.me;
  return (
    <>
      <div className="page-heading compact">
        <div>
          <h1>我的網站</h1>
          <p>選一個網站開始編輯。保存會留下版本紀錄；按「發布」後，網站才會更新給所有人看。</p>
        </div>
      </div>
      {p.error && (
        <div className="message error" role="alert">
          <WarningCircle size={20} />
          <span>{p.error}</span>
          <button onClick={() => p.setError(null)}>關閉</button>
        </div>
      )}
      {me.sites.length === 0 && !me.admin && (
        <div className="message" role="status">
          <WarningCircle size={20} />
          <span>你的帳號（{me.email}）還沒有被加入任何網站，請聯絡管理者把你加入。</span>
        </div>
      )}
      <div className="open-grid cloud-grid">
        {me.sites.map((s) => (
          <SiteCard key={s.id} p={p} site={s} admin={me.admin} />
        ))}
        {me.admin && <ImportCard p={p} />}
      </div>
    </>
  );
}

export default function CloudShell({ p, notice, setNotice, device, setDevice }) {
  const [confirm, setConfirm] = useState(null);
  const me = p.cloud.me;
  const signedOut = p.cloud.status === "signed-out";
  return (
    <div className="app-shell cloud-shell">
      <header className="topbar cloud-topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            if (!p.project) return;
            if (p.anyDirty)
              setConfirm({
                title: "回到網站列表？",
                description: "有尚未保存的修改，離開後會遺失。",
                action: p.closeProject,
              });
            else p.closeProject();
          }}
        >
          <span className="brand-mark">
            <Stack size={24} weight="bold" />
          </span>
          <span>
            LabSite<span className="brand-studio">STUDIO</span>
          </span>
        </a>
        {me && (
          <div className="cloud-user">
            <span>{me.email}</span>
            {me.admin && (
              <Badge variant="soft" color="gray">
                管理者
              </Badge>
            )}
            <a className="icon-link" href="/cdn-cgi/access/logout" aria-label="登出" title="登出">
              <SignOut size={19} />
            </a>
          </div>
        )}
      </header>
      <main id="main" tabIndex={-1} className={"main-content " + (p.project ? "editor-main" : "")}>
        {signedOut ? (
          <div className="message error" role="alert">
            <WarningCircle size={20} />
            <span>{p.cloud.error} 請重新整理頁面；如果一直看到這個訊息，代表登入服務還沒設定好，請聯絡管理者。</span>
          </div>
        ) : p.project ? (
          <Project p={p} device={device} setDevice={setDevice} setConfirm={setConfirm} />
        ) : (
          <CloudHome p={{ ...p, notify: setNotice }} />
        )}
      </main>
      <AlertDialog.Root open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialog.Content maxWidth="460px">
          <AlertDialog.Title>{confirm?.title}</AlertDialog.Title>
          <AlertDialog.Description>{confirm?.description}</AlertDialog.Description>
          <div className="dialog-actions">
            <AlertDialog.Cancel>
              <Button variant="surface">取消</Button>
            </AlertDialog.Cancel>
            <Button
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              {confirm?.confirmLabel || "確認"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Root>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle size={21} />
          {notice}
          <button aria-label="關閉通知" onClick={() => setNotice("")}>
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
