// The animation half of the blocks runtime (動畫庫): entrance animations for
// any section (data-ls-anim) and the behaviour of the animated components.
// Appended to js/labsite-blocks.js and css/labsite-blocks.css by albums.js.
// Plain ES5 + CSS so it runs on any site; everything respects
// prefers-reduced-motion and shows the content without JavaScript.

export const ANIM_CSS_TEXT = `
/* ---- 動畫庫：區塊進場（data-ls-anim）---- */
@media (prefers-reduced-motion: no-preference) {
  .ls-anim-on [data-ls-anim]:not(.ls-in) {
    opacity: 0;
  }
  .ls-anim-on [data-ls-anim="rise"]:not(.ls-in) {
    transform: translateY(28px);
  }
  .ls-anim-on [data-ls-anim="zoom"]:not(.ls-in) {
    transform: scale(0.94);
  }
  .ls-anim-on [data-ls-anim="left"]:not(.ls-in) {
    transform: translateX(-40px);
  }
  .ls-anim-on [data-ls-anim="right"]:not(.ls-in) {
    transform: translateX(40px);
  }
  .ls-anim-on [data-ls-anim] {
    transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .ls-anim-on [data-ls-anim="stagger"]:not(.ls-in) {
    opacity: 1;
  }
  .ls-anim-on [data-ls-anim="stagger"] .ls-stagger > * {
    transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .ls-anim-on [data-ls-anim="stagger"]:not(.ls-in) .ls-stagger > * {
    opacity: 0;
    transform: translateY(20px);
  }
}

/* ---- 數字統計 ---- */
.ls-stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}
.ls-stat {
  padding: 20px 16px;
  border-radius: 12px;
  background: rgba(127, 127, 127, 0.07);
  text-align: center;
  min-width: 0;
}
.ls-stat strong {
  display: block;
  font-size: 2.4em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.ls-stat span {
  display: block;
  margin-top: 6px;
  opacity: 0.8;
}

/* ---- 時間軸 ---- */
.ls-timeline {
  list-style: none;
  margin: 0;
  padding: 0 0 0 28px;
  position: relative;
}
.ls-timeline::before {
  content: "";
  position: absolute;
  left: 7px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: currentColor;
  opacity: 0.2;
  transform-origin: top;
}
.ls-timeline li {
  position: relative;
  padding: 0 0 22px;
}
.ls-timeline li::before {
  content: "";
  position: absolute;
  left: -27px;
  top: 6px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid currentColor;
  background: #fff;
  box-sizing: border-box;
}
.ls-timeline time {
  display: block;
  font-weight: 700;
  opacity: 0.75;
}
.ls-timeline h3 {
  margin: 4px 0;
}
.ls-timeline p {
  margin: 0;
  line-height: 1.75;
}
@media (prefers-reduced-motion: no-preference) {
  .ls-anim-on .ls-timeline-section:not(.ls-in) .ls-timeline::before {
    transform: scaleY(0);
  }
  .ls-anim-on .ls-timeline::before {
    transition: transform 1.2s ease;
  }
}

/* ---- 分頁標籤 ---- */
.ls-tab-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  border-bottom: 2px solid rgba(127, 127, 127, 0.2);
}
.ls-tab-buttons button {
  border: 0;
  background: none;
  padding: 10px 14px;
  font: inherit;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  opacity: 0.7;
}
.ls-tab-buttons button[aria-selected="true"] {
  border-bottom-color: currentColor;
  opacity: 1;
  font-weight: 700;
}
.ls-tab-buttons button:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 2px;
}
.ls-tabs-ready .ls-tab-title {
  display: none;
}
.ls-tabs-ready .ls-tab[hidden] {
  display: none;
}
.ls-tab-body {
  line-height: 1.85;
}
@media (prefers-reduced-motion: no-preference) {
  .ls-tabs-ready .ls-tab:not([hidden]) {
    animation: ls-fade-in 0.35s ease;
  }
}
@keyframes ls-fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

/* ---- 常見問題（折疊）---- */
.ls-faq {
  border-bottom: 1px solid rgba(127, 127, 127, 0.25);
}
.ls-faq summary {
  cursor: pointer;
  padding: 16px 32px 16px 0;
  font-weight: 700;
  list-style: none;
  position: relative;
}
.ls-faq summary::-webkit-details-marker {
  display: none;
}
.ls-faq summary::after {
  content: "+";
  position: absolute;
  right: 4px;
  top: 12px;
  font-size: 1.4em;
  line-height: 1;
  transition: transform 0.25s ease;
}
.ls-faq[open] summary::after {
  transform: rotate(45deg);
}
.ls-faq p {
  margin: 0 0 16px;
  line-height: 1.85;
}
@media (prefers-reduced-motion: no-preference) {
  .ls-faq[open] p {
    animation: ls-fade-in 0.3s ease;
  }
}

/* ---- 跑馬燈 ---- */
.ls-marquee {
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
}
.ls-marquee-track {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 14px;
  width: max-content;
}
.ls-marquee-track li {
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid rgba(127, 127, 127, 0.3);
  white-space: nowrap;
}
@media (prefers-reduced-motion: no-preference) {
  .ls-marquee-on .ls-marquee-track {
    animation: ls-marquee var(--ls-marquee-time, 30s) linear infinite;
  }
  .ls-marquee:hover .ls-marquee-track,
  .ls-marquee:focus-within .ls-marquee-track {
    animation-play-state: paused;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ls-marquee-track {
    flex-wrap: wrap;
    width: auto;
  }
}
@keyframes ls-marquee {
  to {
    transform: translateX(-50%);
  }
}

/* ---- 進度條 ---- */
.ls-progress {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 16px;
}
.ls-progress li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 12px;
}
.ls-progress li::after {
  content: "";
  grid-column: 1 / -1;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(currentColor, currentColor) 0 0 / var(--ls-value, 0%) 100% no-repeat, rgba(127, 127, 127, 0.18);
}
@media (prefers-reduced-motion: no-preference) {
  .ls-progress li::after {
    transition: background-size 1.2s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
}

/* ---- 浮起卡片 ---- */
.ls-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
  gap: 18px;
}
.ls-card {
  padding: 22px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.07);
  min-width: 0;
}
.ls-card img {
  width: 48px;
  height: 48px;
  display: block;
  margin-bottom: 10px;
}
.ls-card h3 {
  margin: 0 0 8px;
}
.ls-card p {
  margin: 0;
  line-height: 1.75;
}
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .ls-card {
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .ls-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.12);
  }
}

/* ---- 圖文分割 ---- */
.ls-split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: clamp(20px, 4vw, 48px);
  align-items: center;
}
.ls-split figure {
  margin: 0;
}
.ls-split img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 14px;
}
.ls-split p {
  line-height: 1.85;
}
.ls-button {
  display: inline-block;
  margin-top: 8px;
  padding: 12px 22px;
  border-radius: 999px;
  background: currentColor;
  text-decoration: none;
  font-weight: 700;
}
.ls-button span {
  color: #fff;
}

/* ---- 引言 ---- */
.ls-quote {
  margin: 0 auto;
  max-width: 760px;
  text-align: center;
  font-size: 1.2em;
  line-height: 1.8;
}
.ls-quote p::before {
  content: "“";
  display: block;
  font-size: 3em;
  line-height: 0.6;
  opacity: 0.25;
}
.ls-quote cite {
  display: block;
  margin-top: 12px;
  font-size: 0.85em;
  font-style: normal;
  opacity: 0.75;
}

/* ---- 行動呼籲橫幅 ---- */
.ls-cta {
  padding: clamp(28px, 5vw, 48px);
  border-radius: 18px;
  background: rgba(127, 127, 127, 0.08);
  text-align: center;
}
.ls-cta h2 {
  margin: 0 0 8px;
}
.ls-cta p {
  margin: 0 0 12px;
  line-height: 1.8;
}
`;

// Runs inside every page that uses blocks (serialized into the runtime file).
export const ANIM_JS_TEXT = `
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  /* 數字從 0 跳到寫好的數字（保留前後文字，例如 30+、2,400） */
  function countUp(el) {
    var text = el.textContent;
    var m = text.match(/^(\\D*)([\\d,]+(?:\\.\\d+)?)(.*)$/);
    if (!m || reduce) return;
    var target = parseFloat(m[2].replace(/,/g, ""));
    var decimals = (m[2].split(".")[1] || "").length;
    var comma = m[2].indexOf(",") >= 0;
    var start = null;
    function fmt(v) {
      var s = v.toFixed(decimals);
      return comma ? s.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",") : s;
    }
    function step(t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / 1400);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = m[1] + fmt(target * eased) + m[3];
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = text;
    }
    requestAnimationFrame(step);
  }

  /* 進度條：讀「75%」這類文字，畫出長度 */
  function fillProgress(section) {
    var items = section.querySelectorAll(".ls-progress li");
    for (var i = 0; i < items.length; i++) {
      var v = items[i].querySelector(".ls-progress-value");
      var n = v ? parseFloat(v.textContent) : 0;
      items[i].style.setProperty("--ls-value", Math.max(0, Math.min(100, isNaN(n) ? 0 : n)) + "%");
    }
  }

  function arrive(el) {
    el.classList.add("ls-in");
    var counts = el.querySelectorAll(".ls-stat strong");
    for (var i = 0; i < counts.length; i++) countUp(counts[i]);
    if (el.querySelector(".ls-progress")) fillProgress(el);
  }

  /* 依序出現：每個子項目延遲一點 */
  function stagger(el) {
    var lists = el.querySelectorAll(".ls-stagger");
    for (var i = 0; i < lists.length; i++)
      for (var j = 0; j < lists[i].children.length; j++) lists[i].children[j].style.transitionDelay = j * 0.08 + "s";
  }

  function startAnimations() {
    var els = document.querySelectorAll("[data-ls-anim], .ls-stats-section, .ls-progress-section, .ls-timeline-section");
    if (!els.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      for (var i = 0; i < els.length; i++) arrive(els[i]);
      return;
    }
    root.classList.add("ls-anim-on");
    // threshold 0 + bottom margin: tall blocks still appear on phones.
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            arrive(e.target);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }
    );
    for (var k = 0; k < els.length; k++) {
      if (els[k].getAttribute("data-ls-anim") === "stagger") stagger(els[k]);
      io.observe(els[k]);
    }
  }

  /* 分頁標籤：由每個 .ls-tab-title 產生按鈕 */
  function startTabs() {
    var groups = document.querySelectorAll(".ls-tabs");
    for (var g = 0; g < groups.length; g++)
      (function (box, n) {
        var tabs = box.querySelectorAll(".ls-tab");
        if (!tabs.length || box.querySelector(".ls-tab-buttons")) return;
        var bar = document.createElement("div");
        bar.className = "ls-tab-buttons";
        bar.setAttribute("role", "tablist");
        var buttons = [];
        function select(i, focus) {
          for (var t = 0; t < tabs.length; t++) {
            tabs[t].hidden = t !== i;
            buttons[t].setAttribute("aria-selected", t === i ? "true" : "false");
            buttons[t].tabIndex = t === i ? 0 : -1;
          }
          if (focus) buttons[i].focus();
        }
        for (var t = 0; t < tabs.length; t++)
          (function (i) {
            var title = tabs[i].querySelector(".ls-tab-title");
            var b = document.createElement("button");
            b.type = "button";
            b.setAttribute("role", "tab");
            b.id = "ls-tab-" + n + "-" + i;
            b.textContent = title ? title.textContent : "分頁 " + (i + 1);
            tabs[i].setAttribute("role", "tabpanel");
            tabs[i].setAttribute("aria-labelledby", b.id);
            b.addEventListener("click", function () { select(i, false); });
            b.addEventListener("keydown", function (e) {
              if (e.key === "ArrowRight") select((i + 1) % tabs.length, true);
              if (e.key === "ArrowLeft") select((i - 1 + tabs.length) % tabs.length, true);
            });
            buttons.push(b);
            bar.appendChild(b);
          })(t);
        box.insertBefore(bar, box.firstChild);
        box.classList.add("ls-tabs-ready");
        select(0, false);
      })(groups[g], g);
  }

  /* 跑馬燈：複製一份內容，接得起來地循環 */
  function startMarquees() {
    if (reduce) return;
    var boxes = document.querySelectorAll(".ls-marquee");
    for (var i = 0; i < boxes.length; i++) {
      var track = boxes[i].querySelector(".ls-marquee-track");
      if (!track || track.getAttribute("data-ls-cloned")) continue;
      var items = track.children.length;
      for (var j = 0; j < items; j++) {
        var copy = track.children[j].cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        track.appendChild(copy);
      }
      track.setAttribute("data-ls-cloned", "1");
      track.style.setProperty("--ls-marquee-time", Math.max(16, items * 4) + "s");
      boxes[i].classList.add("ls-marquee-on");
    }
  }

  function start() {
    startTabs();
    startMarquees();
    startAnimations();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
`;
