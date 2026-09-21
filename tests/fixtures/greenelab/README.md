# 外部語料：Greene Lab「Lab Website Template」

這六頁是 <https://greenelab.github.io/lab-website-template/> 在 2026-09-21 發布的 HTML，原樣存檔（LF、未經整理），用來驗證 LabSite 對**不是我們自己寫的**網站結構會怎麼反應。

- 來源 repo：<https://github.com/greenelab/lab-website-template>（BSD-3-Clause，版權屬 Greene Lab）。
- 只作測試語料，不隨編輯器發布；更新語料時直接重新下載覆蓋即可。

這套模板由 Jekyll 產生，`<section>` 全部包在 `<main>` 裡，不是 `<body>` 直屬，所以 LabSite 目前會辨識出 0 個區塊。`tests/external.test.js` 記錄了這個事實與逐字元 round-trip 的結果。
