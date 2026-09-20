import React, { useEffect, useMemo, useRef } from "react";
import { Button } from "@radix-ui/themes";
import { Image as ImageIcon, LinkSimple } from "@phosphor-icons/react";
import { Field } from "./ui";
import { parsePage, sectionElements, collectFields } from "../site/page.js";

// Lists every editable leaf of the selected section. Fields are addressed by
// node path, so edits land exactly on the original text node or attribute.
export default function FieldInspector({ html, index, focus, setFocus, setText, setAttr, replaceImage, writable, busy }) {
  const fields = useMemo(() => {
    if (!html) return [];
    const section = sectionElements(parsePage(html).doc)[index];
    return section ? collectFields(section) : [];
  }, [html, index]);
  const ref = useRef();
  useEffect(() => {
    if (!focus || !ref.current) return;
    const el = ref.current.querySelector('[data-el="' + focus + '"]');
    if (el) {
      // Scroll only the inspector body, never the page or the preview.
      const box = ref.current.closest(".inspector-body");
      if (box) {
        const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
        box.scrollTo({ top: Math.max(0, top - 60), behavior: "smooth" });
      }
      el.querySelector("input, textarea")?.focus({ preventScroll: true });
    }
  }, [focus]);
  if (!fields.length)
    return <p className="small-note">這個區塊沒有可直接編輯的文字或圖片。</p>;
  return (
    <div className="field-list" ref={ref}>
      {fields.map((f, n) => {
        const key = f.elementPath.join(".");
        const cls = "field-item" + (focus === key ? " focused" : "");
        if (f.kind === "text")
          return (
            <div className={cls} data-el={key} key={n} onFocusCapture={() => setFocus(key)}>
              <Field
                label={f.label}
                value={f.value}
                area={f.long}
                rows={f.long ? 3 : undefined}
                onChange={(v) => setText(index, f.path, v)}
              />
            </div>
          );
        if (f.kind === "link")
          return (
            <div className={cls + " field-link"} data-el={key} key={n} onFocusCapture={() => setFocus(key)}>
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
          <div className={cls + " field-image"} data-el={key} key={n} onFocusCapture={() => setFocus(key)}>
            <span className="field-image-label">
              <ImageIcon size={14} /> {f.label}
            </span>
            <code className="field-image-src" title={f.src}>
              {f.src || "（尚未設定）"}
            </code>
            <Field label="替代文字（給讀者與搜尋引擎）" value={f.alt} onChange={(v) => setAttr(index, f.path, "alt", v)} />
            <label className="upload-inline">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                hidden
                disabled={!writable || busy}
                onChange={(e) => {
                  const file = e.target.files[0];
                  e.target.value = "";
                  if (file) replaceImage(index, f.path, file);
                }}
              />
              <Button asChild variant="surface" size="1" disabled={!writable || busy}>
                <span>{writable ? "更換圖片（寫入 assets/）" : "此來源無法更換圖片"}</span>
              </Button>
            </label>
          </div>
        );
      })}
    </div>
  );
}
