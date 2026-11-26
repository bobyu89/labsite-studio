// LabSite 設計規範 (docs/DESIGN-STANDARD.md): what a good lab website is,
// written so that both the AI and the checks can use it. Three layers —
// these rules (shared by every site), the style pack (stylePacks.js: colours,
// fonts, skin) and the lab profile (labProfile.js: who the lab is, its voice).
// The server puts the relevant domains into every AI request (designBrief);
// the editor's checks report problems by anti-pattern id (publishCheck.js).
// Written for LabSite; free to reuse.

export const DESIGN_VERSION = "0.1";

// Two kinds of page, with different rules.
export const REGISTERS = {
  showcase: {
    name: "門面頁",
    pages: "首頁、研究主題、加入我們",
    rule: "訪客要在 10 秒內知道研究室研究什麼。可以有一個主角、一句有力的標題；AI 可以重寫、重排。",
  },
  record: {
    name: "資料頁",
    pages: "論文、成員、消息列表、課程、聯絡",
    rule: "訪客要很快查到一篇論文、一個人、一個日期。一致、可預測最重要；AI 只修格式，不改內容。",
  },
};

// Which register a page path belongs to.
export function registerOf(path) {
  const name = String(path || "").replace(/^en\//, "").replace(/\.html?$/i, "");
  return /^(index|research|join|about)?$/i.test(name) ? "showcase" : "record";
}

// The eight domains. Each rule: [id, text]. Numbers are defaults a pack or a
// lab may tune, except where marked 不能覆蓋 (accessibility and ethics).
export const DOMAINS = {
  type: {
    title: "字體排印",
    en: "Typography",
    principle: "中文和英文要像同一個人寫的。字級少而分明，閱讀舒服比漂亮重要。",
    rules: [
      ["T-01", "字級只用 5 級，比例 1.25（14 / 17 / 20 / 25 / 31，首頁大標可到 39）。"],
      ["T-02", "中文內文行高 1.75–1.9，英文 1.5–1.65；中文一行 28–40 字，英文 60–75 字元。"],
      ["T-03", "最多兩個字體家族（一個中文、一個拉丁），第三種只能是等寬字給數字用。"],
      ["T-04", "中文不用斜體、不加字距、不用全大寫英文長句；強調用粗體，底線留給連結。"],
      ["T-05", "中英文之間、數字和單位之間留半形空格（86 位長輩）；中文用全形標點，不混用「,」「，」。"],
      ["T-06", "標題用 700 粗，不用 900；標題不要只剩一個字在最後一行。"],
      ["T-07", "數字要對齊的地方（統計、年份、表格）用等寬數字。"],
    ],
  },
  color: {
    title: "色彩與對比",
    en: "Color & Contrast",
    principle: "顏色是路標，不是裝飾。每個顏色都要有固定的意思。",
    rules: [
      ["C-01", "60-30-10：60% 中性底色、30% 文字和線條、10% 主色；一頁最多 1 個主色加 1 個強調色。"],
      ["C-02", "文字對比至少 4.5:1，18px 以上粗體至少 3:1。（不能覆蓋）"],
      ["C-03", "彩色色塊上的字只用白色或該色的深色調，不用灰色。"],
      ["C-04", "中性色帶一點主色的色相，不用純黑 #000 和純灰 #808080。"],
      ["C-05", "顏色不能是唯一的資訊：狀態另外要有文字或圖示。"],
      ["C-06", "漸層最多一處，且只在同一色相內；不用紫到藍、彩虹、霓虹漸層。"],
      ["C-07", "照片上壓字要加至少 45% 深色遮罩，或把字放在照片外。"],
    ],
  },
  space: {
    title: "空間與版面",
    en: "Spatial Design",
    principle: "每一頁只有一個主角。靠得近的是一組，離得遠的是不同的事。",
    rules: [
      ["S-01", "間距只用 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96；區塊之間至少是區塊內距的 2 倍。"],
      ["S-02", "手機打開首頁，第一個畫面要看得到研究室名稱、一句研究重點、一個主要行動。"],
      ["S-03", "卡片只給可以點進去的獨立單位；不要卡片包卡片，不要每段文字都裝框。"],
      ["S-04", "內文靠左；置中只留給首頁主標和短的行動區塊，一頁最多兩處。"],
      ["S-05", "同類項目大小一致：成員照片同比例同尺寸、論文同格式；不要留孤單的一格。"],
      ["S-06", "內文欄寬上限約 720px，整頁最寬 1200px。"],
    ],
  },
  motion: {
    title: "動態",
    en: "Motion",
    principle: "動畫只做三件事：回應操作、表示狀態改變、說明東西從哪裡來。",
    rules: [
      ["M-01", "150–400ms、ease-out；不用彈跳，不超過 500ms。"],
      ["M-02", "訪客設定「減少動態」時全部關掉。（不能覆蓋）"],
      ["M-03", "首頁最多一段進場動畫；內容在動畫前就看得到，不等捲到才出現。"],
      ["M-04", "不自動輪播、不跑馬燈、不改捲動速度。"],
      ["M-05", "只動 transform 和 opacity，不動寬高和位置。"],
    ],
  },
  interact: {
    title: "互動",
    en: "Interaction",
    principle: "能點的東西看起來就能點，點了會發生什麼要事先知道。",
    rules: [
      ["I-01", "連結文字說明目的地（「看 2026 年的 5 篇論文」），不用「點這裡」「更多」。"],
      ["I-02", "外部連結加標示；PDF 寫明格式和大小（招生簡章（PDF，1.2 MB））。"],
      ["I-03", "每個可點的東西都有清楚的鍵盤焦點框；手機點擊範圍至少 44×44px。（不能覆蓋）"],
      ["I-04", "Email 用文字顯示、可以複製，不只放成圖片或 mailto。"],
      ["I-05", "表單寫清楚欄位用途；錯誤訊息說哪裡錯、怎麼改。"],
    ],
  },
  adapt: {
    title: "手機與響應式",
    en: "Responsive",
    principle: "大部分訪客用手機看。先讓 360px 寬的手機好用。",
    rules: [
      ["R-01", "360px 寬不能左右捲動；只有大表格可以在自己的框裡橫捲。"],
      ["R-02", "主選單最多 6 項，超過的收進「更多」，不縮字硬塞。"],
      ["R-03", "手機上多欄改單欄；成員照片 2 欄；論文表格改成一筆一段。"],
      ["R-04", "手機內文不小於 16px。"],
      ["R-05", "首頁主視覺壓到 300 KB 以內，不放原始相機檔。"],
    ],
  },
  write: {
    title: "文字寫作",
    en: "Writing",
    principle: "寫給一位聰明但不是你這個領域的人看。具體勝過漂亮。",
    rules: [
      ["W-01", "首頁一句話：我們研究［誰］的［什麼問題］，用［什麼方法］，讓［什麼改變］。"],
      ["W-02", "研究主題寫成問題或目標（「讓住院長輩不跌倒」），不寫成類別名（「老人護理」）。"],
      ["W-03", "不用空詞：致力於、全方位、打造、卓越、一流、頂尖、領航、賦能、國際化；cutting-edge、world-class、innovative、empower、leverage。改寫成具體事實。"],
      ["W-04", "有數字就寫數字，而且要查得到來源；沒有就不寫，不編。"],
      ["W-05", "英文版是改寫不是逐字翻譯：plain English、主動語態，不寫「Our lab is devoted to…」。"],
      ["W-06", "全站格式統一：日期 2026.11.26、職稱（教授／副教授／博士生）、英文姓名 Given-name Family-name。"],
      ["W-07", "按鈕用動詞開頭，寫出會發生什麼（寄信給老師、下載招生簡章）。"],
    ],
  },
  scholar: {
    title: "學術內容與倫理",
    en: "Scholarly content & ethics",
    principle: "研究室網站也是學術紀錄：正確、可查證、保護研究參與者。",
    rules: [
      ["A-01", "論文用 APA 7、懸掛縮排、附 DOI；研究室成員名字粗體，通訊作者加 *。"],
      ["A-02", "同一篇論文只出現一次；中英文頁的論文數量一致。"],
      ["A-03", "老師放 ORCID；研究計畫寫經費來源和編號。"],
      ["A-04", "病人、兒童、家屬的照片要有書面同意，否則用不露臉的畫面；參與者引言去識別化，不寫年齡、病房、地區。（不能覆蓋）"],
      ["A-05", "不誇大：觀察性研究不寫「證實有效」；寫到 AI 時一併說明限制與人員把關。（不能覆蓋）"],
      ["A-06", "人用研究可以寫 IRB 核准編號。"],
      ["A-07", "消息至少每 3 個月一則；成員每學期更新，畢業的移到校友並寫去向。"],
    ],
  },
};

// 34 things that should not be on a lab site. detect: auto (the editor finds
// it from the files, publishCheck.js), ai (needs reading), and where it was
// already caught before this standard, `kind` names the older check.
export const ANTI_PATTERNS = [
  // A｜AI 味
  { id: "AP-01", group: "ai", detect: "auto", rule: "C-06", title: "紫到藍、彩虹或霓虹漸層背景", fix: "改成單一主色的實色色帶。" },
  { id: "AP-02", group: "ai", detect: "auto", rule: "S-03", title: "每一區都是一排一樣的圓角陰影卡片", fix: "用標題和留白分組，只有點得進去的才做成卡片。" },
  { id: "AP-03", group: "ai", detect: "auto", rule: "S-03", title: "卡片裡再包卡片", fix: "拿掉內層的框和陰影。" },
  { id: "AP-04", group: "ai", detect: "auto", rule: "T-03", title: "標題或清單前面放 emoji", fix: "拿掉 emoji，或改成版型內建的線條圖示。" },
  { id: "AP-05", group: "ai", detect: "auto", rule: "S-04", title: "大部分區塊都置中", fix: "內文靠左，置中一頁最多兩處。" },
  { id: "AP-06", group: "ai", detect: "auto", rule: "C-03", title: "彩色色塊上放灰字", fix: "色塊上用白字或深色調。" },
  { id: "AP-07", group: "ai", detect: "auto", rule: "M-01", title: "彈跳動畫、太慢的動畫、捲到才出現的內容", fix: "150–400ms ease-out，內容先看得到。" },
  { id: "AP-08", group: "ai", detect: "auto", rule: "W-03", title: "空詞堆疊（致力於、全方位、卓越、cutting-edge…）", fix: "改寫成具體事實：對象、方法、數字。" },
  { id: "AP-09", group: "ai", detect: "ai", rule: "A-04", title: "圖庫感照片（握手、聽診器特寫、發光大腦、地球）", fix: "換成研究室真實的照片。" },
  { id: "AP-10", group: "ai", detect: "ai", rule: "S-02", title: "每樣東西一樣大、一樣顯眼，沒有主角", fix: "選一個主角，其他退後。" },
  // B｜老派學術網站味
  { id: "AP-11", group: "old", detect: "auto", rule: "M-04", title: "自動輪播、跑馬燈", fix: "改成一張主視覺；多張照片讓訪客自己按。" },
  { id: "AP-12", group: "old", detect: "auto", rule: "W-04", title: "訪客計數器、「最佳解析度」、「網站建置中」", fix: "拿掉；造訪人數看平台的「網站造訪」。" },
  { id: "AP-13", group: "old", detect: "auto", rule: "A-07", title: "半年以上沒有新消息", fix: "補一則活動、口試或獲獎。", kind: "health:news-old" },
  { id: "AP-14", group: "old", detect: "auto", rule: "I-02", title: "主要內容是 PDF 或文字截圖", fix: "重要內容改成網頁文字，PDF 當附件並標明大小。" },
  { id: "AP-15", group: "old", detect: "auto", rule: "T-03", title: "三種以上字體混用", fix: "回到風格包的兩個字體。" },
  { id: "AP-16", group: "old", detect: "auto", rule: "I-01", title: "連結寫「點這裡」「more」", fix: "寫出要去哪裡。" },
  { id: "AP-17", group: "old", detect: "ai", rule: "W-05", title: "英文頁是逐字翻譯", fix: "用 plain English 改寫。", kind: "health:english" },
  { id: "AP-18", group: "old", detect: "ai", rule: "W-02", title: "研究主題只寫類別名稱", fix: "寫成問題或目標。" },
  // C｜看不清楚、用不了
  { id: "AP-19", group: "use", detect: "auto", rule: "C-02", title: "文字對比不足 4.5:1", fix: "加深文字或換底色。" },
  { id: "AP-20", group: "use", detect: "auto", rule: "I-03", title: "照片沒有替代文字", fix: "用一句話描述照片。", kind: "alt" },
  { id: "AP-21", group: "use", detect: "auto", rule: "T-01", title: "標題跳級或一頁多個主標題", fix: "標題依層級排列，一頁一個 h1。", kind: "a11y" },
  { id: "AP-22", group: "use", detect: "auto", rule: "R-01", title: "手機上左右捲動、沒有手機設定", fix: "拿掉固定寬度。", kind: "mobile" },
  { id: "AP-23", group: "use", detect: "auto", rule: "I-01", title: "壞掉的連結、空連結", fix: "改正網址或刪掉。", kind: "broken" },
  { id: "AP-24", group: "use", detect: "auto", rule: "T-01", title: "一頁出現 6 種以上的字級", fix: "回到 5 級字級。" },
  { id: "AP-25", group: "use", detect: "auto", rule: "R-05", title: "照片檔案太大", fix: "縮到 300 KB 左右（換照片時平台會自動縮）。" },
  // D｜內容與學術
  { id: "AP-26", group: "content", detect: "auto", rule: "W-04", title: "範本的範例文字和照片還沒換掉", fix: "換成研究室自己的資料。", kind: "sample" },
  { id: "AP-27", group: "content", detect: "auto", rule: "A-02", title: "同一篇論文出現兩次、中英文論文數量不同", fix: "到「論文與成員總表」整理。", kind: "health:papers-duplicate" },
  { id: "AP-28", group: "content", detect: "auto", rule: "A-01", title: "論文沒有 DOI", fix: "補上 DOI 連結。", kind: "health:papers-doi" },
  { id: "AP-29", group: "content", detect: "auto", rule: "S-05", title: "成員照片比例不一、職稱寫法不一", fix: "照片裁成同比例；職稱用同一套寫法。" },
  { id: "AP-30", group: "content", detect: "ai", rule: "W-01", title: "首頁看完還是不知道研究什麼", fix: "照「我們研究誰的什麼問題」重寫首頁那一句。" },
  { id: "AP-31", group: "content", detect: "ai", rule: "A-05", title: "成效寫得太滿", fix: "依研究設計用詞，寫出限制。" },
  { id: "AP-32", group: "content", detect: "ai", rule: "A-04", title: "可辨識的病人或兒童照片、引言含可辨識資訊", fix: "換成不露臉的照片，引言去識別化。" },
  { id: "AP-33", group: "content", detect: "ai", rule: "W-01", title: "語氣前後不一", fix: "照研究室檔案的語氣統一。" },
  { id: "AP-34", group: "content", detect: "ai", rule: "A-04", title: "照片和旁邊的文字無關", fix: "換照片，或改照片說明。" },
];
export const AP_GROUPS = { ai: "AI 味", old: "老派學術網站味", use: "看不清楚、用不了", content: "內容與學術" };
export const antiPattern = (id) => ANTI_PATTERNS.find((x) => x.id === id) || null;

// The 12 commands: the vocabulary teachers and the AI share. `domains` are
// the rule sets the AI reads for it; `changes` the kinds of proposal it may
// make (assistant change types); `scope` what it looks at.
export const COMMANDS = [
  { id: "audit", name: "體檢", does: "看整個網站，依規範列出最該先處理的事。", dont: "不改任何東西。", domains: [], changes: [], local: true },
  {
    id: "critique",
    name: "評一評",
    does: "用訪客的眼光看這一頁：第一印象、10 秒內看不看得懂、可不可信、下一步要去哪。",
    dont: "只給意見，不改。",
    domains: ["space", "write", "scholar"],
    changes: [],
    ask: "用訪客的眼光評這一頁：第一印象、10 秒內看不看得懂研究室在做什麼、哪裡讓人覺得可信或不可信、看完下一步會想去哪。最後列出最值得先改的三件事，各標規則編號。",
  },
  {
    id: "polish",
    name: "潤飾",
    does: "發布前最後一遍：中英文間距、全形標點、日期和職稱格式、錯字。",
    dont: "不改句子的意思。",
    domains: ["type", "write"],
    changes: ["set_text"],
    ask: "幫這一頁做發布前的潤飾：中英文和數字之間的空格、全形標點、日期格式（2026.11.26）、職稱寫法一致、明顯的錯字。每處一個修改，不改句子的意思；沒有要改的就說沒有。",
  },
  {
    id: "distill",
    name: "精簡",
    does: "刪掉重複的話和空詞，每段只留一個重點，大約短三分之一。",
    dont: "不刪數字、人名、論文。",
    domains: ["write"],
    changes: ["set_text"],
    ask: "把我選的區塊（沒選就是這一頁的主要段落）精簡：刪掉重複的話和空詞，每段只留一個重點，長度大約減少三分之一。數字、人名、論文、日期都要保留。",
  },
  {
    id: "clarify",
    name: "說清楚",
    does: "改寫看不懂的句子、按鈕和連結文字；專有名詞第一次出現時加一句白話。",
    dont: "不改研究內容。",
    domains: ["write", "interact"],
    changes: ["set_text"],
    ask: "把這一頁看不懂或含糊的地方改清楚：太長或太專業的句子、寫「點這裡」「更多」的連結、看不出會發生什麼的按鈕。專有名詞第一次出現時加一句白話。不改研究內容。",
  },
  {
    id: "quieter",
    name: "更沉穩",
    does: "降低顏色和粗體的數量、減少動畫，文字語氣收斂。",
    dont: "不換風格包。",
    domains: ["color", "motion", "write"],
    changes: ["set_text", "set_theme"],
    ask: "讓這個網站更沉穩：如果顏色太多太鮮豔就建議收斂（set_theme），動態改成 subtle 或 none，誇張或口號式的句子改得平實。",
  },
  {
    id: "bolder",
    name: "更醒目",
    does: "讓主角更明顯：首頁標題更有力、主要行動放到第一個畫面、建議一張更好的主視覺。",
    dont: "不加漸層和特效。",
    domains: ["space", "write", "color"],
    changes: ["set_text", "set_theme"],
    ask: "讓這一頁的主角更醒目：首頁大標題改得更具體有力（照「我們研究誰的什麼問題」），主要行動的按鈕文字寫清楚；如果主色太淡可以建議加深（set_theme）。說明哪張照片適合當主視覺。不加漸層和特效。",
  },
  {
    id: "typeset",
    name: "排字",
    does: "修中英混排：空格、全形標點、太長的標題、只剩一個字的斷行。",
    dont: "不換字體。",
    domains: ["type"],
    changes: ["set_text"],
    ask: "檢查這一頁的排字：中英文和數字之間的空格、全形標點、太長的標題（中文超過 20 字建議縮短）、會只剩一個字在最後一行的短標題。每處一個修改。",
  },
  {
    id: "layout",
    name: "整理版面",
    does: "找出版面問題（沒有主角、太多卡片、置中太多、照片比例不一），告訴你在哪裡改。",
    dont: "不刪內容；版面要你按指示自己調。",
    domains: ["space"],
    changes: ["set_text"],
    ask: "依版面規則看這一頁：有沒有一個主角、卡片是不是太多、置中是不是太多、成員照片比例是否一致、段落是不是太長。說明每個問題在哪個區塊、用編輯器的哪個功能調整；太長的段落可以直接提出拆短的修改。",
  },
  {
    id: "adapt",
    name: "手機版",
    does: "檢查這一頁在手機上的問題，太長的標題和選單文字改短。",
    dont: "不改電腦版的版面。",
    domains: ["adapt"],
    changes: ["set_text"],
    ask: "從手機（360px 寬）的角度看這一頁：太長、在手機上會斷成很多行的標題和按鈕文字請改短；其他手機問題（左右捲動、固定寬度、選單太多）說明在哪裡、怎麼處理。",
  },
  {
    id: "harden",
    name: "補強",
    does: "處理邊緣情況：很長的英文姓名、沒有照片的成員、空的區塊、還沒填的連結。",
    dont: "不新增頁面。",
    domains: ["space", "interact", "scholar"],
    changes: ["set_text"],
    ask: "找出這一頁的邊緣情況：空的段落或清單、還沒有照片的成員、還沒填網址的連結、很長的英文姓名或論文標題、範例文字。能用文字處理的提出修改，其他說明怎麼處理。",
  },
  {
    id: "delight",
    name: "加點溫度",
    does: "一句給新生的歡迎、活動照片的說明、校友的去向，讓網站有人味。",
    dont: "不加動畫和裝飾；不編造事實。",
    domains: ["write", "scholar"],
    changes: ["set_text", "add_section"],
    ask: "讓這一頁多一點人味：例如給想加入的學生一句歡迎、活動照片有說明、校友現在在哪裡。只用網站上已有的事實；缺的資料先問我，不要自己編。",
  },
];
export const commandById = (id) => COMMANDS.find((c) => c.id === id) || null;

// The text the AI reads: chosen domains (all when none given), the register
// of the page, the anti-pattern titles and the lab profile, in Chinese.
export function designBrief({ domains, register, lab, antiPatterns = true } = {}) {
  const keys = domains && domains.length ? domains.filter((d) => DOMAINS[d]) : Object.keys(DOMAINS);
  const lines = [`LabSite 設計規範 v${DESIGN_VERSION}（rule ids in brackets; cite them when you explain a problem）`];
  if (register && REGISTERS[register]) lines.push(`這一頁是「${REGISTERS[register].name}」：${REGISTERS[register].rule}`);
  for (const k of keys) {
    const d = DOMAINS[k];
    lines.push(`\n## ${d.title}（${d.en}）— ${d.principle}`);
    for (const [id, text] of d.rules) lines.push(`[${id}] ${text}`);
  }
  if (antiPatterns) lines.push("\n## 不該出現\n" + ANTI_PATTERNS.map((a) => `[${a.id}] ${a.title}`).join("；"));
  if (lab) lines.push("\n" + lab);
  return lines.join("\n");
}

// The empty words of W-03 / AP-08, as a pattern for the checks.
export const EMPTY_WORDS = /致力於|全方位|打造|卓越|一流|頂尖|領航|賦能|國際化|cutting[- ]edge|world[- ]class|state[- ]of[- ]the[- ]art|empower(?:s|ing)?\b|leverag(?:e|es|ing)\b/gi;
