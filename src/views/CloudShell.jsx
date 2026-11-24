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
  LinkSimple,
  Copy,
  SquaresFour,
} from "@phosphor-icons/react";
import { Field } from "../components/ui";
import Project from "./Project";
import UiSize from "../components/UiSize";
import DeviceLogin from "../components/DeviceLogin";
import AdminOverview from "../components/AdminOverview";
import { PasswordLoginForm, PasswordDialog, PasswordButton } from "../components/PasswordLogin";
import AiSettings from "../components/AiSettings";

const fmt = (t) => (t ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(t) : "");

// Makes a one-time sign-in link for an email and shows it ready to copy.
function InviteLink({ p, email, label = "登入連結" }) {
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const make = async () => {
    setError(null);
    setCopied(false);
    try {
      setLink(await p.cloudCalls.createInvite(email));
    } catch (e) {
      setError(e.message);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="invite-link">
      <Button size="1" variant="soft" onClick={make} disabled={!email}>
        <LinkSimple size={14} /> {link ? "重新產生" : label}
      </Button>
      {link && (
        <>
          <div className="invite-row">
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={"給 " + link.email + " 的登入連結"} />
            <Button size="1" onClick={copy}>
              <Copy size={14} /> {copied ? "已複製" : "複製"}
            </Button>
          </div>
          <span className="small-note">
            把連結傳給 {link.email}。只能用一次，{fmt(link.expiresAt)} 前有效。登入後持續使用不會被登出；換裝置時，老師可以自己按「其他裝置登入」。
          </span>
        </>
      )}
      {error && <span className="error-text small-note">{error}</span>}
    </div>
  );
}

function InviteCard({ p }) {
  const [email, setEmail] = useState("");
  return (
    <section className="open-card">
      <LinkSimple size={28} />
      <h3>產生登入連結</h3>
      <p>給任何一個 Email 一條一次性的登入連結，例如你自己在另一台電腦登入時用。要讓老師編輯網站，請在網站卡片的「成員」把他加入。</p>
      <input
        className="invite-email"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="要產生登入連結的 Email"
      />
      <InviteLink p={p} email={email.trim()} label="產生連結" />
    </section>
  );
}

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
            <div className="member-row">
              <span>{m.email}</span>
              <button
                className="icon-link"
                aria-label={"移除 " + m.email}
                disabled={busy}
                onClick={() => run(() => p.cloudCalls.removeMember(site.id, m.email))}
              >
                <Trash size={15} />
              </button>
            </div>
            {p.cloud.me.via !== "access" && <InviteLink p={p} email={m.email} />}
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
    <section className="site-row">
      <div className="site-row-main">
        <div className="site-row-text">
          <h3>{site.name}</h3>
          <p className={site.unpublished ? "site-row-state pending" : "site-row-state"}>
            {site.unpublished ? "有修改尚未發布，訪客看到的還是舊的" : "網站是最新的"}
            {site.url && (
              <>
                　・　
                <a href={site.url} target="_blank" rel="noreferrer">
                  {site.url.replace(/^https?:\/\//, "")}
                </a>
              </>
            )}
          </p>
          {admin && (
            <p className={"cloud-backup" + (backup.status === "error" ? " error-text" : "")}>
              <GithubLogo size={14} /> 備份{site.github ? "到 " + site.github : ""}：
              {backup.status === "ok"
                ? "已備份到最新（" + fmt(backup.at) + "）"
                : backup.status === "partial"
                  ? "備份中，" + backup.error
                  : backup.status === "error"
                    ? "失敗（" + backup.error + "）"
                    : backup.status === "skipped"
                      ? "還沒設定 GitHub 備份金鑰"
                      : "等待第一次備份（每小時自動檢查）"}
            </p>
          )}
        </div>
        <div className="button-row">
          {admin && (
            <Button size="3" variant="surface" color="gray" onClick={() => setManage(!manage)} aria-expanded={manage}>
              <UsersThree size={18} /> 成員
            </Button>
          )}
          <Button size="3" variant="surface" color="gray" asChild>
            <a href={p.cloudCalls.exportUrl(site.id, "published")} download title="下載整個網站的檔案">
              <DownloadSimple size={18} /> 下載
            </a>
          </Button>
          {site.url && (
            <Button size="3" variant="surface" color="gray" asChild>
              <a href={site.url} target="_blank" rel="noreferrer">
                <ArrowSquareOut size={18} /> 看網站
              </a>
            </Button>
          )}
          <Button size="3" onClick={() => p.openCloud(site)} disabled={p.busy}>
            <PencilSimple size={18} /> 修改
          </Button>
        </div>
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

// Starts a new lab site from one of the templates shipped with the editor.
function TemplateCard({ p }) {
  const [templates, setTemplates] = useState(null);
  const [form, setForm] = useState({ template: "", skin: "", slug: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const defaultSkin = (t) => (t?.skins || []).find((s) => s.current)?.id || t?.skins?.[0]?.id || "";
  useEffect(() => {
    fetch("/templates/index.json", { cache: "no-store" })
      .then((r) => (r.ok && (r.headers.get("Content-Type") || "").includes("json") ? r.json() : []))
      .then((list) => {
        setTemplates(list);
        if (list[0]) setForm((f) => (f.template ? f : { ...f, template: list[0].id, skin: defaultSkin(list[0]) }));
      })
      .catch(() => setTemplates([]));
  }, []);
  if (templates && !templates.length) return null;
  const chosen = templates?.find((t) => t.id === form.template);
  const skins = chosen?.skins || [];
  return (
    <section className="open-card cloud-import">
      <SquaresFour size={28} />
      <h3>從模板建立網站</h3>
      <p>用模板開一個新的研究室網站，內容先放範例文字，老師再自己改。建立後要按「發布」才會公開。</p>
      <form
        className="cloud-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const r = await p.cloudCalls.importSite({
              template: form.template,
              skin: form.skin || undefined,
              slug: form.slug.trim(),
              name: form.name.trim(),
            });
            await p.refreshCloud();
            setForm((f) => ({ ...f, slug: "", name: "" }));
            p.notify?.(`已用模板建立「${r.site.name}」，可以開始編輯了。`);
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>模板</span>
          <select
            value={form.template}
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, template: e.target.value, skin: defaultSkin(t) }));
            }}
            disabled={!templates}
          >
            {(templates || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {chosen?.description && skins.length <= 1 && <p className="small-note">{chosen.description}</p>}
        {skins.length > 1 && (
          <fieldset className="skin-choice">
            <legend>版型（之後可以在「外觀」分頁換）</legend>
            {skins.map((sk) => (
              <label key={sk.id} className={"skin-option" + (form.skin === sk.id ? " selected" : "")}>
                <input type="radio" name="skin" value={sk.id} checked={form.skin === sk.id} onChange={() => set("skin")(sk.id)} />
                <span>
                  <strong>{sk.name}</strong>
                  <small>{sk.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <Field label="研究室名稱" value={form.name} onChange={set("name")} placeholder="護理創新研究室" required />
        <Field label="網址代稱（小寫英文、數字、連字號）" value={form.slug} onChange={set("slug")} placeholder="nursing-innovation" required />
        <Button size="3" type="submit" disabled={busy || !form.template || !form.slug.trim() || !form.name.trim()}>
          {busy ? "建立中…" : "建立網站"}
        </Button>
      </form>
      {error && <span className="error-text small-note">{error}</span>}
    </section>
  );
}

function HomeTabs({ view, setView }) {
  return (
    <div className="segmented home-tabs" role="tablist" aria-label="首頁內容">
      {[
        ["sites", "網站"],
        ["overview", "總覽"],
      ].map(([id, label]) => (
        <button key={id} role="tab" aria-selected={view === id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function CloudHome({ p, onSetPassword, setConfirm }) {
  const me = p.cloud.me;
  const [view, setView] = useState("sites");
  if (me.admin && view === "ai") return <AiSettings p={p} onBack={() => setView("sites")} setConfirm={setConfirm} />;
  if (me.admin && view === "overview")
    return (
      <>
        <div className="page-heading compact home-heading">
          <div>
            <h1>總覽</h1>
            <p>所有網站的狀態、誰可以編輯、最近發生了什麼。只有管理者看得到。</p>
          </div>
          <HomeTabs view={view} setView={setView} />
        </div>
        <AdminOverview p={p} />
      </>
    );
  return (
    <>
      <div className="page-heading compact home-heading">
        <div>
          <h1>我的網站</h1>
          <p>
            選一個網站開始修改。修改會自動存成草稿；按「發布」後，網站才會更新給所有人看。第一次使用？請看
            <a className="text-link" href="/manual.html" target="_blank" rel="noopener">
              操作手冊
            </a>
            。
          </p>
        </div>
        {me.admin && <HomeTabs view={view} setView={setView} />}
      </div>
      {me.via === "session" && !me.hasPassword && (
        <div className="message password-nudge" role="status">
          <span>
            <strong>設定一組密碼</strong>，之後換電腦或用手機，只要輸入 Email 和密碼就能登入。
          </span>
          <Button size="2" onClick={onSetPassword}>
            設定密碼
          </Button>
        </div>
      )}
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
      <div className="site-list">
        {me.sites.map((s) => (
          <SiteCard key={s.id} p={p} site={s} admin={me.admin} />
        ))}
        {me.sites.length === 0 && me.admin && <p className="muted site-list-empty">還沒有網站。用下面的「新增網站」建立第一個。</p>}
      </div>
      {me.admin && (
        <section className="admin-tools">
          <h2>管理者</h2>
          <button type="button" className="admin-link" onClick={() => setView("ai")}>
            <span>AI 助手設定</span>
            <span className="muted">{me.ai ? "已開啟" : "尚未設定金鑰"}</span>
          </button>
          <details>
            <summary>新增網站（用模板）</summary>
            <TemplateCard p={p} />
          </details>
          <details>
            <summary>從 GitHub 匯入網站</summary>
            <ImportCard p={p} />
          </details>
          {me.via !== "access" && (
            <details>
              <summary>產生登入連結</summary>
              <InviteCard p={p} />
            </details>
          )}
        </section>
      )}
    </>
  );
}

export default function CloudShell({ p, notice, setNotice, device, setDevice }) {
  const [confirm, setConfirm] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const me = p.cloud.me;
  const signedOut = p.cloud.status === "signed-out";
  return (
    <div className="app-shell cloud-shell">
      <header className="topbar cloud-topbar">
        <a
          className="brand"
          href="/"
          onClick={async (e) => {
            e.preventDefault();
            if (!p.project) return;
            // Cloud sites store what was typed first; only unsaved looks still need a decision.
            const auto = p.autosave;
            const stored = auto.on && auto.pending ? await p.flushAutosave() : true;
            const left = auto.on ? !stored || !!p.textSize?.dirty : p.anyDirty;
            if (left)
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
            <UiSize />
            {me.via === "session" && <PasswordButton hasPassword={me.hasPassword} onClick={() => setPasswordOpen(true)} />}
            {me.via !== "access" && <DeviceLogin p={p} />}
            <span>{me.email}</span>
            {me.admin && (
              <Badge variant="soft" color="gray">
                管理者
              </Badge>
            )}
            <button
              className="icon-link"
              aria-label="登出"
              title="登出"
              onClick={async () => {
                if (me.via === "access") return void (location.href = "/cdn-cgi/access/logout");
                try {
                  await p.cloudCalls.logout();
                } finally {
                  location.reload();
                }
              }}
            >
              <SignOut size={19} />
            </button>
          </div>
        )}
      </header>
      <main id="main" tabIndex={-1} className={"main-content " + (p.project ? "editor-main" : "")}>
        {signedOut ? (
          <div className="signed-out">
            <h1>登入</h1>
            <p className="signed-out-lead">用 Email 和密碼登入，修改自己研究室的網站。</p>
            {p.cloud.error && p.cloud.error !== "請先登入。" && (
              <div className="message error" role="alert">
                <WarningCircle size={20} />
                <span>{p.cloud.error}</span>
              </div>
            )}
            <PasswordLoginForm
              onLogin={async (email, password) => {
                await p.cloudCalls.passwordLogin(email, password);
                location.reload();
              }}
            />
            <div className="signed-out-help">
              <p>
                <strong>第一次使用、還沒設定密碼，或忘記密碼？</strong>請打開管理者傳給你的登入連結，登入後按右上角「設定密碼」。
              </p>
              <p>
                <strong>另一台裝置已經登入？</strong>在那台裝置按右上角「其他裝置登入」，用這台的相機掃 QR code 也可以。
              </p>
            </div>
          </div>
        ) : p.project ? (
          <Project p={p} device={device} setDevice={setDevice} setConfirm={setConfirm} />
        ) : (
          <CloudHome p={{ ...p, notify: setNotice }} onSetPassword={() => setPasswordOpen(true)} setConfirm={setConfirm} />
        )}
      </main>
      {me && <PasswordDialog p={p} open={passwordOpen} onClose={() => setPasswordOpen(false)} />}
      <AlertDialog.Root open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialog.Content maxWidth="460px">
          <AlertDialog.Title>{confirm?.title}</AlertDialog.Title>
          <AlertDialog.Description>{confirm?.description}</AlertDialog.Description>
          {confirm?.body}
          <div className="dialog-actions">
            <AlertDialog.Cancel>
              <Button variant="surface" color="gray">
                {confirm?.cancelLabel || "取消"}
              </Button>
            </AlertDialog.Cancel>
            <Button
              color={confirm?.confirmColor}
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
