# 讓網站能被 LabSite 編輯：HTML 標記慣例

LabSite 不需要設定檔、不需要 schema，也不需要靜態網站產生器。它讀你的 `.html` 原檔，靠**結構**判斷哪些東西可以編輯。只要網站符合下面的慣例，就能直接開啟、拖拉、改字、存檔，而且存回去的檔案除了你改的地方之外逐字元不變。

這份文件把那些慣例寫清楚，讓你在寫新的實驗室網站、或改造現有網站時有依據。對照關係類似 CloudCannon 的 `data-editable` 或 Sitecake 的 `sc-content`，差別是 LabSite **不用加任何屬性**，全靠常見的 HTML 寫法。

## 1. 頁面

| 規則 | 說明 |
|---|---|
| 位置 | 根目錄與 `en/` 底下的 `*.html`。其他子資料夾的 HTML 不列為頁面。 |
| 中英配對 | `x.html` 與 `en/x.html` 視為同一頁的兩個語言版本；「一鍵切換語言」與「中英對照」都靠這個命名。 |
| 頁面資訊 | `<title>`、`<meta name="description">` 可編輯；若存在 `og:title`、`og:description`、`twitter:title`、`twitter:description`，會同步更新。 |
| 網站資料 | `js/data.js` 裡 `const SITE = { … }` 的**雙引號、單行**字串欄位（名稱、標語、主持人、Email 等）可逐值編輯；數字與巢狀物件不動。 |

## 2. 區塊（可拖拉排序、複製、刪除）

**區塊 = `<body>` 直屬的 `<section>`。** 這是最重要的一條。

```html
<body>
  <div class="news-ticker"></div>          <!-- 不是區塊：不是 section -->

  <!-- ===== 研究團隊 ===== -->              <!-- 前置註解會跟著區塊一起移動 -->
  <section class="section" id="team">      <!-- 區塊 1 -->
    …
  </section>

  <div class="ecg-divider"></div>          <!-- 分隔線：class 含 divider，跟著相鄰區塊增減 -->

  <section class="section" id="contact">   <!-- 區塊 2 -->
    …
  </section>

  <script src="js/data.js"></script>
</body>
```

- 包在 `<main>`、`<div>` 或其他容器裡的 `<section>` **不會**被列出（例如 Jekyll 模板常見的 `<main><section>…`）。這種頁面開啟後會顯示提示，仍可改頁面資訊，但區塊面板是空的。
- 區塊標題取自區塊內第一個 `h1`／`h2`／`h3`；沒有就用 `id`；再沒有就顯示「區塊 N」。
- `class` 含 `hero` 或 `page-hero` 的區塊標為「主視覺」，含 `<form>` 的標為「表單」。
- 分隔線：任何 `class` 含 `divider` 的非 `section` 元素。搬移、刪除、複製區塊時會維持「區塊、分隔線、區塊」的節奏；複製時若找不到分隔線會插入 `<div class="ecg-divider">`。
- 複製區塊會移除複本內所有 `id`，避免重複。
- 一頁至少保留一個區塊，最後一個不能刪。

## 3. 欄位（文字、連結、圖片）

選定區塊後，LabSite 走訪裡面的元素，把這些東西列成欄位：

| 類型 | 規則 |
|---|---|
| 文字 | 每一段非空白的文字節點。行內元素（`span`、`a`、`strong`、`em`、`b`、`i`、`small`、`code`、`sup`、`sub`、`time`、`mark`、`abbr`、`u`、`br`）內的文字會標成「上層標籤 › 文字」，方便看出是高亮片段。 |
| 連結 | 每個 `<a>` 的 `href`。 |
| 圖片 | 每個 `<img>` 的 `src` 與 `alt`。更換圖片時檔案寫進網站的 `assets/`，`src` 改成相對路徑（`en/` 頁面自動加 `../`）。 |
| 略過 | `script`、`style`、`svg`、`noscript`、`template`、`iframe`、`input`、`textarea`、`select` 內部一律不碰。 |

只有 `src`、`alt`、`href`、`title` 四個屬性可以被改寫，其他屬性（含所有 `on*` 事件）程式拒絕修改。

**欄位標籤怎麼來**：先看元素 `class` 是否含這些關鍵字，再退回標籤名稱。

| class 含 | 顯示 |  | 標籤 | 顯示 |
|---|---|---|---|---|
| `chip` | 標籤 | | `h1` | 主標題 |
| `btn` | 按鈕 | | `h2` | 區塊標題 |
| `title` | 標題 | | `h3` | 小標題 |
| `label` | 標籤文字 | | `p` | 段落 |
| `desc` | 說明 | | `li` | 清單項目 |
| `role` | 職稱 | | `a` | 連結 |
| `name` | 名稱 | | `figcaption` | 圖說 |
| `subtitle` | 副標 | | `td`／`th` | 表格內容／標題 |
| `eyebrow` | 眉標 | | `blockquote` | 引言 |

（`reveal`、`in`、`mono-en` 這幾個純動畫或字型用的 class 會被忽略，不影響判斷。）

## 4. 項目清單（可新增、刪除、拖拉排序）

**清單 = 一個容器，裡面的元素子節點全部「標籤相同、class 相同」。** 不需要任何額外標記。

```html
<div class="member-grid">
  <article class="member-card">…</article>   <!-- 項目 1 -->
  <article class="member-card">…</article>   <!-- 項目 2 -->
  <article class="member-card">…</article>   <!-- 項目 3 -->
</div>
```

- 兩個以上同型子元素就算清單。只有一個子元素時，容器必須是 `ul`／`ol`／`tbody`，或 `class` 含 `grid`、`list`、`chips`、`items`、`cards`，才會被當成「只有一項的清單」。
- `<tr>` 的子元素是欄位不是項目，表格列本身才是項目。
- 清單可以巢狀：成員卡裡的學經歷 `<ul>`、標籤膠囊都會各自成為清單。
- 新增項目 = 複製鄰近項目（含內容，之後再改字）。刪除與排序會連同項目之間的空白一起處理，保持縮排。
- 項目開頭若是 `1.`、`2.`、`3、` 這種編號文字，排序或增刪後會自動重排。
- 清單名稱看 class：`member`→成員、`area`→研究領域、`focus`→重點卡片、`pub`→文獻、`chip`→標籤、`project`→計畫、`news`→消息、`gallery`→照片、`award`→得獎、`block`→資訊區；都沒有就用「表格列」「條列項目」或「項目」。
- `class` 裡的 `reveal`、`in` 不列入比對，所以動畫 class 不會讓項目被誤判成不同型。

## 5. 中英對照與結構同步

- 兩個語言頁的區塊數量、每個區塊的內部結構（標籤與 class 的樹）相同時，新增／刪除／排序區塊或項目會自動套用到另一頁，新項目先帶原文。
- 結構不同時停止同步，頁面選單標 ⚠。想恢復同步就把兩頁的結構改成一致。

## 6. 存檔保真：哪些寫法會被原樣保留

LabSite 存檔時只改你動過的節點，其他一切原樣寫回。已驗證會保留的寫法：

- CRLF／LF 換行、檔尾有沒有換行、`<!DOCTYPE>` 的大小寫與寫法、`<html>` 與 `<head>` 之間的空白。
- 屬性的單引號、無值屬性（`<link crossorigin>`）、大小寫（`viewbox` 不會被改成 `viewBox`）、屬性值裡的 `&amp;`。
- 文字裡的實體（`&amp;`、`&nbsp;`）與直接寫入的 U+00A0 不斷行空白。
- SVG 葉節點的寫法：`<path …/>`、`<path … />`、`<path …></path>` 三種都各自保留。
- `<script>`、`<style>` 內容一字不動。

驗證語料：兩個真實實驗室網站共 42 頁，加上 Greene Lab「Lab Website Template」（Jekyll）6 頁，在 Chromium 與測試環境中皆逐字元一致。細節見 [`VALIDATION.md`](../VALIDATION.md)。

## 7. 給新網站的最短檢查表

1. 頁面放在根目錄，英文版放 `en/` 同名。
2. 每個想拖拉的區塊是 `<body>` 直屬 `<section>`，區塊之間用 `class="… divider"` 的元素分隔。
3. 每個區塊裡有一個 `h2`（或 `h1`／`h3`）當標題。
4. 重複的東西（成員、文獻、卡片）用同一個標籤加同一組 class，放在同一個容器裡。
5. 圖片放 `assets/`。
6. 網站層級的字串放在 `js/data.js` 的 `const SITE = {…}`，值用雙引號、寫在一行。
