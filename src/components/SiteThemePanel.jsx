import React, { useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Sparkle, ArrowCounterClockwise, FloppyDisk, WarningCircle, CheckCircle } from "@phosphor-icons/react";
import { generateThemes, contrastIssues, FONT_PAIRS, fontUrl, fontStack, parseColor } from "../site/themes.js";

// The site's look: colours, fonts and corners from css/theme.css. Every
// template shares the same markup, so changing these never touches content.
const COLORS = [
  ["--zone-research", "研究分區"],
  ["--zone-team", "團隊分區"],
  ["--zone-publications", "論文分區"],
  ["--zone-join", "招生色帶"],
  ["--mark", "目前位置標記"],
  ["--ink", "文字"],
  ["--wall", "灰色底"],
];
const SWATCH = ["--zone-research", "--zone-team", "--zone-publications", "--zone-join", "--ink", "--wall"];
const hex = (v) => {
  const rgb = parseColor(v);
  return rgb ? "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("") : "#000000";
};

export default function SiteThemePanel({ p }) {
  const t = p.theme;
  const [batch, setBatch] = useState([]);
  const [picked, setPicked] = useState(null);
  const issues = useMemo(() => (t ? contrastIssues(t.vars) : []), [t]);
  if (!t) return <p className="small-note">這個網站沒有 css/theme.css，外觀只能在原始碼裡調整。</p>;
  const currentFont = FONT_PAIRS.find((f) => String(t.vars["--font"] || "").startsWith(`"${f.latin}"`));
  const generate = () => {
    setBatch(generateThemes({ count: 6, seed: Date.now() }));
    setPicked(null);
  };
  return (
    <div className="theme-panel">
      <p className="small-note">整個網站共用一組外觀。換配色、字體或圓角都不會動到任何文字與圖片，預覽會立刻更新，按「保存外觀」才會存成新版本。</p>

      <section className="theme-block">
        <div className="theme-block-head">
          <h4>自動產生方案</h4>
          <Button size="1" variant="soft" onClick={generate}>
            <Sparkle size={14} /> {batch.length ? "再產生一組" : "產生 6 組"}
          </Button>
        </div>
        {batch.length === 0 ? (
          <p className="small-note">依配色規則與字體組合產生新的外觀，每一組都先通過 WCAG AA 對比檢查。點一組就會套用到預覽。</p>
        ) : (
          <div className="theme-grid">
            {batch.map((th) => (
              <button
                key={th.id}
                type="button"
                className={"theme-card" + (picked === th.id ? " active" : "")}
                aria-pressed={picked === th.id}
                onClick={() => {
                  setPicked(th.id);
                  p.setTheme(th);
                }}
              >
                <span className="theme-swatches" aria-hidden="true">
                  {SWATCH.map((k) => (
                    <i key={k} style={{ background: th.vars[k] }} />
                  ))}
                </span>
                <strong>{th.name}</strong>
                <span style={{ fontFamily: th.vars["--font"], borderRadius: th.vars["--radius"] }} className="theme-sample">
                  研究室 Lab
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="theme-block">
        <h4>顏色</h4>
        <div className="theme-colors">
          {COLORS.filter(([k]) => t.vars[k]).map(([k, label]) => (
            <label key={k} className="theme-color">
              <input type="color" value={hex(t.vars[k])} onChange={(e) => p.setTheme({ vars: { [k]: e.target.value } })} />
              <span>{label}</span>
              <code>{hex(t.vars[k])}</code>
            </label>
          ))}
        </div>
      </section>

      <section className="theme-block">
        <h4>字體與圓角</h4>
        <label className="field">
          <span>字體搭配</span>
          <select
            value={currentFont?.id || ""}
            onChange={(e) => {
              const f = FONT_PAIRS.find((x) => x.id === e.target.value);
              if (f) p.setTheme({ vars: { "--font": fontStack(f) }, fontUrl: fontUrl(f) });
            }}
          >
            {!currentFont && <option value="">（自訂字體）</option>}
            {FONT_PAIRS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}：{f.latin} ＋ {f.zh}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>圓角</span>
          <select value={t.vars["--radius"] || "4px"} onChange={(e) => p.setTheme({ vars: { "--radius": e.target.value } })}>
            <option value="0px">直角</option>
            <option value="4px">微圓角</option>
            <option value="10px">圓角</option>
          </select>
        </label>
      </section>

      {issues.length > 0 ? (
        <div className="message error" role="status">
          <WarningCircle size={20} />
          <span>
            有 {issues.length} 處文字對比不足 4.5:1（WCAG AA），部分訪客會看不清楚：
            {issues.map((i) => `${i.label}（${i.ratio}:1）`).join("、")}。
          </span>
        </div>
      ) : (
        <p className="small-note theme-ok">
          <CheckCircle size={15} /> 所有文字對比都達到 WCAG AA。
        </p>
      )}

      <div className="button-row">
        <Button onClick={p.saveTheme} disabled={!t.dirty || p.busy || !p.project?.source.writable}>
          <FloppyDisk size={16} /> 保存外觀
        </Button>
        <Button variant="surface" onClick={p.revertTheme} disabled={!t.dirty}>
          <ArrowCounterClockwise size={16} /> 還原
        </Button>
      </div>
    </div>
  );
}
