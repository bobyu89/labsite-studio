// 動畫庫: animated components a teacher can insert on any page. Each is a
// body-level <section class="ls-block …"> whose texts are ordinary editable
// fields and whose repeated items are ordinary lists (add / remove / reorder).
// The behaviour lives in js/labsite-blocks.js (blockRuntime.js); without
// JavaScript every component still shows all its content.
// Names follow common UI pattern names (統計卡、時間軸、分頁、跑馬燈…); the
// markup and styles are LabSite's own.

const li = (n, make) => Array.from({ length: n }, (_, i) => make(i)).join("\n");

export const ENTRANCES = [
  ["", "不要動畫"],
  ["fade", "淡入"],
  ["rise", "由下往上"],
  ["zoom", "放大出現"],
  ["left", "從左滑入"],
  ["right", "從右滑入"],
  ["stagger", "項目依序出現"],
];

export const BLOCK_CATALOG = [
  {
    id: "stats",
    kicker: "AT A GLANCE",
    name: "數字統計",
    en: "Stat Cards",
    group: "數據呈現",
    note: "捲到這裡時，數字從 0 跳到你寫的數字（可以寫 30+、2,400）。",
    html: () => `<section class="ls-block ls-stats-section" data-ls-anim="rise">
  <div class="ls-wrap">
    <h2 class="ls-title">研究成果一覽</h2>
    <ul class="ls-stats">
${[["26", "期刊論文"], ["15", "研究計畫"], ["30+", "研討會發表"], ["4", "研究主題"]].map(([n, t]) => `      <li class="ls-stat"><strong>${n}</strong><span>${t}</span></li>`).join("\n")}
    </ul>
  </div>
</section>`,
  },
  {
    id: "progress",
    kicker: "PROGRESS",
    name: "進度條",
    en: "Progress Bars",
    group: "數據呈現",
    note: "捲到這裡時長條慢慢填滿；改右邊的百分比，長度就會跟著變。",
    html: () => `<section class="ls-block ls-progress-section" data-ls-anim="fade">
  <div class="ls-wrap">
    <h2 class="ls-title">計畫進度</h2>
    <ul class="ls-progress">
${[["資料收集", "80%"], ["資料分析", "55%"], ["論文撰寫", "30%"]].map(([t, v]) => `      <li><span class="ls-progress-label">${t}</span><span class="ls-progress-value">${v}</span></li>`).join("\n")}
    </ul>
  </div>
</section>`,
  },
  {
    id: "timeline",
    kicker: "MILESTONES",
    name: "時間軸",
    en: "Timeline",
    group: "內容展示",
    note: "垂直時間線，捲到時線條畫下、項目依序出現。適合研究室大事記、學經歷。",
    html: () => `<section class="ls-block ls-timeline-section" data-ls-anim="stagger">
  <div class="ls-wrap">
    <h2 class="ls-title">研究室大事記</h2>
    <ol class="ls-timeline ls-stagger">
${[["2026", "獲國科會計畫補助", "說明這件事的內容。"], ["2025", "研究室成立", "說明這件事的內容。"], ["2024", "第一篇 SSCI 論文刊登", "說明這件事的內容。"]].map(([y, h, p]) => `      <li><time>${y}</time><h3>${h}</h3><p>${p}</p></li>`).join("\n")}
    </ol>
  </div>
</section>`,
  },
  {
    id: "cards",
    kicker: "HIGHLIGHTS",
    name: "浮起卡片",
    en: "Card Grid · Hover Lift",
    group: "內容展示",
    note: "一格一格的卡片，滑鼠移上去會浮起來；捲到時依序出現。",
    html: () => `<section class="ls-block ls-cards-section" data-ls-anim="stagger">
  <div class="ls-wrap">
    <h2 class="ls-title">研究主題</h2>
    <ul class="ls-cards ls-stagger">
${li(3, (i) => `      <li class="ls-card"><h3>研究主題 ${i + 1}</h3><p>用兩三句話說明這個主題在做什麼、為什麼重要。</p></li>`)}
    </ul>
  </div>
</section>`,
  },
  {
    id: "split",
    kicker: "FEATURE",
    name: "圖文分割",
    en: "Split Screen",
    group: "內容展示",
    note: "左邊圖片、右邊文字與按鈕；手機上自動變成上下排列。圖片可以換成相簿或素材庫的圖。",
    image: true,
    html: ({ image = "assets/library/placeholder-photo.svg" } = {}) => `<section class="ls-block ls-split-section" data-ls-anim="rise">
  <div class="ls-wrap ls-split">
    <figure><img src="${image}" alt="" loading="lazy"></figure>
    <div>
      <h2 class="ls-title">標題</h2>
      <p>在這裡寫一段介紹文字，例如研究室的特色、正在招募的研究生，或一項代表性的研究成果。</p>
      <a class="ls-button" href="#"><span>了解更多</span></a>
    </div>
  </div>
</section>`,
  },
  {
    id: "tabs",
    kicker: "TOPICS",
    name: "分頁標籤",
    en: "Tabs",
    group: "互動",
    note: "同一塊空間切換不同內容，點上方的標籤切換。每一頁有自己的標題和內容。",
    html: () => `<section class="ls-block ls-tabs-section" data-ls-anim="fade">
  <div class="ls-wrap">
    <h2 class="ls-title">研究方向</h2>
    <div class="ls-tabs">
${li(3, (i) => `      <div class="ls-tab"><h3 class="ls-tab-title">方向 ${i + 1}</h3><div class="ls-tab-body"><p>這個方向的說明文字。</p></div></div>`)}
    </div>
  </div>
</section>`,
  },
  {
    id: "faq",
    kicker: "FAQ",
    name: "常見問題",
    en: "Accordion",
    group: "互動",
    note: "點問題展開答案，再點收起。適合「想加入研究室？」的常見問題。",
    html: () => `<section class="ls-block ls-faq-section" data-ls-anim="fade">
  <div class="ls-wrap">
    <h2 class="ls-title">想加入研究室？常見問題</h2>
    <div class="ls-faqs">
${[["需要什麼背景？", "說明需要的背景與能力。"], ["怎麼聯絡老師？", "說明聯絡方式與準備的資料。"], ["研究室的工作時間？", "說明研究室的作息與期待。"]].map(([q, a]) => `      <details class="ls-faq"><summary>${q}</summary><p>${a}</p></details>`).join("\n")}
    </div>
  </div>
</section>`,
  },
  {
    id: "marquee",
    kicker: "KEYWORDS",
    name: "跑馬燈",
    en: "Marquee",
    group: "互動",
    note: "一排關鍵字或合作單位不停地橫向移動，滑鼠移上去會停下來。",
    html: () => `<section class="ls-block ls-marquee-section">
  <div class="ls-wrap">
    <h2 class="ls-title">研究關鍵字</h2>
    <div class="ls-marquee">
      <ul class="ls-marquee-track">
${["專科護理師", "臨床推理", "實證護理", "智慧照護", "高齡照護", "護理教育", "數位健康"].map((t) => `        <li>${t}</li>`).join("\n")}
      </ul>
    </div>
  </div>
</section>`,
  },
  {
    id: "quote",
    kicker: "QUOTE",
    name: "引言",
    en: "Quote",
    group: "引導",
    note: "大字置中的一句話，適合研究室理念或畢業生的話。",
    html: () => `<section class="ls-block ls-quote-section" data-ls-anim="zoom">
  <div class="ls-wrap">
    <blockquote class="ls-quote">
      <p>以實證為本，讓照護更好。</p>
      <cite>研究室理念</cite>
    </blockquote>
  </div>
</section>`,
  },
  {
    id: "cta",
    kicker: "JOIN US",
    name: "行動呼籲橫幅",
    en: "Call to Action",
    group: "引導",
    note: "醒目的橫幅加一個按鈕，例如「歡迎有興趣的同學加入」。按鈕的連結可以在左邊改。",
    html: () => `<section class="ls-block ls-cta-section" data-ls-anim="rise">
  <div class="ls-wrap">
    <div class="ls-cta">
      <h2>歡迎加入研究室</h2>
      <p>對我們的研究有興趣嗎？歡迎來信或來研究室聊聊。</p>
      <a class="ls-button" href="#"><span>聯絡我們</span></a>
    </div>
  </div>
</section>`,
  },
];

export const BLOCK_GROUPS = [...new Set(BLOCK_CATALOG.map((b) => b.group))];
export const blockById = (id) => BLOCK_CATALOG.find((b) => b.id === id);
