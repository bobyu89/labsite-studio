// 今天想改什麼？ — the first thing a teacher sees when opening a site: a few
// big buttons that go straight to the usual jobs, the state of the site in
// one line, and the way to the full editor. Can be skipped for good.
import React from "react";
import { X } from "@phosphor-icons/react";

const SKIP_KEY = "labsite.start.skip";
export function startSkipped() {
  try {
    return localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}
function setSkipped(on) {
  try {
    if (on) localStorage.setItem(SKIP_KEY, "1");
    else localStorage.removeItem(SKIP_KEY);
  } catch {
    /* private window */
  }
}

// tiles: [{ id, icon, title, text, run, tone? }]
export default function StartScreen({ siteName, status, notices = [], tiles, onClose, onTour }) {
  const [skip, setSkip] = React.useState(startSkipped());
  return (
    <div className="start-screen" role="dialog" aria-modal="true" aria-labelledby="start-title">
      <div className="start-card">
        <button type="button" className="start-x" aria-label="直接進入編輯畫面" onClick={onClose}>
          <X size={20} />
        </button>
        <p className="start-site">{siteName}</p>
        <h2 id="start-title">今天想改什麼？</h2>
        {status && <p className="start-status">{status}</p>}
        {notices.length > 0 && (
          <ul className="start-notices">
            {notices.map((n) => (
              <li key={n.id}>
                <button type="button" className="text-link" onClick={n.run}>
                  {n.text}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="start-tiles">
          {tiles.map((t) => (
            <button key={t.id} type="button" className={"start-tile" + (t.tone ? " " + t.tone : "")} onClick={t.run}>
              <span className="start-icon" aria-hidden="true">
                {t.icon}
              </span>
              <strong>{t.title}</strong>
              <span>{t.text}</span>
            </button>
          ))}
        </div>
        <div className="start-foot">
          <button type="button" className="text-link" onClick={onClose}>
            我要自己找，直接進入編輯畫面 →
          </button>
          {onTour && (
            <button type="button" className="text-link muted" onClick={onTour}>
              再看一次新手步驟
            </button>
          )}
          <label className="start-skip">
            <input
              type="checkbox"
              checked={skip}
              onChange={(e) => {
                setSkip(e.target.checked);
                setSkipped(e.target.checked);
              }}
            />
            下次直接進入編輯畫面（上方的「今天想改什麼」隨時可以再打開）
          </label>
        </div>
      </div>
    </div>
  );
}
