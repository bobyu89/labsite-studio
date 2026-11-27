// 從我的資料帶入 (ProfileImport.jsx): where each part of a teacher's CV goes
// on the site, and the request the AI assistant gets for it.
import { splitName } from "./bibImport.js";

const lines = (list, f = (x) => x) => list.map((x) => "- " + f(x)).join("\n");
const pair = (x) => [x.zh, x.en].filter(Boolean).join(" / ");

// Which page each part goes to, by the site's own page names.
export function importTargets(pages) {
  const zh = pages.filter((x) => !x.startsWith("en/"));
  const find = (re) => zh.find((x) => re.test(x));
  const home = zh.includes("index.html") ? "index.html" : zh[0];
  const research = find(/(^|\/)research\.html?$/i) || home;
  return {
    person: find(/(^|\/)(pi|professor|advisor|about)\.html?$/i) || find(/(^|\/)(members?|team|people)\.html?$/i) || home,
    research,
    projects: find(/(^|\/)(projects?|grants?)\.html?$/i) || research,
    home,
    contact: find(/(^|\/)(contact|join)\.html?$/i) || home,
  };
}

// The request for the AI assistant for one part (kept well under its 4000 characters).
export function importRequest(part, data) {
  const keep = "只用下面的資料；網頁上沒有對應欄位的就略過，不要編造。中文頁和英文頁都要更新。";
  if (part === "person") {
    const p = data.person;
    return [
      "用我的履歷更新這一頁的主持人介紹。" + keep,
      p.name_zh || p.name_en ? `姓名：${[p.name_zh, p.name_en].filter(Boolean).join(" / ")}` : "",
      pair(p.title) && `職稱：${pair(p.title)}`,
      pair(p.department) && `系所：${pair(p.department)}`,
      pair(data.bio) && `簡介（中）：${data.bio.zh}\n簡介（英）：${data.bio.en}`,
      data.education.length ? "學歷：\n" + lines(data.education, pair) : "",
      data.positions.length ? "經歷：\n" + lines(data.positions, pair) : "",
      data.awards.length ? "獲獎：\n" + lines(data.awards) : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 3800);
  }
  if (part === "research")
    return ("用我的研究主題更新這一頁的研究方向（主題數量和網頁上的不同時，用「新增一筆」或改現有的）。" + keep + "\n" + lines(data.topics, (t) => `${pair(t.title)}：${t.desc.zh}｜${t.desc.en}`)).slice(0, 3800);
  if (part === "projects")
    return ("把這些研究計畫放到這一頁的計畫清單（新的在前面）。" + keep + "\n" + lines(data.projects, (x) => [x.years, x.title, x.funder, x.role].filter(Boolean).join("，"))).slice(0, 3800);
  if (part === "home")
    return [
      "依我的資料改首頁的研究室介紹：首頁那一句照「我們研究［誰］的［什麼問題］，用［什麼方法］，讓［什麼改變］」[W-01]，其他介紹段落也一起調整。" + keep,
      pair(data.bio) && `簡介：${data.bio.zh}`,
      data.topics.length ? "研究主題：" + data.topics.map((t) => t.title.zh || t.title.en).join("、") : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 3800);
  if (part === "contact")
    return ["把網站的聯絡資料改成下面這些（研究室資料）。", data.contact.email && `Email：${data.contact.email}`, data.contact.phone && `電話：${data.contact.phone}`, data.contact.office && `地址／辦公室：${data.contact.office}`]
      .filter(Boolean)
      .join("\n");
  return "";
}

// Papers from the CV → entries for the paper import (its DOI is looked up there).
export function paperEntries(list) {
  return list.map((x) => ({
    meta: {
      authors: x.authors.map(splitName).filter(Boolean),
      year: x.year,
      title: x.title,
      journal: x.journal,
      volume: x.volume,
      issue: x.issue,
      pages: x.pages,
      article: "",
      doi: x.doi,
      pmid: "",
    },
  }));
}

