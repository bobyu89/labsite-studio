import { DEFAULT_THEME, validTheme } from "./theme.js";
export const SCHEMA_VERSION = 2;
export const TYPES = ["hero", "research", "news", "team"];
export const typeNames = {
  hero: "首頁主視覺",
  research: "研究方向",
  news: "最新消息",
  team: "研究團隊",
};
const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const string = (v) => typeof v === "string" && v.length <= 30000;
const id = (v) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const unique = (a) => new Set(a.map((x) => x.id)).size === a.length;
const entries = (a, max) => Array.isArray(a) && a.length <= max;
const fail = (message) => {
  throw new Error(message);
};
const check = (condition, message) => {
  if (!condition) fail(message);
};

// Migration is pure and never writes storage. Saving remains an explicit action.
export function migrateLegacy(d) {
  check(
    object(d) && Array.isArray(d.blocks) && Array.isArray(d.assets),
    "無法辨識這份舊版草稿。",
  );
  return {
    schemaVersion: 2,
    name: d.name,
    english: d.english,
    email: d.email,
    theme: { ...DEFAULT_THEME, color: d.color ?? DEFAULT_THEME.color },
    assets: structuredClone(d.assets),
    pages: [
      {
        id: "home",
        name: "首頁",
        path: "/",
        blocks: d.blocks.map((b) =>
          b.type === "hero"
            ? {
                ...b,
                props: {
                  title: d.title,
                  description: d.description,
                  layout: d.heroLayout ?? "split",
                  cover: d.cover ?? null,
                },
              }
            : { ...b, collectionId: b.type },
        ),
      },
    ],
    collections: {
      research: structuredClone(d.research),
      news: structuredClone(d.news),
      team: structuredClone(d.team),
    },
  };
}
export function assertDocument(d) {
  check(object(d) && d.schemaVersion === 2, "不支援的草稿格式版本。");
  check(
    ["name", "english", "email"].every((k) => string(d[k])),
    "網站基本資訊格式不正確。",
  );
  check(validTheme(d.theme), "主題設定格式不正確。");
  // This release intentionally edits one home page. Reject extra pages rather than silently drop them.
  check(
    entries(d.pages, 1) && d.pages.length === 1,
    "此版本支援一個首頁，無法匯入多頁草稿。",
  );
  const p = d.pages[0];
  check(
    object(p) &&
      id(p.id) &&
      string(p.name) &&
      p.path === "/" &&
      entries(p.blocks, 50) &&
      p.blocks.length > 0,
    "首頁或區塊格式不正確。",
  );
  check(object(d.collections), "找不到內容集合。");
  for (const type of TYPES.slice(1)) {
    const list = d.collections[type];
    check(
      entries(list, 500) &&
        list.every(
          (x) =>
            object(x) &&
            id(x.id) &&
            string(x.title) &&
            string(x.description) &&
            (type !== "news" ||
              (string(x.date) &&
                (x.date === "" || /^\d{4}-\d{2}-\d{2}$/.test(x.date)))),
        ) &&
        unique(list),
      `${typeNames[type]}的內容或項目 ID 格式不正確。`,
    );
  }
  check(
    entries(d.assets, 8) &&
      d.assets.every(
        (a) =>
          object(a) &&
          id(a.id) &&
          string(a.name) &&
          string(a.alt) &&
          typeof a.src === "string" &&
          a.src.length <= 2900000 &&
          /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
            a.src,
          ),
      ) &&
      unique(d.assets),
    "圖片資料格式不正確；只接受檔案內的 JPG、PNG 或 WebP 圖片。",
  );
  for (const b of p.blocks) {
    check(
      object(b) &&
        id(b.id) &&
        TYPES.includes(b.type) &&
        string(b.title) &&
        typeof b.visible === "boolean",
      "區塊格式不正確。",
    );
    if (b.type === "hero")
      check(
        object(b.props) &&
          string(b.props.title) &&
          string(b.props.description) &&
          ["split", "center"].includes(b.props.layout) &&
          (b.props.cover === null ||
            d.assets.some((a) => a.id === b.props.cover)),
        "主視覺內容或圖片引用不正確。",
      );
    else
      check(
        b.collectionId === b.type &&
          Object.hasOwn(d.collections, b.collectionId),
        "區塊引用了不存在的內容集合。",
      );
  }
  check(unique(p.blocks), "區塊 ID 重複，無法安全匯入。");
  return d;
}
export function normalizeDocument(value) {
  check(object(value), "草稿必須是 JSON 物件。");
  const doc =
    value.schemaVersion === 2
      ? structuredClone(value)
      : value.schemaVersion === undefined || value.schemaVersion === 1
        ? migrateLegacy(value)
        : fail("這份草稿來自較新的版本，請先更新 LabSite。");
  assertDocument(doc);
  // Explicit projection drops unknown properties rather than letting imported objects become executable settings.
  return {
    schemaVersion: 2,
    name: doc.name,
    english: doc.english,
    email: doc.email,
    theme: Object.fromEntries(
      Object.keys(DEFAULT_THEME).map((key) => [key, doc.theme[key]]),
    ),
    assets: doc.assets.map(({ id, name, src, alt }) => ({
      id,
      name,
      src,
      alt,
    })),
    pages: doc.pages.map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      blocks: p.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title,
        visible: b.visible,
        ...(b.type === "hero"
          ? {
              props: {
                title: b.props.title,
                description: b.props.description,
                layout: b.props.layout,
                cover: b.props.cover,
              },
            }
          : { collectionId: b.collectionId }),
      })),
    })),
    collections: Object.fromEntries(
      TYPES.slice(1).map((t) => [
        t,
        doc.collections[t].map((x) => ({
          id: x.id,
          title: x.title,
          description: x.description,
          ...(t === "news" ? { date: x.date } : {}),
        })),
      ]),
    ),
  };
}
export function parseProject(text) {
  check(
    typeof text === "string" && text.length <= 25000000,
    "備份檔超過 25 MB，無法匯入。",
  );
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    fail("這不是有效的 JSON 檔案。");
  }
  check(object(raw), "無法辨識這份備份。");
  if (Object.hasOwn(raw, "draft"))
    check([1, 2].includes(raw.schemaVersion), "備份檔版本不受支援。");
  return normalizeDocument(Object.hasOwn(raw, "draft") ? raw.draft : raw);
}
export function serializeProject(d) {
  return JSON.stringify(
    { schemaVersion: 2, draft: normalizeDocument(d) },
    null,
    2,
  );
}
export const homepage = (d) => d.pages[0];
export const firstHero = (d) =>
  homepage(d).blocks.find((b) => b.type === "hero");
export const heroTitle = (d) => firstHero(d)?.props.title ?? d.name;
export function newBlock(type, id) {
  return {
    id,
    type,
    title: typeNames[type],
    visible: true,
    ...(type === "hero"
      ? {
          props: {
            title: "寫下你的研究故事",
            description: "在這裡介紹研究主題、方法與希望帶來的改變。",
            layout: "split",
            cover: null,
          },
        }
      : { collectionId: type }),
  };
}
