// Local LabSite Cloud without workerd: runs the real worker code on Node.
//   http://127.0.0.1:8787  editor (../dist) + /api   — signed in as DEV_USER_EMAIL
//   http://127.0.0.1:8788  public sites (published versions)
// Data lives in cloud/.wrangler/node-dev/ (one SQLite file, files included).
// Like production: no R2 (file contents go to D1). Flags:
//   --invite-only   ignore DEV_AUTH; sign in only with invite links
//   --r2            keep file contents in a folder acting as R2
//   --ai-mock       answer the Claude API with canned themes and assistant
//                   proposals (no key needed), to work on the AI UI offline
//   --no-key        with --ai-mock: start without a key, to try 「AI 助手設定」
//
//   npm run build            (in labsite-studio/, to refresh ../dist)
//   npm --prefix cloud run dev:node
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, normalize } from "node:path";
import { sqliteD1, dirR2 } from "./bindings.js";
const flags = new Set(process.argv.slice(2));
import { createApp } from "../src/api.js";
import { serve } from "../src/sites.js";
import { contentType } from "../src/mime.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const state = join(here, "../.wrangler/node-dev");
mkdirSync(state, { recursive: true });
const dist = join(here, "../../dist");

function devVars() {
  const file = join(here, "../.dev.vars");
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^\w+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url);
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, "");
    if (!path || path.endsWith("/") || path.endsWith("\\")) path += "index.html";
    let file = join(dist, path);
    if (!file.startsWith(dist) || !existsSync(file)) file = join(dist, "index.html"); // SPA fallback
    if (!existsSync(file)) return new Response("先執行 npm run build 產生 dist/", { status: 500 });
    return new Response(readFileSync(file), { headers: { "Content-Type": contentType(file) } });
  },
};

const env = {
  ADMIN_EMAILS: "bobyu89@gmail.com",
  SITE_URL_TEMPLATE: "http://127.0.0.1:8788/{slug}/",
  DEV_AUTH: "on",
  DEV_USER_EMAIL: "bobyu89@gmail.com",
  ...devVars(),
  ...(flags.has("--invite-only") ? { DEV_AUTH: "off" } : {}),
  DB: sqliteD1(join(state, "labsite.sqlite")),
  ...(flags.has("--r2") ? { BLOBS: dirR2(join(state, "blobs")) } : {}),
  ASSETS,
};
// Canned Messages API reply for --ai-mock: three fixed proposals, one of them
// deliberately too light so the contrast repair path is exercised.
const mockThemes = [
  { name: "清晨病房", rationale: "（模擬回應）淡藍與木色，安靜可信。", research: "#2c6e91", team: "#7a5230", publications: "#3f6b4a", join: "#8a3d3d", ink: "#16191c", wall: "#eef1f2", font: "legible", radius: 4 },
  { name: "研討會海報", rationale: "（模擬回應）高對比的學術配色。", research: "#1d3f73", team: "#a33b2a", publications: "#2f5d50", join: "#5b4b8a", ink: "#111418", wall: "#f1f2f4", font: "scholar", radius: 0 },
  { name: "春日校園", rationale: "（模擬回應）偏淺的綠色會被自動調深。", research: "#8fd19e", team: "#9ecbe8", publications: "#f2b880", join: "#c9a0dc", ink: "#333333", wall: "#f5f7f2", font: "public", radius: 10 },
];
// The assistant's canned answers: picks a proposal from words in the request,
// using the ids the editor sent, so 套用 can be tried end to end.
function mockAssist(body) {
  const last = String(body.messages.at(-1)?.content || "");
  const ask = last.slice(last.lastIndexOf("老師說：") + 4);
  let context = {};
  try {
    context = JSON.parse(last.slice(last.indexOf("<site_context>") + 14, last.indexOf("</site_context>")));
  } catch {
    /* answer without proposals */
  }
  const fields = context.page?.fields || [];
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const block = (context.blocks || []).find((b) => ask.includes("「" + b.name + "」"));
  if (block)
    return {
      reply: `（模擬回應）我用「${block.name}」寫好了一段，確認後按套用。`,
      changes: [
        {
          type: "add_section",
          block: block.id,
          after: context.page?.selectedSection ?? -1,
          texts: block.texts.map((t, i) => (i === 0 ? "（示範）" + block.name : t.example)),
          items: Array.from({ length: block.defaultItems }, (_, i) => block.itemFields.map((f, j) => (j === 0 ? `示範項目 ${i + 1}` : f.example))),
        },
      ],
    };
  if (/成員|新增一位|加一位/.test(ask) && context.lists?.length) {
    const list = context.lists[0];
    return { reply: "（模擬回應）我準備在清單最後加一筆。", changes: [{ type: "add_item", list: list.id, position: "end", values: list.itemFields.map((f, i) => (i === 0 ? "（示範）新成員" : "")) }] };
  }
  if (/消息/.test(ask))
    return { reply: "（模擬回應）我準備在最新消息加這一則，確認後按套用。", changes: [{ type: "add_news", date: today, category: "公告", zh: "（示範）" + ask.replace(/^.*?[：:]/, "").slice(0, 60), en: "(Demo) News item written by the mock assistant.", link: "" }] };
  if (/電話/.test(ask)) return { reply: "（模擬回應）我準備把電話改成這個號碼。", changes: [{ type: "set_site", key: "phone", value: (ask.match(/[\d-]{7,}/) || ["02-8792-3100"])[0] }] };
  if (/論文/.test(ask) && context.publicationLists?.length)
    return { reply: "（模擬回應）我準備把這篇加到清單最前面。", changes: [{ type: "add_publication", list: context.publicationLists[0].id, citation: "Wang, X. M., & Sung, C. M. (2026). A demo reference from the mock assistant. Journal of Advanced Nursing, 82(3), 1234-1245.", bold: context.publicationLists[0].usualBoldName || "Sung, C. M.", journal: "Journal of Advanced Nursing", url: "https://doi.org/10.1111/jan.99999" }] };
  if (/哪裡/.test(ask)) return { reply: "（模擬回應）論文在「成果發表」那一頁：左邊的頁面清單點「成果發表」，或直接按「＋ 論文」。", changes: [] };
  if (!fields.length) return { reply: "（模擬回應）這一頁沒有可以修改的文字。", changes: [] };
  if (/錯字|潤飾|全部/.test(ask) && fields.length > 1)
    return { reply: "（模擬回應）我找到兩個地方可以改，確認後按套用。", changes: fields.slice(0, 2).map((f) => ({ type: "set_text", field: f.id, text: f.text + "（示範修改）" })) };
  return { reply: "（模擬回應）我準備修改這一段，確認後按套用。", changes: [{ type: "set_text", field: fields[0].id, text: fields[0].text + "（示範修改）" }] };
}
const mockFetch = async (url, init) => {
  if (!String(url).includes("api.anthropic.com")) return fetch(url, init);
  if (String(url).includes("/v1/models/"))
    return new Response(JSON.stringify({ id: "claude-opus-5-5", type: "model", display_name: "Claude Opus 5.5", created_at: "2026-01-01T00:00:00Z" }), {
      headers: { "Content-Type": "application/json" },
    });
  await new Promise((r) => setTimeout(r, 800));
  const body = JSON.parse(init?.body || "{}");
  const assist = !!body.output_config?.format?.schema?.properties?.changes;
  if (body.output_config?.format?.schema?.properties?.alt_en)
    return new Response(
      JSON.stringify({
        id: "msg_mock", type: "message", role: "assistant", model: "claude-opus-5-5",
        content: [{ type: "text", text: JSON.stringify({ caption: "（模擬）研究室成員合影", alt: "（模擬）多位研究室成員在會議室前排站立合影。", alt_en: "(Mock) Lab members standing together for a group photo." }) }],
        stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  return new Response(
    JSON.stringify({
      id: "msg_mock", type: "message", role: "assistant", model: "claude-opus-5-5",
      content: [{ type: "text", text: JSON.stringify(assist ? mockAssist(body) : { themes: mockThemes }) }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
};
// --no-key: leave the key unset, to try the 「AI 助手設定」 page (any sk-ant-… value passes the mock).
if (flags.has("--ai-mock") && !flags.has("--no-key")) env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY || "mock";
const app = createApp(flags.has("--ai-mock") ? { fetchImpl: mockFetch } : {});

function listen(port, handler) {
  createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: Object.entries(req.headers).filter(([, v]) => typeof v === "string"),
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const c of response.body) res.write(c);
      res.end();
    } catch (e) {
      console.error(e);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(String(e.stack || e));
    }
  }).listen(port, "127.0.0.1", () => console.log(`[labsite-cloud] http://127.0.0.1:${port}`));
}

listen(8787, (request) => app.fetch(request, env));
listen(8788, (request) => serve(request, env));
console.log(
  env.DEV_AUTH === "on"
    ? `[labsite-cloud] signed in as ${env.DEV_USER_EMAIL}; data in ${state}`
    : `[labsite-cloud] invite links only (node scripts/invite.js <email> --local); data in ${state}`,
);
