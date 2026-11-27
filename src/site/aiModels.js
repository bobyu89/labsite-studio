// AI 助手的模型: the teacher picks how the assistant thinks — the best one,
// a cheaper one for everyday edits, or the cheapest for typos and polish.
// The admin decides which may be used and which is the default (平台設定).
// Other AI features (reading a CV, web search, the site wizard) keep the
// standard model: they need its judgement. Shared by the editor and the server.

export const ASSIST_MODELS = {
  opus: {
    id: "claude-opus-5-5",
    name: "標準",
    model: "Claude Opus 5.5",
    note: "品質最好，適合改寫、整段新內容、翻譯",
    usd: 0.12, // one assistant request, estimated (cost calculator)
    fallback: true,
  },
  sonnet: {
    id: "claude-sonnet-5-5",
    name: "省錢",
    model: "Claude Sonnet 5.5",
    note: "日常修改夠用，價錢約一半",
    usd: 0.06,
    fallback: true,
  },
  haiku: {
    id: "claude-haiku-5-5",
    name: "最省",
    model: "Claude Haiku 5.5",
    note: "錯字、潤飾、格式這類簡單的事",
    usd: 0.003,
    // Claude Haiku 5.5 has no server-side refusal fallback: the request is sent without it.
    fallback: false,
  },
};
export const MODEL_KEYS = Object.keys(ASSIST_MODELS);
export const DEFAULT_MODEL = "opus";

// Anything stored → { allowed: [keys], default: key }, never empty.
export function cleanModelChoice(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const allowed = [...new Set((Array.isArray(src.allowed) ? src.allowed : MODEL_KEYS).filter((k) => MODEL_KEYS.includes(k)))];
  const list = allowed.length ? MODEL_KEYS.filter((k) => allowed.includes(k)) : [DEFAULT_MODEL];
  const def = list.includes(src.default) ? src.default : list.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : list[0];
  return { allowed: list, default: def };
}

// The model a request may use: the one asked for if allowed, else the default.
export const pickModel = (asked, choice) => (choice.allowed.includes(asked) ? asked : choice.default);

// Rough NT$ per request for the picker (fx: NT$ per US$).
export const perCallTwd = (key, fx = 32) => {
  const twd = ASSIST_MODELS[key].usd * fx;
  return twd < 1 ? "不到 NT$1" : "約 NT$" + Math.round(twd);
};
