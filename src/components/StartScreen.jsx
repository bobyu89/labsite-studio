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

// 新手畫面: the first few times only the most used jobs are shown; the rest
// wait behind 更多功能 (remembered once opened).
const FULL_KEY = "labsite.start.full";
const OPENS_KEY = "labsite.start.opens";
export const CORE_TILES = ["import", "home", "news", "photos", "pub", "members"];
// When a site has no news, papers … the rest of the six come from these.
const FILL_TILES = ["health", "site", "ai", "autofix"];
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private window */
    }
  },
};
// Called once per opened site: after five visits everything is shown.
export function countStartOpen() {
  const n = Number(store.get(OPENS_KEY) || 0) + 1;
  store.set(OPENS_KEY, String(n));
  if (n >= 5) store.set(FULL_KEY, "1");
}

// tiles: [{ id, icon, title, text, run, tone? }]
// first: { steps: [{ id, title, text, done, actions: [{ label, run, primary? }] }] } — 第一次使用
export default function StartScreen({ siteName, status, notices = [], tiles, onClose, onTour, first }) {
  const [skip, setSkip] = React.useState(startSkipped());
  const [full, setFull] = React.useState(() => store.get(FULL_KEY) === "1");
  const core = [...tiles.filter((t) => CORE_TILES.includes(t.id)), ...FILL_TILES.map((id) => tiles.find((t) => t.id === id)).filter(Boolean)].slice(0, 6);
  const shown = full || core.length < 4 ? tiles : core;
  const hidden = tiles.length - shown.length;
  const firstLeft = first ? first.steps.filter((x) => !x.done).length : 0;
  return (
    <div className="start-screen" role="dialog" aria-modal="true" aria-labelledby="start-title">
      <div className="start-card">
        <button type="button" className="start-x" aria-label="直接進入編輯畫面" onClick={onClose}>
          <X size={20} />
        </button>
        <p className="start-site">{siteName}</p>
        <h2 id="start-title">{first && firstLeft > 0 ? "歡迎！三個步驟開始" : "今天想改什麼？"}</h2>
        {first && firstLeft > 0 && (
          <ol className="first-steps">
            {first.steps.map((x, i) => (
              <li key={x.id} className={x.done ? "done" : first.steps.findIndex((y) => !y.done) === i ? "now" : ""}>
                <span className="first-num" aria-hidden="true">
                  {x.done ? "✓" : i + 1}
                </span>
                <div>
                  <strong>{x.title}</strong>
                  <span>{x.done ? x.doneText || "完成了" : x.text}</span>
                  {!x.done && (
                    <span className="first-actions">
                      {x.actions.map((a) => (
                        <button key={a.label} type="button" className={a.primary ? "first-primary" : "text-link"} onClick={a.run}>
                          {a.label}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        {first && firstLeft > 0 && <p className="start-more-title">或直接做這些：</p>}
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
          {shown.map((t) => (
            <button key={t.id} type="button" className={"start-tile" + (t.tone ? " " + t.tone : "")} onClick={t.run}>
              <span className="start-icon" aria-hidden="true">
                {t.icon}
              </span>
              <strong>{t.title}</strong>
              <span>{t.text}</span>
            </button>
          ))}
        </div>
        {hidden > 0 && (
          <button
            type="button"
            className="start-more"
            onClick={() => {
              setFull(true);
              store.set(FULL_KEY, "1");
            }}
          >
            更多功能（還有 {hidden} 個）
          </button>
        )}
        {full && core.length >= 4 && tiles.length > core.length && (
          <button
            type="button"
            className="text-link muted start-less"
            onClick={() => {
              setFull(false);
              store.set(FULL_KEY, "0");
            }}
          >
            只顯示常用的
          </button>
        )}
        <div className="start-foot">
          <button type="button" className="text-link" onClick={onClose}>
            我要自己找，直接進入編輯畫面 →
          </button>
          {onTour && (
            <button type="button" className="text-link muted" onClick={onTour}>
              看看各個按鈕在哪裡
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
