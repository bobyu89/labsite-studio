// 版面靈感: ready-made requests for the AI assistant, one per kind of section
// research-lab sites usually have. Each names the block it builds and leaves
// ［　］ blanks for the facts only the teacher knows; the assistant turns the
// filled-in request into an 新增一段內容 proposal (cloud/src/ai.js).
// Written for LabSite; free to reuse.

export const PROMPT_GROUPS = ["介紹研究室", "研究與成果", "人與合作", "招募與聯絡"];

export const PROMPT_BANK = [
  {
    id: "themes",
    group: "介紹研究室",
    title: "研究主題卡片",
    block: "cards",
    hint: "三到六個主題並排，每個一句說明。",
    prompt: "用「浮起卡片」幫我加一段研究主題，主題有：［主題一］、［主題二］、［主題三］。每個主題用一兩句話說明在做什麼、為什麼重要，語氣正式、給研究生和合作者看。",
  },
  {
    id: "numbers",
    group: "研究與成果",
    title: "成果數字",
    block: "stats",
    hint: "論文、計畫、成員等幾個關鍵數字。",
    prompt: "用「數字統計」幫我加一段研究室成果數字：期刊論文［數量］篇、執行中計畫［數量］件、研究生［數量］位、合作醫院［數量］家。標題用「研究室成果」。",
  },
  {
    id: "milestones",
    group: "研究與成果",
    title: "研究室大事記",
    block: "timeline",
    hint: "依年份排列的里程碑。",
    prompt: "用「時間軸」幫我加一段研究室大事記：［年份］［事件］；［年份］［事件］；［年份］［事件］。每一項補一句簡短說明，不要加我沒給的事件。",
  },
  {
    id: "projects",
    group: "研究與成果",
    title: "執行中的計畫",
    block: "tabs",
    hint: "每個計畫一個分頁，寫目標與方法。",
    prompt: "用「分頁標籤」幫我介紹執行中的計畫：［計畫名稱、補助單位、期間、想解決的問題］（可以列兩到四個）。每個分頁寫計畫目標與研究方法，各三到四句。",
  },
  {
    id: "progress",
    group: "研究與成果",
    title: "研究進度",
    block: "progress",
    hint: "收案、分析、投稿等階段的完成度。",
    prompt: "用「進度條」幫我加一段［計畫名稱］的研究進度：收案［百分比］、資料分析［百分比］、論文撰寫［百分比］。",
  },
  {
    id: "pi-quote",
    group: "介紹研究室",
    title: "主持人的話",
    block: "quote",
    hint: "一段引言，出自主持人。",
    prompt: "用「引言」幫我寫一段主持人的話，主持人是［姓名、職稱］，想傳達的理念是：［一兩句理念］。用第一人稱，三句以內。",
  },
  {
    id: "partners",
    group: "人與合作",
    title: "合作醫院與夥伴",
    block: "marquee",
    hint: "合作單位名稱輪流跑過。",
    prompt: "用「跑馬燈」列出我們的合作單位：［醫院或學校名稱，用頓號隔開］。標題用「合作夥伴」。",
  },
  {
    id: "outreach",
    group: "人與合作",
    title: "社區服務與衛教",
    block: "cards",
    hint: "研究室做過的服務與推廣活動。",
    prompt: "用「浮起卡片」幫我介紹研究室的社區服務與衛教活動：［活動名稱與內容］。每張卡片寫活動做了什麼、服務對象是誰。",
  },
  {
    id: "teaching",
    group: "人與合作",
    title: "課程與教學",
    block: "tabs",
    hint: "主持人開的課，每門課一個分頁。",
    prompt: "用「分頁標籤」幫我介紹主持人開的課：［課程名稱、開課系所、學期］。每門課寫兩三句課程重點與適合的學生。",
  },
  {
    id: "join-faq",
    group: "招募與聯絡",
    title: "想加入研究室：常見問題",
    block: "faq",
    hint: "研究生最常問的問題與回答。",
    prompt: "用「常見問題」幫我寫研究生想加入研究室時常問的問題，根據這些資訊回答：［招收的學制、名額、研究助理機會、怎麼聯絡、需要準備什麼］。不知道的就不要寫。",
  },
  {
    id: "join-cta",
    group: "招募與聯絡",
    title: "招募研究生／研究助理",
    block: "cta",
    hint: "一句號召加一個聯絡按鈕。",
    prompt: "用「行動呼籲橫幅」幫我寫招募訊息：我們正在招收［碩士生／博士生／研究助理］，研究方向是［方向］，有興趣請［聯絡方式］。標題要簡短有力，內文兩句以內。",
  },
  {
    id: "collab-cta",
    group: "招募與聯絡",
    title: "歡迎合作",
    block: "cta",
    hint: "邀請臨床單位或其他研究團隊合作。",
    prompt: "用「行動呼籲橫幅」寫一段歡迎合作的訊息，對象是［臨床單位、學校或企業］，可以合作的方向是［方向］，聯絡方式是［Email 或電話］。",
  },
];

// The blanks still left in a filled-in request.
export const blanksIn = (text) => (String(text || "").match(/［[^］]*］/g) || []).length;
