import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import {
  Image as ImageIcon,
  LinkSimple,
  DotsSixVertical,
  Plus,
  Trash,
  CaretDown,
  CaretRight,
  ArrowUp,
  ArrowDown,
} from "@phosphor-icons/react";
import { Field, IconButton } from "./ui";
import { parsePage, sectionElements, describeNode, describeItem } from "../site/page.js";
import { useDragReorder } from "../hooks/useDragReorder";

const key = (path) => path.join(".");
const isPrefix = (prefix, path) => prefix.length <= path.length && prefix.every((v, i) => v === path[i]);

/* Plain fields of one element (text, link, image). */
// An image field takes a picked file, a file dropped on it, or an image from
// the site's photo library.
function ImageField({ f, k, cls, index, setFocus, setAttr, replaceImage, openLibrary, writable, busy }) {
  const [over, setOver] = useState(false);
  const accepts = writable && !busy;
  return (
    <div
      className={cls + " field-image" + (over ? " drop-over" : "")}
      data-el={k}
      onFocusCapture={() => setFocus(k)}
      onDragOver={(e) => {
        if (!accepts || ![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (!accepts || !file) return;
        e.preventDefault();
        replaceImage(index, f.path, file);
      }}
    >
      <span className="field-image-label">
        <ImageIcon size={14} /> {f.label}
      </span>
      <code className="field-image-src" title={f.src}>
        {f.src || "（尚未設定）"}
      </code>
      <Field label="替代文字（給讀者與搜尋引擎）" value={f.alt} onChange={(v) => setAttr(index, f.path, "alt", v)} />
      <div className="field-image-actions">
        <label className="upload-inline">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            hidden
            disabled={!accepts}
            onChange={(e) => {
              const file = e.target.files[0];
              e.target.value = "";
              if (file) replaceImage(index, f.path, file);
            }}
          />
          <Button asChild variant="surface" size="1" disabled={!accepts}>
            <span>{writable ? "上傳新圖片" : "此來源無法更換圖片"}</span>
          </Button>
        </label>
        {openLibrary && (
          <Button variant="ghost" size="1" disabled={!accepts} onClick={() => openLibrary(index, f.path)}>
            從照片庫選擇
          </Button>
        )}
      </div>
      {writable && <span className="small-note">也可以把照片直接拖到這裡，或拖到右側預覽的圖片上。會自動縮小並轉成 WebP。</span>}
    </div>
  );
}

function Fields({ fields, index, focus, setFocus, setText, setAttr, replaceImage, openLibrary, writable, busy }) {
  if (!fields.length) return null;
  return (
    <div className="field-list">
      {fields.map((f, n) => {
        const k = key(f.elementPath);
        const cls = "field-item" + (focus === k ? " focused" : "");
        if (f.kind === "text")
          return (
            <div className={cls} data-el={k} key={n} onFocusCapture={() => setFocus(k)}>
              <Field label={f.label} value={f.value} area={f.long} rows={f.long ? 3 : undefined} onChange={(v) => setText(index, f.path, v)} />
            </div>
          );
        if (f.kind === "link")
          return (
            <div className={cls + " field-link"} data-el={k} key={n} onFocusCapture={() => setFocus(k)}>
              <Field
                label={
                  <>
                    <LinkSimple size={13} /> {f.label}
                  </>
                }
                value={f.href}
                onChange={(v) => setAttr(index, f.path, "href", v)}
              />
            </div>
          );
        return (
          <ImageField
            key={n}
            f={f}
            k={k}
            cls={cls}
            index={index}
            setFocus={setFocus}
            setAttr={setAttr}
            replaceImage={replaceImage}
            openLibrary={openLibrary}
            writable={writable}
            busy={busy}
          />        );
      })}
    </div>
  );
}

/* One repeated list: rows can be dragged, added, removed; expanding a row shows its fields. */
function ItemList({ list, section, ctx, open, toggle, focusPath }) {
  const listRef = useRef();
  const { index, addItem, removeItem, moveItem, setConfirm } = ctx;
  const count = list.items.length;
  // Expansion is keyed by node path, so carry it along when a row moves.
  const move = (from, to) => {
    const k = key(list.items[from].path);
    if (open.has(k)) {
      toggle(k, false);
      expandNext.current = to;
    }
    moveItem(index, list.path, from, to);
  };
  const { start, rowClass } = useDragReorder(listRef, move);
  // After "add", expand the new row once it exists in the re-parsed list.
  const expandNext = useRef(null);
  useEffect(() => {
    if (expandNext.current !== null && list.items[expandNext.current]) {
      toggle(key(list.items[expandNext.current].path), true);
      expandNext.current = null;
    }
  });
  return (
    <div className="item-list" data-list ref={listRef}>
      <div className="item-list-head">
        <strong>
          {list.label}
          <span className="muted">{count} 項</span>
        </strong>
        <Button
          size="1"
          variant="soft"
          onClick={() => {
            expandNext.current = count;
            addItem(index, list.path, count - 1);
          }}
        >
          <Plus size={14} /> 新增{list.label}
        </Button>
      </div>
      {list.items.map((it, i) => {
        const k = key(it.path);
        const expanded = open.has(k) || (focusPath && isPrefix(it.path, focusPath));
        return (
          <div key={k} data-row className={"item-row" + (expanded ? " expanded" : "") + rowClass(i, count)}>
            <div className="item-row-head">
              <button type="button" className="drag-handle" aria-label={"拖曳移動「" + it.title + "」"} onPointerDown={(e) => start(e, i)}>
                <DotsSixVertical size={16} weight="bold" />
              </button>
              <button type="button" className="item-pick" onClick={() => toggle(k)} aria-expanded={expanded}>
                {expanded ? <CaretDown size={13} /> : <CaretRight size={13} />}
                <span className="block-index">{i + 1}</span>
                <span className="section-title">{it.title}</span>
              </button>
              <span className="section-actions">
                <IconButton label="上移" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton label="下移" disabled={i === count - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown size={14} />
                </IconButton>
                <IconButton
                  label={"刪除這個" + list.label}
                  disabled={count === 1}
                  onClick={() =>
                    setConfirm({
                      title: "刪除「" + it.title + "」？",
                      description: "只移除這一項，可用復原找回。",
                      action: () => removeItem(index, list.path, i),
                    })
                  }
                >
                  <Trash size={14} />
                </IconButton>
              </span>
            </div>
            {expanded && (
              <div className="item-body">
                <Node node={describeItem(section, it.path)} section={section} ctx={ctx} open={open} toggle={toggle} focusPath={focusPath} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* An element = its own fields + the lists inside it (recursive). */
function Node({ node, section, ctx, open, toggle, focusPath }) {
  const { fields, lists } = node;
  return (
    <>
      <Fields fields={fields} {...ctx} />
      {lists.map((list) => (
        <ItemList key={key(list.path)} list={list} section={section} ctx={ctx} open={open} toggle={toggle} focusPath={focusPath} />
      ))}
      {!fields.length && !lists.length && <p className="small-note">這裡沒有可直接編輯的文字或圖片。</p>}
    </>
  );
}

export default function FieldInspector({ html, index, focus, setFocus, setText, setAttr, replaceImage, openLibrary, writable, busy, addItem, removeItem, moveItem, setConfirm }) {
  const section = useMemo(() => (html ? sectionElements(parsePage(html).doc)[index] : null), [html, index]);
  const node = useMemo(() => (section ? describeNode(section) : { fields: [], lists: [] }), [section]);
  const [open, setOpen] = useState(() => new Set());
  const ref = useRef();
  useEffect(() => setOpen(new Set()), [index, html && html.length > 0 ? "same" : ""]);
  const toggle = (k, force) =>
    setOpen((s) => {
      const next = new Set(s);
      if (force === true || (!next.has(k) && force !== false)) next.add(k);
      else next.delete(k);
      return next;
    });
  const focusPath = focus ? focus.split(".").map(Number) : null;
  useEffect(() => {
    if (!focus || !ref.current) return;
    const el = ref.current.querySelector('[data-el="' + focus + '"]');
    if (el) {
      const box = ref.current.closest(".inspector-body");
      if (box) {
        const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
        box.scrollTo({ top: Math.max(0, top - 60), behavior: "smooth" });
      }
      el.querySelector("input, textarea")?.focus({ preventScroll: true });
    }
  }, [focus]);
  if (!section) return null;
  const ctx = { index, focus, setFocus, setText, setAttr, replaceImage, openLibrary, writable, busy, addItem, removeItem, moveItem, setConfirm };
  return (
    <div ref={ref}>
      <Node node={node} section={section} ctx={ctx} open={open} toggle={toggle} focusPath={focusPath} />
    </div>
  );
}
