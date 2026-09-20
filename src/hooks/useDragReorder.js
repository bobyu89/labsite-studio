import { useRef, useState } from "react";

// Pointer-based reordering for a vertical list (mouse, pen, touch). Rows are
// found with `[data-row]` inside `listRef`. The move fires exactly once on
// release; state only drives the drop indicator.
export function useDragReorder(listRef, onMove) {
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const update = (next) => {
    dragRef.current = next;
    setDrag(next);
  };
  function start(e, index) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture?.(e.pointerId);
    update({ from: index, over: index });
    const rows = () => [...listRef.current.querySelectorAll(":scope [data-row]")].filter((r) => r.closest("[data-list]") === listRef.current);
    const overAt = (y) => {
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
      if (dragRef.current) update({ ...dragRef.current, over: overAt(ev.clientY) });
    };
    const end = (ev) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      const d = dragRef.current;
      update(null);
      if (!d) return;
      const slot = ev.type === "pointerup" && Number.isFinite(ev.clientY) ? overAt(ev.clientY) : d.over;
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
