import React, { useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Sparkle, ArrowCounterClockwise, FloppyDisk, WarningCircle, CheckCircle, MagicWand } from "@phosphor-icons/react";
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
  const [keepColors, setKeepColors] = useState(false);
  const [aiText, setAiText] = useState("");
  const [ai, setAi] = useState({ busy: false, themes: [], error: null, remaining: null });
  const generate = () => {
    setBatch(generateThemes({ count: 6, seed: Date.now() }));
    setPicked(null);
  };
  return (
    <div className="theme-panel">
      <p className="small-note">整個網站共用一組外觀。換配色、字體或圓角都不會動到任何文字與圖片，預覽會立刻更新，按「保存外觀」才會存成新版本。</p>

      {p.skins && p.skins.list.length > 1 && (
        <section className="theme-block">
          <h4>版型</h4>
          <p className="small-note">版型決定版面與元件的樣子；同一個網站可以隨時切換，文字、圖片與區塊都不會變。</p>
          <div className="skin-list">
            {p.skins.list.map((sk) => {
              const active = (p.skins.pending || p.skins.current) === sk.id;
              return (
                <button
                  key={sk.id}
                  type="button"
                  className={"skin-card" + (active ? " active" : "")}
                  aria-pressed={active}
                  disabled={p.busy}
                  onClick={() => p.previewSkin(sk.id, { keepColors })}
                >
                  <strong>
                    {sk.name}
                    {p.skins.current === sk.id && <span className="muted">目前使用</span>}
                  </strong>
                  {sk.description && <span>{sk.description}</span>}
                </button>
              );
            })}
          </div>
          <label className="check-row">
            <input type="checkbox" checked={keepColors} onChange={(e) => setKeepColors(e.target.checked)} />
            換版型時保留目前的配色
          </label>
        </section>
      )}

      {p.ai?.available && (
        <section className="theme-block">
          <h4>用一句話描述，讓 AI 配色</h4>
          <form
            className="ai-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setAi((a) => ({ ...a, busy: true, error: null }));
              try {
                const r = await p.ai.generate(aiText);
                setAi({ busy: false, themes: r.themes, error: null, remaining: r.remaining });
                setPicked(null);
              } catch (err) {
                setAi((a) => ({ ...a, busy: false, error: err.message }));
              }
            }}
          >
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="例如：沉穩可信、像清晨的病房，帶一點溫暖的木頭色"
              aria-label="描述想要的網站外觀"
            />
            <Button size="2" type="submit" disabled={ai.busy || aiText.trim().length < 2}>
              <MagicWand size={15} /> {ai.busy ? "AI 正在配色…" : "產生 3 組"}
            </Button>
          </form>
          {ai.error && <p className="error-text small-note">{ai.error}</p>}
          {ai.themes.length > 0 && (
            <div className="theme-grid">
              {ai.themes.map((th, i) => {
                const id = "ai-" + i + "-" + th.name;
                return (
                  <button
                    key={id}
                    type="button"
                    className={"theme-card" + (picked === id ? " active" : "")}
                    aria-pressed={picked === id}
                    onClick={() => {
                      setPicked(id);
                      p.setTheme(th);
                    }}
                  >
                    <span className="theme-swatches" aria-hidden="true">
                      {SWATCH.map((k) => (
                        <i key={k} style={{ background: th.vars[k] }} />
                      ))}
                    </span>
                    <strong>{th.name}</strong>
                    {th.rationale && <span className="theme-why">{th.rationale}</span>}
                    {th.adjusted?.length > 0 && <span className="theme-why">已把 {th.adjusted.length} 個顏色調深，讓文字看得清楚。</span>}
                  </button>
                );
              })}
            </div>
          )}
          <p className="small-note">
            AI 只會改顏色、字體與圓角，不會動到文字。每一組都會重新檢查對比。
            {ai.remaining !== null && ` 這個網站今天還可以用 ${ai.remaining} 次。`}
          </p>
        </section>
      )}

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

      {t.vars["--motion"] && (
        <section className="theme-block">
          <h4>動畫</h4>
          <div className="segmented" role="radiogroup" aria-label="網站的動畫風格">
            {[
              ["none", "不要動畫"],
              ["subtle", "輕微"],
              ["lively", "活潑"],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={t.vars["--motion"] === v}
                className={t.vars["--motion"] === v ? "active" : ""}
                onClick={() => p.setTheme({ vars: { "--motion": v } })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="small-note">
            區塊捲進畫面時出現的方式。每個區塊也可以在「頁面區塊」另外指定。按預覽上方的 ▷ 可以從頂端播放一次；訪客的系統若設定「減少動態效果」，一律不播放。
          </p>
        </section>
      )}

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
