// 研究室檔案: the lab in its own words (labProfile.js). Every AI request
// reads it, so the assistant, 活動快報 and 網站體檢 write for this lab.
// Teachers edit it; students and assistants can read it.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Modal } from "./ui";
import { PROFILE_FIELDS } from "../site/labProfile.js";
import { STYLE_PACKS } from "../site/stylePacks.js";

export default function LabProfile({ p, open, onClose, canEdit }) {
  const siteId = p.cloudSite?.id;
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!open || !siteId) return;
    setError(null);
    setSaved(false);
    setProfile(null);
    p.cloudCalls
      .getLab(siteId)
      .then((r) => setProfile(r.profile || {}))
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, siteId]);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await p.cloudCalls.setLab(siteId, profile);
      setProfile(r.profile);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (key) => (e) => {
    setSaved(false);
    setProfile((x) => ({ ...x, [key]: e.target.value }));
  };
  return (
    <Modal open={open} onClose={onClose} title="研究室檔案" description="AI 每次幫忙寫字、改字、做體檢之前都會先讀這裡，照你們研究室的語氣和用詞來寫。" wide>
      {!profile ? (
        <p className="muted">{error || "讀取中…"}</p>
      ) : (
        <div className="lab-profile">
          {PROFILE_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span>{f.label}</span>
              {f.max > 130 ? (
                <textarea rows={2} value={profile[f.key] || ""} maxLength={f.max} placeholder={f.hint} disabled={!canEdit} onChange={set(f.key)} />
              ) : (
                <input value={profile[f.key] || ""} maxLength={f.max} placeholder={f.hint} disabled={!canEdit} onChange={set(f.key)} />
              )}
            </label>
          ))}
          <label className="field">
            <span>風格包</span>
            <select value={profile.pack || ""} disabled={!canEdit} onChange={set("pack")}>
              <option value="">（沒有指定）</option>
              {STYLE_PACKS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}：{x.fits}
                </option>
              ))}
            </select>
          </label>
          <p className="small-note">風格包在這裡只告訴 AI 用哪一種語氣；要換網站的外觀，請用「外觀」。</p>
          {error && <p className="small-note error-text">{error}</p>}
          {canEdit ? (
            <div className="lab-profile-actions">
              <Button color="orange" disabled={busy} onClick={save}>
                {busy ? "儲存中…" : "儲存研究室檔案"}
              </Button>
              {saved && <span className="small-note">已儲存。之後的 AI 建議都會照這份檔案寫。</span>}
            </div>
          ) : (
            <p className="small-note">只有老師可以修改研究室檔案。</p>
          )}
        </div>
      )}
    </Modal>
  );
}
