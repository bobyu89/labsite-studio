import React from "react";
import { Button } from "@radix-ui/themes";
import { Field } from "./ui";

// Edits the string fields of SITE in js/data.js (name, tagline, contact).
export default function SiteDataPanel({ siteData, siteDirty, setSiteField, saveSiteData, writable, busy }) {
  if (!siteData)
    return <p className="small-note">這個網站沒有 js/data.js，或其中沒有 SITE 設定。</p>;
  return (
    <div className="site-data">
      <p className="small-note">
        這些值來自 <code>js/data.js</code> 的 SITE 設定，會顯示在頁尾、聯絡資訊與頁首品牌名稱。各頁的 &lt;title&gt; 與主視覺膠囊標籤是寫死的文字，請到對應頁面修改。
      </p>
      {siteData.fields.map((f) => (
        <Field
          key={f.key}
          label={f.label + (f.label === f.key ? "" : "（" + f.key + "）")}
          value={f.value}
          area={f.value.length > 50}
          rows={2}
          onChange={(v) => setSiteField(f.key, v)}
        />
      ))}
      <Button disabled={!siteDirty || !writable || busy} onClick={saveSiteData}>
        {writable ? "寫回 js/data.js" : "此來源無法寫入"}
      </Button>
    </div>
  );
}
