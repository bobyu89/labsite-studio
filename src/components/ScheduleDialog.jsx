// 排程發布: pick a time; at that time the site's latest saved version goes
// live, as if 發布 had been pressed then (cloud/src/schedule.js, checked
// every 10 minutes). Shown from the 發布 dialog; cancelled from the bar.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { CalendarCheck } from "@phosphor-icons/react";
import { Modal } from "./ui";

const pad = (n) => String(n).padStart(2, "0");
const local = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const scheduleText = (t) =>
  new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(t);

export default function ScheduleDialog({ p, open, onClose }) {
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open) return;
    // Tomorrow at 9:00 by default.
    const d = new Date(Date.now() + 86400000);
    d.setHours(9, 0, 0, 0);
    setWhen(local(d));
    setError(null);
  }, [open]);
  const at = when ? new Date(when).getTime() : NaN;
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      if (p.anyDirty && !(await p.saveAll())) return;
      await p.cloudCalls.schedulePublish(p.cloudSite.id, at);
      await p.refreshCloud();
      p.notify(`已預約 ${scheduleText(at)} 發布。時間到了，最新存好的內容會自動上線。`);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="預約時間發布" description="時間到了，網站會自動更新成那時最新存好的內容。">
      <div className="schedule-dialog">
        <label className="field">
          <span>發布時間</span>
          <input type="datetime-local" value={when} min={local(Date.now() + 120000)} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <ul className="small-note schedule-notes">
          <li>系統每 10 分鐘檢查一次，最多晚 10 分鐘上線。</li>
          <li>預約之後還可以繼續修改，時間到時一起上線；不想要了，可以在上方按「取消預約」。</li>
          <li>時間到之前按「發布」，預約會自動取消。</li>
        </ul>
        {error && <p className="small-note error-text">{error}</p>}
        <div className="quick-add-actions">
          <Button size="3" color="orange" disabled={busy || !Number.isFinite(at) || at < Date.now() + 60000} onClick={go}>
            <CalendarCheck size={18} /> 預約在 {Number.isFinite(at) ? scheduleText(at) : "…"} 發布
          </Button>
        </div>
      </div>
    </Modal>
  );
}
