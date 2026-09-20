import React, { useRef, useState } from "react";
import { DotsSixVertical, ArrowUp, ArrowDown, Copy, Trash } from "@phosphor-icons/react";
import { IconButton } from "./ui";

// Pointer-based drag to reorder (works with mouse, pen and touch), plus
// keyboard-friendly buttons for the same operations.
export default function SectionList({ sections, selected, onSelect, onMove, onDuplicate, onRemove }) {
  const listRef = useRef();
  const dragRef = useRef(null); // { from, over }; source of truth, state mirrors it for rendering
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
    const rows = () => [...listRef.current.querySelectorAll("[data-row]")];
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
  return (
    <div className="section-list" ref={listRef} role="list" aria-label="頁面區塊">
      {sections.map((s, i) => (
        <div
          key={i}
          data-row
          role="listitem"
          className={
            "section-row" +
            (selected === i ? " selected" : "") +
            (drag && drag.from === i ? " dragging" : "") +
            (drag && drag.over === i && drag.from !== i ? " drop-before" : "") +
            (drag && drag.over === sections.length && i === sections.length - 1 ? " drop-after" : "")
          }
        >
          <button
            type="button"
            className="drag-handle"
            aria-label={"拖曳移動「" + s.title + "」"}
            title="拖曳調整順序"
            onPointerDown={(e) => start(e, i)}
          >
            <DotsSixVertical size={18} weight="bold" />
          </button>
          <button type="button" className="section-pick" onClick={() => onSelect(i)}>
            <span className="block-index">{String(i + 1).padStart(2, "0")}</span>
            <span className="section-title">{s.title}</span>
            <span className="section-kind">{s.kind}</span>
          </button>
          {selected === i && (
            <span className="section-actions">
              <IconButton label="上移" disabled={i === 0} onClick={() => onMove(i, i - 1)}>
                <ArrowUp size={15} />
              </IconButton>
              <IconButton label="下移" disabled={i === sections.length - 1} onClick={() => onMove(i, i + 1)}>
                <ArrowDown size={15} />
              </IconButton>
              <IconButton label="複製區塊" onClick={() => onDuplicate(i)}>
                <Copy size={15} />
              </IconButton>
              <IconButton label="刪除區塊" disabled={sections.length === 1} onClick={() => onRemove(i)}>
                <Trash size={15} />
              </IconButton>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
