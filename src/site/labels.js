// Human names for site files, used in the page picker and in version messages.
export function pageLabel(path) {
  const file = path.split("/").pop().replace(/\.html$/, "");
  const names = {
    index: "首頁",
    pi: "主持人",
    research: "研究主題",
    projects: "研究計畫",
    publications: "成果發表",
    conferences: "研討會論文",
    awards: "得獎紀錄",
    members: "團隊成員",
    education: "教學資源",
    collaboration: "合作交流",
    resources: "開放資源",
    gallery: "活動花絮",
    patents: "專利",
  };
  return names[file] || file;
}
// A version message a teacher can read in the history: page names, not paths.
//   "修改 首頁"  /  "修改 首頁（英文）、團隊成員，換 2 張圖片"  /  "修改 網站資料"
// One-line version message from the files saved together, in teachers' words:
// "修改 首頁、網站資料，換 2 張圖片", "更新 雲端相簿", "更新 外觀".
const IMAGE = /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i;
export function saveMessage(files) {
  const pages = [];
  let images = 0;
  let others = 0;
  const parts = new Set();
  for (const f of files) {
    const path = f.path;
    if (/\.html$/.test(path)) pages.push(pageLabel(path) + (path.startsWith("en/") ? "（英文）" : ""));
    else if (path === "js/data.js") parts.add("網站資料");
    else if (path === "data/albums.json") parts.add("雲端相簿");
    else if (path === "js/labsite-albums.js" || path === "css/labsite-blocks.css") continue; // part of the blocks
    else if (/^css\//.test(path) || path === "labsite/skins.json") parts.add("外觀");
    else if (f.delete) others++;
    else if (IMAGE.test(path)) images++;
    else others++;
  }
  const names = [...pages, ...parts];
  let msg = names.length ? "修改 " + names.join("、") : "";
  if (images) msg += (msg ? "，" : "") + `換 ${images} 張圖片`;
  if (others) msg += (msg ? "，" : "") + `另有 ${others} 個檔案`;
  return msg || `更新 ${files.length} 個檔案`;
}
