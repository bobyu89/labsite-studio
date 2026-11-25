// The assistant lives in its own floating window, apart from the editing
// columns: a small 「助手」 button in the corner opens it, and the header can
// be dragged anywhere on screen. Closing only hides the window, so the
// conversation is still there when it is opened again.
import React, { useEffect, useRef, useState } from "react";
import { Minus } from "@phosphor-icons/react";

const POS_KEY = "labsite.assistant.pos";
const readPos = () => {
  try {
    const v = JSON.parse(localStorage.getItem(POS_KEY) || "null");
    return v && Number.isFinite(v.dx) && Number.isFinite(v.dy) ? v : { dx: 0, dy: 0 };
  } catch {
    return { dx: 0, dy: 0 };
  }
};
const savePos = (v) => {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(v));
  } catch {
    /* private window */
  }
};
// The editor's text size (標準／大／特大) zooms <body>; pointer movement is in
// screen pixels, the window's offset in CSS pixels.
const zoom = () => ({ large: 1.12, xlarge: 1.25 })[document.documentElement.dataset.uiSize] || 1;

export default function AssistantDock({ open, onOpen, onClose, where, children }) {
  const win = useRef(null);
  const [pos, setPos] = useState(readPos);
  const drag = useRef(null);

  // Keep the header on screen after a drag or a window resize.
  const settle = (next) => {
    const el = win.current;
    if (!el) return next;
    const r = el.getBoundingClientRect();
    const z = zoom();
    let { dx, dy } = next;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (r.left < 8) dx += (8 - r.left) / z;
    if (r.right > vw - 8) dx -= (r.right - vw + 8) / z;
    if (r.top < 8) dy += (8 - r.top) / z;
    if (r.top > vh - 48) dy -= (r.top - vh + 48) / z;
    return { dx: Math.round(dx), dy: Math.round(dy) };
  };

  useEffect(() => {
    if (!open) return;
    const fix = () => setPos((p) => settle(p));
    fix();
    window.addEventListener("resize", fix);
    return () => window.removeEventListener("resize", fix);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => win.current?.querySelector(".ai-form-box textarea")?.focus(), 30);
  }, [open]);

  const onDown = (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, start: pos };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const z = zoom();
    setPos({ dx: d.start.dx + (e.clientX - d.x) / z, dy: d.start.dy + (e.clientY - d.y) / z });
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setPos((p) => {
      const next = settle(p);
      savePos(next);
      return next;
    });
  };
  const reset = () => {
    setPos({ dx: 0, dy: 0 });
    savePos({ dx: 0, dy: 0 });
  };

  return (
    <>
      {!open && (
        <button type="button" className="ai-launcher" onClick={onOpen} title="打開助手">
          <span className="ai-launcher-dot" aria-hidden="true" />
          助手
        </button>
      )}
      <section
        ref={win}
        className="ai-dock"
        hidden={!open}
        role="dialog"
        aria-label="助手"
        tabIndex={-1}
        style={{ transform: `translate(${pos.dx}px, ${pos.dy}px)` }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !e.nativeEvent.isComposing) onClose();
        }}
      >
        <header className="ai-dock-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={reset} title="拖曳可移動；按兩下回到原位">
          <div>
            <strong>助手</strong>
            {where && <span className="ai-dock-where">正在看：{where}</span>}
          </div>
          <button type="button" className="ai-dock-close" onClick={onClose} aria-label="收起助手" title="收起（Esc）">
            <Minus size={16} />
          </button>
        </header>
        {children}
      </section>
    </>
  );
}
