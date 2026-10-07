// AI themes: a lab describes the look it wants in one sentence; Claude
// proposes three colour/type sets as structured JSON, and every proposal is
// then forced through the same contrast rules as hand-made and generated
// themes (src/site/themes.js), so nothing unreadable reaches a site.
import Anthropic from "@anthropic-ai/sdk";
import { RepoError } from "./repo.js";
import { FONT_PAIRS, themeFromColors, contrastIssues } from "../../src/site/themes.js";

export const AI_MODEL = "claude-opus-5-5";
export const AI_DAILY_LIMIT = 20;

const colour = (description) => ({ type: "string", description });
const THEME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["themes"],
  properties: {
    themes: {
      type: "array",
      description: "Exactly three distinct proposals.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "rationale", "research", "team", "publications", "join", "ink", "wall", "font", "radius"],
        properties: {
          name: { type: "string", description: "Short theme name in Traditional Chinese, at most 12 characters." },
          rationale: { type: "string", description: "One sentence in Traditional Chinese on how it answers the description." },
          research: colour("Hex #rrggbb for the research zone; white text sits on it."),
          team: colour("Hex #rrggbb for the team zone; white text sits on it."),
          publications: colour("Hex #rrggbb for the publications zone; white text sits on it."),
          join: colour("Hex #rrggbb for the join/contact zone; white text sits on it."),
          ink: colour("Hex #rrggbb for body text: near-black."),
          wall: colour("Hex #rrggbb for the light page ground behind white panels."),
          font: { type: "string", enum: FONT_PAIRS.map((f) => f.id) },
          radius: { type: "integer", enum: [0, 4, 10] },
        },
      },
    },
  },
};

const FONT_NOTES = FONT_PAIRS.map((f) => `- ${f.id}: ${f.latin} + ${f.zh}（${f.name}）`).join("\n");
const SYSTEM = `You design colour and type themes for research-lab websites in Taiwan (mostly nursing and health sciences). Every site uses the same layout; a theme only sets four zone colours (research, team, publications, join/contact — each carries white text and also appears as text on white and on the page ground), a near-black ink, a light page ground ("wall"), a font pairing and a corner radius.

Given the lab's description, propose three themes that differ from one another and each answer the description. Keep them usable for an academic audience (prospective students and reviewers). The site checks contrast afterwards and darkens any colour that is too light, so choose colours that already work with white text.

Font pairings:
${FONT_NOTES}`;

function client(env, fetchImpl) {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, fetch: fetchImpl, maxRetries: 1, timeout: 60_000 });
}

// → [{ name, rationale, font, vars, fontUrl, adjusted }]
export async function aiThemes(env, description, fetchImpl) {
  if (!env.ANTHROPIC_API_KEY) throw new RepoError(503, "AI 外觀尚未設定（管理者需要設定 ANTHROPIC_API_KEY）。");
  const text = String(description || "").replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 300) throw new RepoError(400, "請用 2–300 字描述想要的感覺。");
  let response;
  try {
    response = await client(env, fetchImpl).beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: THEME_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `研究室對網站外觀的描述：${text}` }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new RepoError(503, "AI 服務忙碌中，請稍後再試。");
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new RepoError(500, "AI 金鑰無效或沒有權限，請聯絡管理者。");
    if (e instanceof Anthropic.BadRequestError) throw new RepoError(502, "AI 請求格式錯誤：" + e.message);
    if (e instanceof Anthropic.APIError) throw new RepoError(502, `AI 服務回應錯誤（${e.status ?? "連線"}），請稍後再試。`);
    throw e;
  }
  if (response.stop_reason === "refusal") throw new RepoError(422, "這段描述無法產生外觀，請換個說法。");
  if (response.stop_reason === "max_tokens") throw new RepoError(502, "AI 回應被截斷，請再試一次。");
  const block = response.content.find((b) => b.type === "text");
  let data;
  try {
    data = JSON.parse(block?.text || "");
  } catch {
    throw new RepoError(502, "AI 回應格式不正確，請再試一次。");
  }
  const themes = (Array.isArray(data?.themes) ? data.themes : [])
    .slice(0, 3)
    .map((t) => ({
      ...themeFromColors({
        name: t.name,
        colors: { research: t.research, team: t.team, publications: t.publications, join: t.join, ink: t.ink, wall: t.wall },
        font: t.font,
        radius: t.radius,
      }),
      rationale: String(t.rationale || "").slice(0, 120),
    }))
    .filter((t) => contrastIssues(t.vars).length === 0);
  if (!themes.length) throw new RepoError(502, "AI 沒有產生可用的外觀，請再試一次。");
  return themes;
}

// Requests in the last 24 hours for one site (each logged as an event).
export async function aiUsage(env, siteId, now = Date.now()) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE site_id = ? AND kind = 'ai_theme' AND created_at > ?")
    .bind(siteId, now - 24 * 3600 * 1000)
    .first();
  return Number(row?.n || 0);
}
