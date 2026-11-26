// 草稿分享連結: let a co-investigator or the head of department look at the
// unpublished site without an account. Links expire, and can be taken back.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Copy, LinkSimple } from "@phosphor-icons/react";
import { Modal } from "./ui";

const when = (t) => new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(t);

export default function ShareDraft({ p, open, onClose }) {
  const siteId = p.cloudSite?.id;
  const [links, setLinks] = useState(null);
  const [days, setDays] = useState(7);
  const [snapshot, setSnapshot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const load = () =>
    p.cloudCalls
      .previewLinks(siteId)
      .then((r) => setLinks(r.links))
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (open && siteId) {
      setError(null);
      setCopied(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, siteId]);

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      if (p.anyDirty && !(await p.saveAll())) return;
      const { link } = await p.cloudCalls.makePreviewLink(siteId, days, snapshot);
      await load();
      copy(link);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(link.token);
    } catch {
      setCopied(null);
    }
  };
  const revoke = async (link) => {
    await p.cloudCalls.revokePreviewLink(siteId, link.token).catch((e) => setError(e.message));
    load();
  };
  const active = (links || []).filter((l) => l.active);

  return (
    <Modal open={open} onClose={onClose} title="分享草稿" description="給還沒有帳號的人看還沒發布的網站，例如共同主持人或系主任。對方只能看，不能改。">
      <div className="share-draft">
        <div className="share-options">
          <label className="field">
            <span>連結有效</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {d} 天
                </option>
              ))}
            </select>
          </label>
          <fieldset className="share-mode">
            <legend>對方看到的是</legend>
            <label>
              <input type="radio" checked={!snapshot} onChange={() => setSnapshot(false)} /> 最新的草稿（之後再改，對方重新整理就看到）
            </label>
            <label>
              <input type="radio" checked={snapshot} onChange={() => setSnapshot(true)} /> 固定在現在這個版本
            </label>
          </fieldset>
        </div>
        <Button size="3" color="orange" disabled={busy} onClick={make}>
          <LinkSimple size={18} /> {busy ? "產生中…" : "產生連結並複製"}
        </Button>
        {error && <p className="small-note error-text">{error}</p>}
        {active.length > 0 && (
          <div className="share-list">
            <strong>目前有效的連結</strong>
            <ul>
              {active.map((l) => (
                <li key={l.token}>
                  <code>{l.url}</code>
                  <span className="muted">
                    {l.snapshot ? "固定版本" : "最新草稿"} · {l.by.split("@")[0]} 建立 · {when(l.expires)} 到期
                  </span>
                  <span className="share-actions">
                    <button type="button" className="text-link" onClick={() => copy(l)}>
                      <Copy size={14} /> {copied === l.token ? "已複製" : "複製"}
                    </button>
                    <button type="button" className="text-link muted" onClick={() => revoke(l)}>
                      收回
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="small-note">拿到連結的人都看得到，請只傳給需要的人。網頁下方會標示「草稿預覽」，搜尋引擎也不會收錄。</p>
      </div>
    </Modal>
  );
}
