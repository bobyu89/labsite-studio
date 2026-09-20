import React, { useRef } from "react";
import { DotsSixVertical, ArrowUp, ArrowDown, Copy, Trash } from "@phosphor-icons/react";
import { IconButton } from "./ui";
import { useDragReorder } from "../hooks/useDragReorder";

export default function SectionList({ sections, selected, onSelect, onMove, onDuplicate, onRemove }) {
  const listRef = useRef();
  const { start, rowClass } = useDragReorder(listRef, onMove);
  return (
    <div className="section-list" ref={listRef} data-list role="list" aria-label="頁面區塊">
      {sections.map((s, i) => (
        <div
          key={i}
          data-row
          role="listitem"
          className={"section-row" + (selected === i ? " selected" : "") + rowClass(i, sections.length)}
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
