// 新手步驟: the first time, the editor is shown one part at a time — the
// part is lit, the rest dimmed, with a sentence on what it is for.
// steps: [{ selector, title, text }]; a step whose part is not on screen is skipped.
import React, { useEffect, useLayoutEffect, useState } from "react";

const TOUR_KEY = "labsite.tour.v1";
export function tourDone() {
  try {
    return localStorage.getItem(TOUR_KEY) === "done";
  } catch {
    return true;
  }
}
function markDone() {
  try {
    localStorage.setItem(TOUR_KEY, "done");
  } catch {
    /* private window */
  }
}
// "a, b": the first selector that finds something, in the order written.
const find = (selector) =>
  selector
    .split(",")
    .map((x) => document.querySelector(x.trim()))
    .find(Boolean) || null;
// The editor's text size (大／特大) zooms <body>; fixed positions are in CSS pixels.
const zoom = () => ({ large: 1.12, xlarge: 1.25 })[document.documentElement.dataset.uiSize] || 1;

export default function Tour({ steps, onDone }) {
  const visible = steps.filter((s) => find(s.selector));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = visible[i];

  useLayoutEffect(() => {
    if (!step) return;
    const el = find(step.selector);
    el?.scrollIntoView?.({ block: "nearest" });
    const measure = () => {
      const r = el?.getBoundingClientRect();
      if (!r) return setRect(null);
      const z = zoom();
      setRect({ top: r.top / z, left: r.left / z, width: r.width / z, height: r.height / z });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [i, step?.selector]);

  const finish = () => {
    markDone();
    onDone();
  };
  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, visible.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  if (!step || !rect) return null;
  const vw = window.innerWidth / zoom();
  const vh = window.innerHeight / zoom();
  const pad = 6;
  // The note goes where there is room: below, above, then beside.
  const below = rect.top + rect.height + 190 < vh;
  const above = rect.top > 200;
  const width = Math.min(340, vw - 32);
  const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), vw - width - 16);
  const pos = below
    ? { top: rect.top + rect.height + 14, left }
    : above
      ? { top: rect.top - 14, left, transform: "translateY(-100%)" }
      : { top: Math.min(Math.max(16, rect.top + 20), vh - 220), left: rect.left + rect.width + 16 + width < vw ? rect.left + rect.width + 16 : Math.max(16, rect.left - width - 16) };
  const last = i === visible.length - 1;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-hole" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      <div className="tour-note" style={{ ...pos, width }}>
        <p className="tour-count">
          新手步驟 {i + 1}／{visible.length}
        </p>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-actions">
          <button type="button" className="text-link muted" onClick={finish}>
            跳過
          </button>
          <span />
          {i > 0 && (
            <button type="button" className="tour-back" onClick={() => setI(i - 1)}>
              上一步
            </button>
          )}
          <button type="button" className="tour-next" onClick={() => (last ? finish() : setI(i + 1))} autoFocus>
            {last ? "開始修改" : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}
