// Copies the curated stickers into library/stickers/ from pinned commits of
// their upstream repositories (cloned by the caller), so the editor bundles
// exactly these files. Run: node tools/fetch-stickers.mjs <fluentui-emoji dir> <bioicons dir>
//
//   Fluent Emoji (Microsoft, MIT)  assets/<Name>/Flat/*_flat.svg (people: Default/Flat)
//   Bioicons (CC0 folder only)     static/icons/cc-0/<Category>/<author>/<name>.svg
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [fluentDir, bioDir] = process.argv.slice(2);
const out = "library/stickers";
const git = (dir, ...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 64 << 20 });

// [English folder name, 中文名稱, 分類]
const FLUENT = [
  ["Health worker", "醫護人員", "醫療"], ["Woman health worker", "女醫護", "醫療"], ["Man health worker", "男醫護", "醫療"],
  ["Stethoscope", "聽診器", "醫療"], ["Syringe", "針筒", "醫療"], ["Pill", "藥丸", "醫療"], ["Adhesive bandage", "OK 繃", "醫療"],
  ["Hospital", "醫院", "醫療"], ["Ambulance", "救護車", "醫療"], ["Drop of blood", "血滴", "醫療"], ["Anatomical heart", "心臟", "醫療"],
  ["Lungs", "肺", "醫療"], ["Brain", "大腦", "醫療"], ["Bone", "骨頭", "醫療"], ["Tooth", "牙齒", "醫療"], ["Crutch", "拐杖", "醫療"],
  ["Manual wheelchair", "輪椅", "醫療"], ["Thermometer", "體溫計", "醫療"], ["Lab coat", "實驗衣", "研究"],
  ["Microscope", "顯微鏡", "研究"], ["Test tube", "試管", "研究"], ["Petri dish", "培養皿", "研究"], ["Dna", "DNA", "研究"],
  ["Alembic", "蒸餾瓶", "研究"], ["Bar chart", "長條圖", "研究"], ["Chart increasing", "成長圖表", "研究"], ["Clipboard", "記錄板", "研究"],
  ["Light bulb", "靈感燈泡", "研究"], ["Magnifying glass tilted left", "放大鏡", "研究"], ["Laptop", "筆電", "研究"], ["Robot", "機器人", "研究"],
  ["Books", "書本", "教學"], ["Open book", "打開的書", "教學"], ["Graduation cap", "學士帽", "教學"], ["Memo", "筆記", "教學"],
  ["Pencil", "鉛筆", "教學"], ["School", "學校", "教學"], ["Teacher", "老師", "教學"], ["Student", "學生", "教學"], ["Scroll", "證書卷軸", "教學"],
  ["Trophy", "獎盃", "榮譽"], ["1st place medal", "金牌", "榮譽"], ["Sports medal", "獎牌", "榮譽"], ["Glowing star", "閃亮星星", "榮譽"],
  ["Party popper", "拉炮", "活動"], ["Confetti ball", "彩球", "活動"], ["Balloon", "氣球", "活動"], ["Wrapped gift", "禮物", "活動"],
  ["Birthday cake", "生日蛋糕", "活動"], ["Clapping hands", "拍手", "活動"], ["Handshake", "握手", "活動"], ["Heart hands", "比心", "活動"],
  ["Thumbs up", "讚", "活動"], ["Camera with flash", "相機", "活動"], ["Airplane", "飛機（出國）", "活動"], ["Globe showing asia-australia", "地球（亞洲）", "活動"],
  ["Calendar", "日曆", "公告"], ["Spiral calendar", "行事曆", "公告"], ["Alarm clock", "鬧鐘", "公告"], ["Loudspeaker", "大聲公", "公告"],
  ["Megaphone", "擴音器", "公告"], ["Bell", "鈴鐺", "公告"], ["Pushpin", "圖釘", "公告"], ["Envelope", "信封", "公告"],
  ["Telephone receiver", "電話", "公告"], ["Link", "連結", "公告"], ["Check mark button", "完成", "公告"], ["Warning", "注意", "公告"],
  ["Speech balloon", "對話框", "公告"], ["Red heart", "紅心", "心情"], ["Sparkles", "閃光", "心情"], ["Smiling face with smiling eyes", "微笑", "心情"],
  ["Seedling", "幼苗", "自然"], ["Four leaf clover", "幸運草", "自然"], ["Sunflower", "向日葵", "自然"], ["Sun", "太陽", "自然"],
];

const BIO_CATS = {
  Lab_apparatus: "實驗器材", Safety_symbols: "安全標示", Human_physiology: "人體生理", Cell_types: "細胞",
  Imaging: "影像", General_items: "一般物品", Scientific_graphs: "科學圖表", Microbiology: "微生物",
  Viruses: "病毒", Blood_Immunology: "血液與免疫", Machine_Learning: "機器學習", Computer_hardware: "電腦設備",
};
const MAX_BYTES = 40_000; // keeps the bundle light; very detailed drawings are skipped

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "fluent"), { recursive: true });
fs.mkdirSync(path.join(out, "bioicons"), { recursive: true });
const items = [];

const fluentCommit = git(fluentDir, "rev-parse", "HEAD").trim();
const fluentFiles = git(fluentDir, "ls-tree", "-r", "--name-only", "HEAD", "assets/").split("\n");
for (const [en, name, group] of FLUENT) {
  const file =
    fluentFiles.find((f) => f.startsWith(`assets/${en}/Flat/`) && f.endsWith("_flat.svg")) ||
    fluentFiles.find((f) => f.startsWith(`assets/${en}/Default/Flat/`) && f.endsWith(".svg"));
  if (!file) {
    console.warn("missing fluent:", en);
    continue;
  }
  const svg = git(fluentDir, "show", "HEAD:" + file);
  const id = "fluent-" + slug(en);
  fs.writeFileSync(path.join(out, "fluent", id + ".svg"), svg.trim() + "\n");
  items.push({ id, name, en, group, source: "fluent", file: "fluent/" + id + ".svg" });
}

const bioCommit = git(bioDir, "rev-parse", "HEAD").trim();
const bioFiles = git(bioDir, "ls-tree", "-r", "--name-only", "HEAD", "static/icons/cc-0/").split("\n").filter((f) => f.endsWith(".svg"));
for (const f of bioFiles) {
  const [, , , cat, author, file] = f.split("/");
  if (!BIO_CATS[cat] || !file) continue;
  const svg = git(bioDir, "show", "HEAD:" + f);
  if (svg.length > MAX_BYTES || /<image\b|base64,/.test(svg)) continue;
  const en = file.replace(/\.svg$/, "").replace(/[_-]+/g, " ").trim();
  const id = "bio-" + slug(cat + "-" + en);
  fs.writeFileSync(path.join(out, "bioicons", id + ".svg"), svg.trim() + "\n");
  items.push({ id, name: en, en, group: BIO_CATS[cat], source: "bioicons", author: author.replace(/[_-]+/g, " "), file: "bioicons/" + id + ".svg" });
}

fs.writeFileSync(
  path.join(out, "index.json"),
  JSON.stringify(
    {
      sources: {
        fluent: { name: "Fluent Emoji (Microsoft)", license: "MIT", url: "https://github.com/microsoft/fluentui-emoji", commit: fluentCommit },
        bioicons: { name: "Bioicons (CC0 collection)", license: "CC0 1.0", url: "https://github.com/duerrsimon/bioicons", commit: bioCommit },
      },
      items,
    },
    null,
    1,
  ),
);
fs.writeFileSync(path.join(out, "fluent", "LICENSE"), git(fluentDir, "show", "HEAD:LICENSE"));
fs.writeFileSync(path.join(out, "bioicons", "LICENSE"), "The files in this folder come from the CC0 collection of Bioicons (https://bioicons.com, https://github.com/duerrsimon/bioicons, static/icons/cc-0/).\nThey are dedicated to the public domain under CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/\nAuthors are recorded per icon in ../index.json.\n");
console.log("fluent", items.filter((i) => i.source === "fluent").length, "bioicons", items.filter((i) => i.source === "bioicons").length);
