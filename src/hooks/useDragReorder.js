import { useRef, useState } from "react";

// Pointer-based reordering for a vertical list or, with { grid: true }, a
// wrapping grid of tiles (mouse, pen, touch). Rows are found with `[data-row]`
// inside `listRef`. The move fires exactly once on release; state only drives
// the drop indicator. With { hold: true } a finger has to rest on the item
// for a moment before it drags, so the list can still be scrolled on a phone.
const HOLD_MS = 380;
export function useDragReorder(listRef, onMove, { grid = false, hold = false } = {}) {
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const update = (next) => {
    dragRef.current = next;
    setDrag(next);
  };
  function start(e, index) {
    if (e.button !== undefined && e.button !== 0) return;
    if (hold && e.pointerType === "touch") return startAfterHold(e, index);
    e.preventDefault();
    begin(e.currentTarget, e.pointerId, index);
  }
  // Touch: drag only after the finger stays put for HOLD_MS; moving earlier scrolls.
  function startAfterHold(e, index) {
    const target = e.currentTarget;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const cancel = () => {
      clearTimeout(timer);
      target.removeEventListener("pointermove", moved);
      target.removeEventListener("pointerup", cancel);
      target.removeEventListener("pointercancel", cancel);
    };
    const moved = (ev) => Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10 && cancel();
    const timer = setTimeout(() => {
      cancel();
      navigator.vibrate?.(15);
      const noScroll = (ev) => ev.preventDefault();
      target.addEventListener("touchmove", noScroll, { passive: false });
      begin(target, e.pointerId, index, () => target.removeEventListener("touchmove", noScroll));
    }, HOLD_MS);
    target.addEventListener("pointermove", moved);
    target.addEventListener("pointerup", cancel);
    target.addEventListener("pointercancel", cancel);
  }
  function begin(target, pointerId, index, done) {
    try {
      target.setPointerCapture?.(pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
    update({ from: index, over: index });
    const rows = () => [...listRef.current.querySelectorAll(":scope [data-row]")].filter((r) => r.closest("[data-list]") === listRef.current);
    // Grid: the slot before or after the tile under the pointer (or nearest).
    const overAtGrid = (x, y) => {
      const list = rows();
      let best = null;
      list.forEach((row, i) => {
        const r = row.getBoundingClientRect();
        const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        const d = inside ? -1 : Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (!best || d < best.d) best = { d, slot: x < r.left + r.width / 2 ? i : i + 1 };
      });
      return best ? best.slot : 0;
    };
    const overAt = (y, x) => {
      if (grid) return overAtGrid(x, y);
      const list = rows();
      let over = list.length;
      list.some((row, i) => {
        const r = row.getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          over = i;
          return true;
        }
        return false;
      });
      return over;
    };
    const move = (ev) => {
      if (dragRef.current) update({ ...dragRef.current, over: overAt(ev.clientY, ev.clientX) });
    };
    const end = (ev) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      done?.();
      const d = dragRef.current;
      update(null);
      if (!d) return;
      const slot = ev.type === "pointerup" && Number.isFinite(ev.clientY) ? overAt(ev.clientY, ev.clientX) : d.over;
      if (slot !== d.from) {
        const to = slot > d.from ? slot - 1 : slot;
        if (to !== d.from) onMove(d.from, to);
      }
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }
  const rowClass = (i, count) =>
    (drag && drag.from === i ? " dragging" : "") +
    (drag && drag.over === i && drag.from !== i ? " drop-before" : "") +
    (drag && drag.over === count && i === count - 1 ? " drop-after" : "");
  return { start, rowClass, dragging: !!drag };
}
