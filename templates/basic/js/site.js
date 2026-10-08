// Draws the header and footer from js/data.js, so the lab name, address and
// navigation are edited once for every page. Pages say which they are with
// <body data-page="…">; the language comes from <html lang>.
(function () {
  var site = typeof SITE !== "undefined" ? SITE : {};
  var nav = typeof NAV !== "undefined" ? NAV : [];
  var root = document.documentElement;
  var en = /^en/i.test(root.lang || "");
  var page = document.body.getAttribute("data-page") || "index";
  // html[data-motion] (the site's motion style from theme.css --motion) is set
  // by a small script in each page's <head>; it is absent inside the LabSite
  // editor (unless 播放動畫 is pressed), with "none", or with reduced motion.

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  var pick = function (zh, other) {
    return en ? other || zh : zh;
  };
  var second = function (zh, other) {
    return en ? zh : other;
  };

  var header = document.querySelector("[data-site-header]");
  if (header) {
    var plates = nav
      .map(function (item) {
        var current = item.page === page ? ' aria-current="page"' : "";
        var zone = item.zone ? ' data-zone="' + esc(item.zone) + '"' : "";
        return (
          '<a class="zone-plate" href="' + esc(item.page) + '.html"' + zone + current + ">" +
          "<strong>" + esc(pick(item.zh, item.en)) + "</strong>" +
          '<span lang="' + (en ? "zh-Hant" : "en") + '">' + esc(second(item.zh, item.en)) + "</span></a>"
        );
      })
      .join("");
    var langHref = en ? "../" + page + ".html" : "en/" + page + ".html";
    header.innerHTML =
      '<div class="wrap masthead">' +
      '<a class="masthead__name" href="index.html"><strong>' + esc(pick(site.nameZh, site.nameEn)) + "</strong>" +
      "<span>" + esc(second(site.nameZh, site.nameEn)) + "</span></a>" +
      '<nav class="zones" aria-label="' + (en ? "Main" : "主要導覽") + '">' + plates + "</nav>" +
      '<a class="lang" href="' + langHref + '" hreflang="' + (en ? "zh-Hant" : "en") + '" lang="' + (en ? "zh-Hant" : "en") + '">' +
      (en ? "中文" : "English") + "</a></div>";
    // On narrow screens the zones scroll sideways; start with "you are here" in view.
    var strip = header.querySelector(".zones");
    var here = header.querySelector('[aria-current="page"]');
    if (strip && here && strip.scrollWidth > strip.clientWidth)
      strip.scrollLeft = here.offsetLeft - strip.offsetLeft - (strip.clientWidth - here.offsetWidth) / 2;
  }

  var footer = document.querySelector("[data-site-footer]");
  if (footer) {
    var mail = site.email ? '<li><a href="mailto:' + esc(site.email) + '">' + esc(site.email) + "</a></li>" : "";
    var phone = site.phone ? "<li>" + esc(site.phone) + "</li>" : "";
    footer.innerHTML =
      '<div class="wrap foot">' +
      '<div><p class="foot__name">' + esc(pick(site.nameZh, site.nameEn)) + "</p>" +
      '<p class="foot__other">' + esc(pick(site.dept, site.deptEn)) + "</p></div>" +
      '<ul class="foot__list"><li>' + esc(pick(site.address, site.addressEn)) + "</li>" + mail + phone + "</ul>" +
      '<p class="foot__small">© ' + new Date().getFullYear() + " " + esc(pick(site.nameZh, site.nameEn)) + "</p></div>";
  }

  // The directory bands settle in order, once.
  var bands = document.querySelectorAll(".directory__zones .zone-band");
  for (var i = 0; i < bands.length; i++) bands[i].style.setProperty("--i", i);

  // Section entrances. Each section uses its own data-motion (fade, rise,
  // slide, stagger, none) or the site style's default, and waits (.m-wait)
  // until it scrolls into view. Until this runs, CSS keeps sections hidden
  // but reveals them anyway after 2.5 s, so content never stays hidden.
  var style = root.getAttribute("data-motion");
  if (!style || !("IntersectionObserver" in window)) return;
  var ITEMS = ".zone-band, .area, .member, .alumnus, .pub, .news-item, .photo, .contact-item, .stat, .milestone";
  var reveal = function (section) {
    section.classList.remove("m-wait");
    countUp(section);
  };
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        reveal(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );
  var sections = document.querySelectorAll("body > section");
  for (var s = 0; s < sections.length; s++) {
    var section = sections[s];
    var items = section.querySelectorAll(ITEMS);
    var m = section.getAttribute("data-motion") || (style === "lively" && items.length > 1 ? "stagger" : style === "lively" ? "rise" : "fade");
    if (m === "none") continue;
    section.setAttribute("data-m", m);
    for (var k = 0; k < items.length; k++) items[k].style.setProperty("--m-i", Math.min(k, 12));
    section.classList.add("m-wait");
    io.observe(section);
  }
  root.classList.add("m-armed");

  // Numbers in .stat__value count up from 0 when they come into view, then
  // settle on exactly the text the lab wrote ("30+", "2,400").
  function countUp(section) {
    var values = section.querySelectorAll(".stat__value");
    for (var v = 0; v < values.length; v++) (function (el) {
      var node = null;
      for (var c = 0; c < el.childNodes.length; c++) if (el.childNodes[c].nodeType === 3 && el.childNodes[c].nodeValue.trim()) node = el.childNodes[c];
      if (!node) return;
      var text = node.nodeValue;
      var parts = text.match(/^(\D*)(\d[\d,]*)([\s\S]*)$/);
      if (!parts) return;
      var target = parseInt(parts[2].replace(/,/g, ""), 10);
      var grouped = parts[2].indexOf(",") >= 0;
      var duration = style === "lively" ? 1400 : 1000;
      var start = null;
      var step = function (t) {
        if (start === null) start = t;
        var k = Math.min(1, (t - start) / duration);
        var eased = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
        var n = Math.round(target * eased);
        node.nodeValue = k === 1 ? text : parts[1] + (grouped ? n.toLocaleString("en-US") : String(n)) + parts[3];
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    })(values[v]);
  }
})();
