// AI 助手: the teacher writes what they want changed; the assistant answers
// with proposals, shown here as cards. A proposal changes nothing until the
// teacher presses 套用, and the assistant never publishes.
//
// Shown inside AssistantDock, the floating window apart from the editing
// columns.
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Check, WarningCircle } from "@phosphor-icons/react";
import { editHtml } from "../site/page.js";
import { previewCitation } from "../site/quickAdd.js";
import { readNews } from "../site/news.js";
import { blanksIn } from "../site/promptBank.js";
import { COMMANDS } from "../site/design.js";
import { ASSIST_MODELS, cleanModelChoice, pickModel, perCallTwd } from "../site/aiModels.js";
import { buildContext, resolveChanges, applyTextChange, applyPublication, applyAddItem, fillBlock, newsItem, turnSummary } from "../site/assistant.js";

const same = (a, b) => String(a).replace(/\s+/g, " ").trim() === String(b).replace(/\s+/g, " ").trim();

// An editable value inside a proposal: the teacher can adjust the wording
// before applying it.
function Value({ label, value, onChange, disabled, rows = 2, lang }) {
  return (
    <label className="ai-value">
      <span>{label}</span>
      <textarea value={value} rows={rows} lang={lang} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const MOTION = { none: "不動", subtle: "輕微", lively: "活潑" };
function ThemeValue({ value }) {
  const v = String(value || "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v))
    return (
      <span className="ai-swatch">
        <i style={{ background: v }} />
        {v}
      </span>
    );
  return <span className="ai-swatch">{MOTION[v] || v}</span>;
}

function Card({ card, onChange, onApply, onDismiss, busy }) {
  const done = card.state === "applied";
  const off = !!card.state || !card.ok;
  const set = (patch) => onChange({ ...card, ...patch });
  const pub = card.type === "add_publication" ? previewCitation(card.values) : null;
  return (
    <div className={"ai-card" + (done ? " applied" : card.state === "dismissed" || !card.ok ? " off" : "")}>
      <div className="ai-card-head">
        <strong>{card.title}</strong>
        {card.where && <span>{card.where}</span>}
      </div>
      <div className="ai-card-body">
        {(card.type === "set_text" || card.type === "set_site") && (
          <>
            {card.before !== undefined && card.before !== "" && (
              <div className="ai-before">
                <span>現在</span>
                <p>{card.before}</p>
              </div>
            )}
            <Value
              label="改成"
              value={card.after}
              rows={Math.min(8, Math.max(2, Math.ceil(String(card.after).length / 22)))}
              disabled={off}
              onChange={(after) => set(card.type === "set_text" ? { after } : { after, value: after })}
            />
          </>
        )}
        {card.type === "add_news" && (
          <>
            <div className="ai-row">
              <label className="ai-value">
                <span>日期</span>
                <input type="date" value={card.date} disabled={off} onChange={(e) => set({ date: e.target.value })} />
              </label>
              <div className="ai-value">
                <span>分類</span>
                <p>{card.category}</p>
              </div>
            </div>
            <Value label="中文" value={card.zh} disabled={off} onChange={(zh) => set({ zh })} />
            <Value label="英文" value={card.en} lang="en" disabled={off} onChange={(en) => set({ en })} />
            {card.link && (
              <div className="ai-value">
                <span>連結</span>
                <p className="ai-link">{card.link}</p>
              </div>
            )}
          </>
        )}
        {card.type === "add_item" &&
          card.values.map((v, i) => (
            <Value
              key={i}
              label={v.label}
              value={v.value}
              disabled={off}
              onChange={(value) => set({ values: card.values.map((x, j) => (j === i ? { ...x, value } : x)) })}
            />
          ))}
        {card.type === "add_section" && (
          <>
            {card.texts.map((v, i) => (
              <Value
                key={"t" + i}
                label={v.label}
                value={v.value}
                disabled={off}
                onChange={(value) => set({ texts: card.texts.map((x, j) => (j === i ? { ...x, value } : x)) })}
              />
            ))}
            {card.rows.map((row, r) => (
              <fieldset key={"r" + r} className="ai-row-group">
                <legend>第 {r + 1} 項</legend>
                {row.map((v, i) => (
                  <Value
                    key={i}
                    label={v.label}
                    value={v.value}
                    rows={1}
                    disabled={off}
                    onChange={(value) => set({ rows: card.rows.map((rw, k) => (k === r ? rw.map((x, j) => (j === i ? { ...x, value } : x)) : rw)) })}
                  />
                ))}
              </fieldset>
            ))}
          </>
        )}
        {card.type === "set_theme" && (
          <>
            {card.reason && <p className="ai-reason">{card.reason}</p>}
            <ul className="ai-theme-rows">
              {(card.rows || []).map((r) => (
                <li key={r.key}>
                  <span>{r.label}</span>
                  <ThemeValue value={r.before} />
                  <span aria-hidden="true">→</span>
                  <ThemeValue value={r.after} />
                </li>
              ))}
            </ul>
          </>
        )}
        {pub && (
          <div className="ai-before">
            <span>網站上會顯示成</span>
            <p>
              <strong className="quick-add-num">1. </strong>
              {pub.parts.map((part, i) => (part.tag === "strong" ? <strong key={i}>{part.text}</strong> : part.tag === "em" ? <em key={i}>{part.text}</em> : <span key={i}>{part.text}</span>))}
              {pub.link && <> <u>{pub.link.label}</u></>}
            </p>
          </div>
        )}
        {card.problem && (
          <p className="ai-problem">
            <WarningCircle size={16} /> {card.problem}
          </p>
        )}
      </div>
      {done ? (
        <p className="ai-done">
          <Check size={16} weight="bold" /> 已套用，還沒發布。{card.undo ? "不對的話按上方的「復原」。" : ""}
        </p>
      ) : card.state === "dismissed" ? (
        <p className="ai-done muted">沒有套用。</p>
      ) : card.ok ? (
        <div className="ai-card-actions">
          <Button color="orange" disabled={busy} onClick={onApply}>
            套用
          </Button>
          <Button variant="surface" color="gray" disabled={busy} onClick={onDismiss}>
            不要
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function Assistant({ p, selected, sectionCount = 0, open, onOpen, seed, onAudit }) {
  const [turns, setTurns] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const input = useRef(null);
  const end = useRef(null);
  const nextId = useRef(1);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length, busy, open]);
  // A request picked from 版面靈感: put it in the box to be filled in.
  useEffect(() => {
    if (!seed?.text) return;
    onOpen?.();
    // A ready request (e.g. 請 AI 助手翻譯) goes straight out.
    if (seed.send) {
      send(seed.text);
      return;
    }
    setText(seed.text);
    setTimeout(() => {
      const box = input.current;
      if (!box) return;
      box.focus();
      const at = seed.text.indexOf("［");
      if (at >= 0) box.setSelectionRange(at, seed.text.indexOf("］", at) + 1);
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.n]);

  const inEnglish = p.current?.startsWith("en/");
  const prompts = [
    { label: "檢查這一頁的錯字", send: "檢查這一頁有沒有錯字或不通順的地方。" },
    p.pair && !inEnglish && { label: "把這個區塊翻成英文", send: "把我現在選的這個區塊翻成英文，放到英文頁對應的位置。" },
    p.news?.ok && !p.news.sheetId && { label: "加一則最新消息", fill: "加一則最新消息：" },
    { label: "這個要去哪裡改？", fill: "我想改的是：" },
  ].filter(Boolean);

  const [blankWarn, setBlankWarn] = useState(false);
  // 模型: what the admin allows (平台設定); the teacher's pick is remembered in this browser.
  const choice = cleanModelChoice(p.cloud?.me?.aiModels);
  const [modelPick, setModelPick] = useState(() => {
    try {
      return localStorage.getItem("labsite.ai.model") || "";
    } catch {
      return "";
    }
  });
  const model = pickModel(modelPick, choice);
  const chooseModel = (k) => {
    setModelPick(k);
    try {
      localStorage.setItem("labsite.ai.model", k);
    } catch {
      /* private window */
    }
  };
  const [commandsOpen, setCommandsOpen] = useState(() => {
    try {
      return localStorage.getItem("labsite.ai.commands") !== "closed";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("labsite.ai.commands", commandsOpen ? "open" : "closed");
    } catch {
      /* private mode */
    }
  }, [commandsOpen]);
  // command: a 設計規範 command id (design.js COMMANDS); the typed text, if
  // any, goes with it as the teacher's own note.
  async function send(message, command = null) {
    const ask = message.trim();
    if ((!command && ask.length < 2) || busy) return;
    const cmd = command ? COMMANDS.find((c) => c.id === command) : null;
    if (!cmd && blanksIn(ask) && !blankWarn) {
      setBlankWarn(true);
      return;
    }
    setBlankWarn(false);
    onOpen?.();
    setText("");
    setBusy(true);
    const history = turns.slice(-8).map((t) => ({ role: t.role, text: turnSummary(t) }));
    const said = cmd ? `【${cmd.name}】${ask ? " " + ask : ""}` : ask;
    setTurns((t) => [...t, { id: nextId.current++, role: "user", text: said, command: cmd?.id }]);
    try {
      const pairHtml = p.pair ? await p.ensureLoaded(p.pair) : null;
      const siteText = p.siteData?.text ?? null;
      const { context, index } = buildContext({ path: p.current, html: p.html, pairPath: p.pair, pairHtml, siteText, pages: p.pages, labelOf: p.labelOf, selected });
      const r = await p.ai.ask({ message: ask, history, context, model, ...(cmd ? { command: cmd.id } : {}) });
      const cards = resolveChanges(r.changes, index, { siteText, labelOf: p.labelOf, theme: p.theme }).map((c) => ({ ...c, id: nextId.current++, state: null }));
      setRemaining(r.remaining ?? null);
      setTurns((t) => [...t, { id: nextId.current++, role: "assistant", text: r.reply, cards, model: r.model }]);
    } catch (e) {
      setTurns((t) => [...t, { id: nextId.current++, role: "assistant", text: e.message, error: true, cards: [] }]);
    } finally {
      setBusy(false);
    }
  }

  const patchCard = (turnId, card) =>
    setTurns((t) => t.map((turn) => (turn.id === turnId ? { ...turn, cards: turn.cards.map((c) => (c.id === card.id ? card : c)) } : turn)));

  // Applies one proposal. Page edits are tried on a copy first: when the
  // page has changed since the assistant read it, nothing is written.
  async function apply(turnId, card) {
    const stale = (problem) => patchCard(turnId, { ...card, ok: false, problem });
    const tryEdit = async (page, mutate) => {
      const html = await p.ensureLoaded(page);
      return html !== null && editHtml(html, mutate) !== html;
    };
    if (card.type === "set_text") {
      if (!card.after.trim()) return stale("文字是空白的。要刪掉內容，請在預覽點選後自己清除。");
      const mutate = applyTextChange(card);
      if (!(await tryEdit(card.target.page, mutate))) return stale("這段文字在助手讀過之後已經改過了，所以沒有套用。請再說一次要怎麼改。");
      p.editPage(card.target.page, mutate);
      if (card.target.page === p.current) {
        p.setSelected(card.target.section);
        p.setFocus(null);
      }
      return patchCard(turnId, { ...card, state: "applied", undo: card.target.page === p.current });
    }
    if (card.type === "add_publication") {
      const t = card.target;
      const values = card.values;
      if (!(await tryEdit(t.page, applyPublication({ values }, t.list)))) return stale("這個論文清單在助手讀過之後已經變動了，所以沒有加入。請再說一次，或用左邊的「＋ 論文」。");
      p.editPage(t.page, applyPublication({ values }, t.list));
      if (t.pair && t.pairList && (await tryEdit(t.pair, applyPublication({ values }, t.pairList)))) p.editPage(t.pair, applyPublication({ values }, t.pairList));
      return patchCard(turnId, { ...card, state: "applied", undo: t.page === p.current });
    }
    if (card.type === "add_news") {
      const news = p.siteData ? readNews(p.siteData.text) : null;
      if (!news?.ok || news.sheetId) return stale("這個網站的最新消息現在不能直接新增，請到左邊的「最新消息」。");
      if (!card.zh.trim()) return stale("中文內容是空白的。");
      if (news.items.some((x) => x.date === card.date && same(x.content, card.zh))) return stale("已經有一則同一天、同樣內容的消息。");
      p.setNewsItems([newsItem(card), ...news.items]);
      return patchCard(turnId, { ...card, state: "applied" });
    }
    if (card.type === "add_item") {
      const t = card.target;
      if (!(await tryEdit(t.page, applyAddItem(card)))) return stale("這個清單在助手讀過之後已經變動了，所以沒有加入。請再說一次。");
      p.editPage(t.page, applyAddItem(card));
      if (t.page === p.current) p.setSelected(t.section);
      return patchCard(turnId, { ...card, state: "applied", undo: true });
    }
    if (card.type === "add_section") {
      if (card.after >= sectionCount) return stale("這一頁的區塊在助手讀過之後變少了，請再說一次要放在哪裡。");
      await p.insertBlock(card.after, "catalog", { id: card.block, fill: (section) => fillBlock(section, card), quiet: true });
      return patchCard(turnId, { ...card, state: "applied", undo: true });
    }
    if (card.type === "set_theme") {
      p.setTheme({ vars: Object.fromEntries(card.rows.map((r) => [r.key, r.after])) });
      return patchCard(turnId, { ...card, state: "applied" });
    }
    if (card.type === "set_site") {
      try {
        p.setSiteField(card.key, card.after);
      } catch (e) {
        return stale(e.message);
      }
      return patchCard(turnId, { ...card, state: "applied" });
    }
  }

  // 全部套用: one after another, each checked against the page as it is
  // by then; a proposal that no longer fits says so on its own card.
  async function applyAll(turn) {
    for (const card of turn.cards) if (card.ok && !card.state) await apply(turn.id, card);
  }

  const form = (
    <form
      className="ai-form-box"
      onSubmit={(e) => {
        e.preventDefault();
        send(text);
      }}
    >
      <label>
        <span className="sr-only">想怎麼改</span>
        <textarea
          ref={input}
          rows={text.length > 40 ? 3 : 2}
          value={text}
          maxLength={4000}
          placeholder={turns.length ? "還想怎麼改？" : "想改什麼，直接寫"}
          onChange={(e) => {
            setText(e.target.value);
            setBlankWarn(false);
          }}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a new line. Not while choosing characters in an input method.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(text);
            }
          }}
        />
      </label>
      <button type="submit" disabled={busy || text.trim().length < 2}>
        送出
      </button>
    </form>
  );
  const blankNote = blankWarn && (
    <p className="small-note warn-note" role="status">
      還有 {blanksIn(text)} 個［　］沒有填。照樣送出就再按一次；助手不會自己猜那些內容。
    </p>
  );

  return (
    <div className="ai-panel">
      <div className="ai-turns">
        {turns.length === 0 && (
          <div className="ai-rules">
            <p>
              <strong>先給你看，再動手。</strong>助手只會提出建議，每個修改都要你按「套用」。
            </p>
            <p>
              <strong>不會自己發布。</strong>套用後只是草稿，要你按「發布」才上線。
            </p>
            <p>
              <strong>不確定就問。</strong>日期、姓名不清楚時，助手會先問，不自己猜。
            </p>
          </div>
        )}
        {turns.map((turn) =>
          turn.role === "user" ? (
            <p key={turn.id} className="ai-said">
              {turn.text}
            </p>
          ) : (
            <div key={turn.id} className="ai-answer">
              {turn.text && <p className={turn.error ? "ai-error" : ""}>{turn.text}</p>}
              {turn.model && choice.allowed.length > 1 && <span className="ai-model-tag">{ASSIST_MODELS[turn.model]?.name}</span>}
              {turn.cards.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  busy={p.busy}
                  onChange={(next) => patchCard(turn.id, next)}
                  onApply={() => apply(turn.id, card)}
                  onDismiss={() => patchCard(turn.id, { ...card, state: "dismissed" })}
                />
              ))}
              {turn.cards.filter((c) => c.ok && !c.state).length > 1 && (
                <button type="button" className="ai-apply-all" disabled={p.busy} onClick={() => applyAll(turn)}>
                  全部套用（{turn.cards.filter((c) => c.ok && !c.state).length} 項）
                </button>
              )}
            </div>
          ),
        )}
        {busy && (
          <p className="ai-waiting" role="status">
            助手正在看這一頁…
          </p>
        )}
        <span ref={end} />
      </div>
      <div className="ai-foot">
        <details className="ai-commands" open={commandsOpen} onToggle={(e) => setCommandsOpen(e.currentTarget.open)}>
          <summary>設計規範指令</summary>
          <div className="ai-command-grid">
            {COMMANDS.map((c) => (
              <button
                type="button"
                key={c.id}
                disabled={busy || (c.local && !onAudit)}
                title={`${c.does}${c.dont ? "（" + c.dont + "）" : ""}`}
                onClick={() => {
                  if (c.local) return onAudit?.();
                  send(text, c.id);
                }}
              >
                <strong>{c.name}</strong>
                <span>{c.does}</span>
              </button>
            ))}
          </div>
          <p className="small-note">按一個指令，助手就照設計規範看這一頁；輸入框裡寫的字會一起送出當補充。</p>
        </details>
        {choice.allowed.length > 1 && (
          <div className="ai-model" role="radiogroup" aria-label="AI 助手用哪個模型">
            <span>模型</span>
            {choice.allowed.map((k) => (
              <button
                type="button"
                key={k}
                role="radio"
                aria-checked={model === k}
                className={model === k ? "on" : ""}
                disabled={busy}
                title={`${ASSIST_MODELS[k].model}：${ASSIST_MODELS[k].note}`}
                onClick={() => chooseModel(k)}
              >
                {ASSIST_MODELS[k].name}
                <small>{perCallTwd(k)}</small>
              </button>
            ))}
          </div>
        )}
        <div className="ai-prompts">
          {prompts.map((x) => (
            <button
              type="button"
              key={x.label}
              disabled={busy}
              onClick={() => {
                if (x.send) return send(x.send);
                setText(x.fill);
                input.current?.focus();
              }}
            >
              {x.label}
            </button>
          ))}
        </div>
        {form}
        {blankNote}
        <p className="small-note">
          {remaining !== null ? `這個網站今天還可以用 ${remaining} 次。` : ""}這一頁的文字會送到 AI 服務（Anthropic）處理。
        </p>
      </div>
    </div>
  );
}
