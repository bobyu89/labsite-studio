// 學生與助理: a teacher invites the students and assistants of their own lab.
// They join as 學生、助理 (contributors: their changes wait for a teacher to
// publish). The one-time sign-in link is made here and sent by the teacher.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Copy, LinkSimple, Trash, UserPlus } from "@phosphor-icons/react";
import { Modal } from "./ui";

const when = (t) => new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(t);

export default function TeamDialog({ p, open, onClose, me }) {
  const siteId = p.cloudSite?.id;
  const [members, setMembers] = useState(null);
  const [max, setMax] = useState(40);
  const [email, setEmail] = useState("");
  const [links, setLinks] = useState({});
  const [copied, setCopied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open || !siteId) return;
    setError(null);
    setLinks({});
    p.cloudCalls
      .team(siteId)
      .then((r) => {
        setMembers(r.members);
        setMax(r.max);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, siteId]);
  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const add = (e) => {
    e.preventDefault();
    const who = email.trim().toLowerCase();
    if (!who) return;
    run(async () => {
      const r = await p.cloudCalls.addToTeam(siteId, who);
      setMembers(r.members);
      setEmail("");
      const link = await p.cloudCalls.teamLink(siteId, who).catch((err) => ({ error: err.message }));
      setLinks((l) => ({ ...l, [who]: link }));
    });
  };
  const makeLink = (who) =>
    run(async () => {
      const link = await p.cloudCalls.teamLink(siteId, who);
      setLinks((l) => ({ ...l, [who]: link }));
    });
  const remove = (who) =>
    run(async () => {
      const r = await p.cloudCalls.removeFromTeam(siteId, who);
      setMembers(r.members);
    });
  const copy = async (who, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(who);
    } catch {
      setCopied(null);
    }
  };
  const students = (members || []).filter((m) => m.role === "contributor");
  const teachers = (members || []).filter((m) => m.role !== "contributor");
  return (
    <Modal open={open} onClose={onClose} title="邀請學生與助理" description="加入的學生和助理可以修改網站，改完按「請老師發布」，由你看過後發布。" wide>
      <form className="team-add" onSubmit={add}>
        <label className="field">
          <span>學生或助理的 Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="例如 student@school.edu.tw" disabled={busy} />
        </label>
        <Button type="submit" color="orange" disabled={busy || !email.trim()}>
          <UserPlus size={16} /> 加入並產生登入連結
        </Button>
      </form>
      {error && <p className="small-note error-text">{error}</p>}
      {members === null && !error && <p className="muted">讀取中…</p>}
      {members && (
        <div className="team-list">
          <strong>學生與助理（{students.length}）</strong>
          {students.length === 0 && <p className="small-note">還沒有。用上面的欄位加入第一位。</p>}
          <ul>
            {students.map((m) => {
              const link = links[m.email];
              return (
                <li key={m.email}>
                  <div className="team-row">
                    <span>{m.email}</span>
                    <span className="team-actions">
                      <button type="button" className="text-link" disabled={busy} onClick={() => makeLink(m.email)}>
                        <LinkSimple size={14} /> {link?.url ? "重新產生連結" : "登入連結"}
                      </button>
                      <button type="button" className="text-link muted" disabled={busy} onClick={() => remove(m.email)} aria-label={"移除 " + m.email}>
                        <Trash size={14} /> 移除
                      </button>
                    </span>
                  </div>
                  {link?.url && (
                    <div className="team-link">
                      <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={"給 " + m.email + " 的登入連結"} />
                      <Button size="1" onClick={() => copy(m.email, link.url)}>
                        <Copy size={14} /> {copied === m.email ? "已複製" : "複製"}
                      </Button>
                      <span className="small-note">用 LINE 或 Email 傳給 {m.email}。只能用一次，{when(link.expiresAt)} 前有效；登入後請他按右上角「設定密碼」。</span>
                    </div>
                  )}
                  {link?.error && <p className="small-note error-text">{link.error}</p>}
                </li>
              );
            })}
          </ul>
          <strong>老師（{teachers.length}）</strong>
          {teachers.length === 0 && <p className="small-note">目前由管理者管理這個網站。</p>}
          <ul className="team-teachers">
            {teachers.map((m) => (
              <li key={m.email}>
                {m.email}
                {m.email === me && <span className="muted">（你）</span>}
              </li>
            ))}
          </ul>
          <p className="small-note">
            一個網站最多 {max} 位成員。學生畢業後請按「移除」。要加其他老師，或同一位學生要加入兩個研究室，請找管理者。
          </p>
        </div>
      )}
    </Modal>
  );
}
