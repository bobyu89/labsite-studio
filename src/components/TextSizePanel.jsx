// 網站文字大小: one setting that scales every heading and paragraph of the
// site together. Saved with 保存外觀 (or its own button on sites without a
// theme), previewed right away.
import React from "react";
import { Button } from "@radix-ui/themes";
import { FloppyDisk } from "@phosphor-icons/react";
import { TEXT_SIZES } from "../site/textSize.js";

export default function TextSizePanel({ p, writable }) {
  const t = p.textSize;
  if (!t?.available) return null;
  return (
    <div className="text-size-panel">
      <h3 className="inspector-subtitle">網站文字大小</h3>
      <div className="segmented" role="radiogroup" aria-label="網站文字大小">
        {TEXT_SIZES.map((s) => (
          <button
            key={s.pct}
            type="button"
            role="radio"
            aria-checked={t.pct === s.pct}
            className={t.pct === s.pct ? "active" : ""}
            disabled={!writable}
            onClick={() => p.setTextSize(s.pct)}
            style={{ fontSize: 12 * (s.pct / 100) + "px" }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="small-note">整個網站的標題與內文一起放大或縮小，版面不變。右邊預覽會立刻更新。</p>
      {!p.theme && (
        <Button onClick={p.saveTheme} disabled={!t.dirty || p.busy || !writable}>
          <FloppyDisk size={16} /> 保存文字大小
        </Button>
      )}
    </div>
  );
}
