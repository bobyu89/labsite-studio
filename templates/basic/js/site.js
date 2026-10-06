// Draws the header and footer from js/data.js, so the lab name, address and
// navigation are edited once for every page. Pages say which they are with
// <body data-page="…">; the language comes from <html lang>.
(function () {
  var site = typeof SITE !== "undefined" ? SITE : {};
  var nav = typeof NAV !== "undefined" ? NAV : [];
  var root = document.documentElement;
  var en = /^en/i.test(root.lang || "");
  var page = document.body.getAttribute("data-page") || "index";
  // The "js" class (which enables the entrance) is set in each page's <head>,
  // except inside the LabSite editor, where the page is rebuilt on every edit.

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
})();
