// 建立網站精靈: a new lab's site in five steps, the AI planning alongside —
//   1 認識研究室  answers about the lab (the prompt the AI works from)
//   2 網站結構    which pages, and what each will do for this lab
//   3 風格        a look (skin) the AI recommends, and colours from the mood
//   4 內容初稿    every sentence of the template rewritten for this lab
//   5 建立        the site is made, opened, and the tour takes over
// A live preview of the home page follows every choice.
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Sparkle, ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { previewHtml } from "../site/wizardPreview.js";

const STEPS = ["認識研究室", "網站結構", "風格", "內容初稿", "建立"];
const AUDIENCE = ["想來念研究所的學生", "合作的醫院與學者", "一般民眾與病人", "評鑑與計畫審查"];
const PAGE_NAMES = { index: "首頁", research: "研究方向", members: "團隊成員", publications: "論文發表", contact: "加入與聯絡" };
const SLOT_LABELS = [
  ["lede", "首頁一句話介紹"],
  ["about_lead", "關於我們：開頭"],
  ["about_1", "關於我們：第一段"],
  ["about_2", "關於我們：第二段"],
  ["research_summary", "研究方向（一行）"],
  ["research_lede", "研究方向頁的介紹"],
  ["join_summary", "招生一句話"],
];

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\(mock\)\s*/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export default function SiteWizard({ p, open, onClose }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState({ name: "", nameEn: "", pi: "", dept: "", email: "", phone: "", about: "", topics: "", audience: [AUDIENCE[0]], mood: "" });
  const [plan, setPlan] = useState(null);
  const [keep, setKeep] = useState({});
  const [skin, setSkin] = useState("guide");
  const [themes, setThemes] = useState(null);
  const [theme, setTheme] = useState(null);
  const [fill, setFill] = useState({});
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [skins, setSkins] = useState([]);
  const [lang, setLang] = useState("zh");

  useEffect(() => {
    if (!open || bundle) return;
    fetch("/templates/basic.json")
      .then((r) => r.json())
      .then((b) => {
        setBundle(b);
        setSkins(b.skins || []);
      })
      .catch(() => setError("讀不到網站模板。"));
  }, [open]);

  const set = (k) => (e) => setA((x) => ({ ...x, [k]: e.target.value }));
  const run = async (label, fn) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const askPlan = () =>
    run("AI 正在規劃網站結構、風格和內容…", async () => {
      const r = await p.cloudCalls.wizardPlan(a);
      setPlan(r);
      setKeep(Object.fromEntries(r.pages.map((x) => [x.page, x.keep])));
      setSkin(r.skin);
      setFill(r.fill);
      setSlug((s) => s || slugify(a.nameEn || r.name_en));
      setThemes(null);
      setTheme(null);
      setStep(1);
    });
  const askThemes = () =>
    run("AI 正在配色…", async () => {
      const r = await p.cloudCalls.wizardThemes(a.mood.trim() || plan?.style_words || "溫和、專業、可信賴");
      setThemes(r.themes);
    });
  const create = () =>
    run("正在建立網站…", async () => {
      const drop = Object.entries(keep)
        .filter(([, v]) => !v)
        .map(([k]) => k + ".html");
      const r = await p.cloudCalls.importSite({
        template: "basic",
        skin: skin || undefined,
        slug: slug.trim(),
        name: a.name.trim(),
        wizard: {
          fill,
          drop,
          theme: theme ? { vars: theme.vars, fontUrl: theme.fontUrl } : null,
          fields: { nameEn: a.nameEn || plan?.name_en, pi: a.pi, dept: a.dept, email: a.email, phone: a.phone },
        },
      });
      await p.refreshCloud();
      onClose();
      p.notify?.(`已建立「${r.site.name}」。接下來換上照片、放論文，看過後按「發布」。`);
      p.openCloud(r.site);
    });

  const wizard = useMemo(
    () => ({
      fill,
      drop: Object.entries(keep)
        .filter(([, v]) => !v)
        .map(([k]) => k + ".html"),
      theme: theme ? { vars: theme.vars, fontUrl: theme.fontUrl } : null,
      fields: { nameEn: a.nameEn || plan?.name_en },
    }),
    [fill, keep, theme, a.nameEn, plan],
  );
  const preview = useMemo(() => (bundle && step > 0 ? previewHtml(bundle, { page: lang === "en" ? "en/index.html" : "index.html", skin, name: a.name, wizard }) : null), [bundle, step, skin, a.name, wizard, lang]);

  if (!open) return null;
  const setFillValue = (key, l) => (e) => setFill((f) => ({ ...f, [key]: { ...(f[key] || {}), [l]: e.target.value } }));
  return (
    <div className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <div className="wizard-card">
        <header className="wizard-head">
          <div>
            <p className="wizard-kicker">建立研究室網站</p>
            <h2 id="wizard-title">{STEPS[step]}</h2>
          </div>
          <ol className="wizard-rail" aria-label="步驟">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? "now" : i < step ? "done" : ""}>
                <span>{i < step ? <Check size={12} weight="bold" /> : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <button type="button" className="text-link muted" onClick={onClose}>
            離開
          </button>
        </header>
        <div className={"wizard-body" + (step > 0 ? " with-preview" : "")}>
          <div className="wizard-main">
            {step === 0 && (
              <div className="wizard-form">
                <p className="wizard-hint">先告訴 AI 這個研究室是誰、在做什麼、網站要給誰看。寫得越具體，規劃和文字越貼近你；沒寫到的事 AI 不會自己編。</p>
                <div className="wizard-row">
                  <label className="field">
                    <span>研究室中文名稱 *</span>
                    <input value={a.name} onChange={set("name")} placeholder="例如：護理創新研究室" />
                  </label>
                  <label className="field">
                    <span>英文名稱（可留白，AI 會建議）</span>
                    <input value={a.nameEn} onChange={set("nameEn")} />
                  </label>
                </div>
                <div className="wizard-row">
                  <label className="field">
                    <span>主持人與職稱</span>
                    <input value={a.pi} onChange={set("pi")} placeholder="例如：王小明 副教授" />
                  </label>
                  <label className="field">
                    <span>系所</span>
                    <input value={a.dept} onChange={set("dept")} placeholder="例如：○○大學護理學系" />
                  </label>
                </div>
                <div className="wizard-row">
                  <label className="field">
                    <span>聯絡 Email</span>
                    <input type="email" value={a.email} onChange={set("email")} />
                  </label>
                  <label className="field">
                    <span>電話</span>
                    <input value={a.phone} onChange={set("phone")} />
                  </label>
                </div>
                <label className="field">
                  <span>用幾句話介紹研究室在做什麼 *</span>
                  <textarea rows={4} value={a.about} onChange={set("about")} placeholder="例如：我們研究高齡者的認知訓練與照顧者支持，常和醫院神經內科、社區據點合作，也在發展 AI 輔助的衛教工具。" />
                </label>
                <label className="field">
                  <span>研究主題（每行一個，2～5 個）</span>
                  <textarea rows={3} value={a.topics} onChange={set("topics")} placeholder={"失智症照護\n認知訓練\n數位健康"} />
                </label>
                <fieldset className="wizard-checks">
                  <legend>網站主要給誰看</legend>
                  {AUDIENCE.map((x) => (
                    <label key={x}>
                      <input
                        type="checkbox"
                        checked={a.audience.includes(x)}
                        onChange={(e) => setA((v) => ({ ...v, audience: e.target.checked ? [...v.audience, x] : v.audience.filter((y) => y !== x) }))}
                      />
                      {x}
                    </label>
                  ))}
                </fieldset>
                <label className="field">
                  <span>想要的感覺（選填）</span>
                  <input value={a.mood} onChange={set("mood")} placeholder="例如：溫暖、可信賴，有一點科技感" />
                </label>
              </div>
            )}

            {step === 1 && plan && (
              <div className="wizard-structure">
                <p className="wizard-hint">AI 依你的介紹排出網站的頁面。每一頁都有中文和英文版；「研究方向」和「論文發表」可以先不放，之後再加。</p>
                <ul className="wizard-pages">
                  {plan.pages.map((x) => {
                    const optional = x.page === "research" || x.page === "publications";
                    return (
                      <li key={x.page} className={keep[x.page] ? "" : "off"}>
                        <label>
                          <input type="checkbox" checked={!!keep[x.page]} disabled={!optional} onChange={(e) => setKeep((k) => ({ ...k, [x.page]: e.target.checked }))} />
                          <strong>{PAGE_NAMES[x.page]}</strong>
                          {!optional && <span className="muted">（一定要有）</span>}
                        </label>
                        <p>{x.purpose}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {step === 2 && (
              <div className="wizard-style">
                <p className="wizard-hint">
                  先選版型（整體的樣子），再選配色。<strong>AI 推薦「{skins.find((s) => s.id === plan?.skin)?.name || plan?.skin}」</strong>：{plan?.skin_reason}
                </p>
                <div className="wizard-skins">
                  {skins.map((s) => (
                    <button key={s.id} type="button" className={"wizard-skin" + (skin === s.id ? " on" : "")} onClick={() => setSkin(s.id)}>
                      <strong>
                        {s.name}
                        {plan?.skin === s.id && <span className="wizard-badge">AI 推薦</span>}
                      </strong>
                      <span>{s.description}</span>
                    </button>
                  ))}
                </div>
                <div className="wizard-colors">
                  <div className="wizard-colors-head">
                    <strong>配色</strong>
                    <span className="muted">依「{a.mood.trim() || plan?.style_words}」</span>
                    <Button size="1" variant="soft" color="orange" disabled={!!busy} onClick={askThemes}>
                      <Sparkle size={14} /> {themes ? "再配三組" : "請 AI 配三組顏色"}
                    </Button>
                  </div>
                  <div className="wizard-themes">
                    <button type="button" className={"wizard-theme" + (!theme ? " on" : "")} onClick={() => setTheme(null)}>
                      <span className="wizard-swatches muted">版型原本的顏色</span>
                    </button>
                    {(themes || []).map((t) => (
                      <button key={t.name} type="button" className={"wizard-theme" + (theme === t ? " on" : "")} onClick={() => setTheme(t)} title={t.rationale}>
                        <span className="wizard-swatches">
                          {["--zone-research", "--zone-team", "--zone-publications", "--zone-join"].map((k) => (
                            <i key={k} style={{ background: t.vars?.[k] }} />
                          ))}
                        </span>
                        <span>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="wizard-content">
                <p className="wizard-hint">AI 依你的介紹寫好了中英文初稿，右邊預覽會跟著變。可以直接改；之後在編輯畫面也都能再改。</p>
                {SLOT_LABELS.map(([key, label]) => (
                  <div key={key} className="wizard-pair">
                    <span>{label}</span>
                    <textarea rows={2} value={fill[key]?.zh || ""} onChange={setFillValue(key, "zh")} />
                    <textarea rows={2} lang="en" value={fill[key]?.en || ""} onChange={setFillValue(key, "en")} />
                  </div>
                ))}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="wizard-pair">
                    <span>研究主題 {i}</span>
                    <input value={fill[`area${i}_title`]?.zh || ""} onChange={setFillValue(`area${i}_title`, "zh")} />
                    <input lang="en" value={fill[`area${i}_title`]?.en || ""} onChange={setFillValue(`area${i}_title`, "en")} />
                    <textarea rows={2} value={fill[`area${i}_desc`]?.zh || ""} onChange={setFillValue(`area${i}_desc`, "zh")} />
                    <textarea rows={2} lang="en" value={fill[`area${i}_desc`]?.en || ""} onChange={setFillValue(`area${i}_desc`, "en")} />
                  </div>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="wizard-done">
                <p className="wizard-hint">確認後就會建立網站並打開編輯畫面，接著會有新手步驟帶你換照片、放論文、改成員。建立後要按「發布」，大家才看得到。</p>
                <dl className="wizard-summary">
                  <dt>研究室</dt>
                  <dd>
                    {a.name}
                    {(a.nameEn || plan?.name_en) && ` · ${a.nameEn || plan?.name_en}`}
                  </dd>
                  <dt>頁面</dt>
                  <dd>{Object.entries(keep).filter(([, v]) => v).map(([k]) => PAGE_NAMES[k]).join("、")}（中英文）</dd>
                  <dt>版型</dt>
                  <dd>{skins.find((s) => s.id === skin)?.name || skin}</dd>
                  <dt>配色</dt>
                  <dd>{theme ? theme.name : "版型原本的顏色"}</dd>
                </dl>
                <label className="field">
                  <span>網址代稱（英文小寫、數字、連字號）</span>
                  <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="例如 nursing-innovation-lab" />
                </label>
              </div>
            )}

            {error && <p className="small-note error-text">{error}</p>}
            {busy && (
              <p className="wizard-busy" role="status">
                <Sparkle size={16} /> {busy}
              </p>
            )}
            <div className="wizard-nav">
              {step > 0 && (
                <Button variant="soft" color="gray" disabled={!!busy} onClick={() => setStep(step - 1)}>
                  <ArrowLeft size={16} /> 上一步
                </Button>
              )}
              <span />
              {step === 0 && (
                <Button size="3" color="orange" disabled={!!busy || !a.name.trim() || a.about.trim().length < 10 || !p.cloud?.me?.ai} onClick={askPlan}>
                  <Sparkle size={18} /> {plan ? "請 AI 重新規劃" : "請 AI 開始規劃"}
                </Button>
              )}
              {step === 0 && plan && (
                <Button size="3" variant="soft" disabled={!!busy} onClick={() => setStep(1)}>
                  用上次的規劃 <ArrowRight size={16} />
                </Button>
              )}
              {step > 0 && step < 4 && (
                <Button size="3" disabled={!!busy} onClick={() => setStep(step + 1)}>
                  下一步 <ArrowRight size={16} />
                </Button>
              )}
              {step === 4 && (
                <Button size="3" color="orange" disabled={!!busy || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug.trim())} onClick={create}>
                  <Check size={18} /> 建立網站
                </Button>
              )}
            </div>
            {step === 0 && !p.cloud?.me?.ai && <p className="small-note warn-note">需要先在「平台設定」放入 AI 金鑰，才能使用精靈；也可以改用下面的「直接用模板建立」。</p>}
          </div>
          {step > 0 && (
            <aside className="wizard-preview" aria-label="首頁預覽">
              <div className="wizard-preview-head">
                <span>預覽：{lang === "en" ? "英文首頁" : "首頁"}</span>
                <button type="button" className="text-link" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
                  看{lang === "en" ? "中文" : "英文"}
                </button>
              </div>
              {preview ? <iframe title="首頁預覽" sandbox="allow-scripts" srcDoc={preview} /> : <p className="small-note">正在準備預覽…</p>}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
