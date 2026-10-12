// 網站配色, Stitch-style: one main colour and the whole palette follows.
// Previewed live; 套用 recolours every page, icon and logo as one version.
import React from "react";
import { Button } from "@radix-ui/themes";
import { COLOR_PRESETS, normHex } from "../site/palette.js";

export default function ColorPanel({ p, writable }) {
  const c = p.colors;
  if (!c) return null;
  const current = c.seed || c.palette.primary.value;
  return (
    <div className="color-panel">
      <h3 className="inspector-subtitle">網站配色</h3>
      <p className="small-note">選一個主色，整個網站的配色會跟著變，包括標題旁的小圖示和 Logo。每個顏色的深淺都維持原本，文字一樣清楚好讀。</p>
      <div className="color-swatches" role="radiogroup" aria-label="主色">
        {COLOR_PRESETS.map(([hex, name]) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={c.seed === hex}
            aria-label={name}
            title={name}
            className={c.seed === hex ? "active" : ""}
            style={{ background: hex }}
            disabled={!writable || p.busy}
            onClick={() => c.preview(hex)}
          />
        ))}
        <label className="color-custom" title="自訂主色">
          <input type="color" value={normHex(current) || "#0d6557"} disabled={!writable || p.busy} onChange={(e) => c.preview(e.target.value)} />
          自訂
        </label>
      </div>
      <ul className="color-chips" aria-label="目前的配色">
        {c.palette.colors.map((col) => {
          const next = c.map[col.value];
          return (
            <li key={col.name} title={col.name}>
              <span className="chip-pair">
                <i style={{ background: col.value }} />
                {next && <i style={{ background: next }} />}
              </span>
              <span className="chip-name">{col.label || col.name.replace(/^--/, "")}</span>
            </li>
          );
        })}
      </ul>
      {c.previewing ? (
        <div className="color-actions">
          <Button onClick={c.apply} disabled={!writable || p.busy}>
            {p.busy ? "處理中…" : "套用到整個網站並保存"}
          </Button>
          <Button variant="soft" color="gray" onClick={c.clear} disabled={p.busy}>
            取消
          </Button>
        </div>
      ) : (
        <p className="small-note">點一個顏色，右邊預覽會立刻換上新配色；確定喜歡再按「套用」。</p>
      )}
      {c.canRestore && !c.previewing && (
        <Button size="1" variant="ghost" onClick={c.restore} disabled={!writable || p.busy}>
          恢復原本配色
        </Button>
      )}
    </div>
  );
}
