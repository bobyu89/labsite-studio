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
export function saveMessage(files) {
  const pages = [];
  let images = 0;
  let siteData = false;
  for (const f of files) {
    if (/\.html$/.test(f.path)) pages.push(pageLabel(f.path) + (f.path.startsWith("en/") ? "（英文）" : ""));
    else if (f.path === "js/data.js") siteData = true;
    else images++;
  }
  const parts = [...pages, ...(siteData ? ["網站資料"] : [])];
  let msg = parts.length ? "修改 " + parts.join("、") : "";
  if (images) msg += (msg ? "，" : "") + `換 ${images} 張圖片`;
  return msg || `更新 ${files.length} 個檔案`;
}
