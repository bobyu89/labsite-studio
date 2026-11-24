import React from "react";
import { Button } from "@radix-ui/themes";
import { Field } from "./ui";
import { SITE_FIELDS, SITE_GROUPS, isSampleValue } from "../site/siteData.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Edits the string fields of SITE in js/data.js (name, contact), grouped, each
// with where it shows on the site; template sample values are flagged.
export default function SiteDataPanel({ siteData, siteDirty, setSiteField, saveSiteData, writable, busy, autosave = false }) {
  if (!siteData)
    return <p className="small-note">這個網站的頁首與頁尾是直接寫在每一頁裡的，請在「編輯內容」點選要改的地方修改。</p>;
  const samples = siteData.fields.filter((f) => !f.unused && isSampleValue(f.value)).length;
  return (
    <div className="site-data">
      <p className="small-note">這裡的資料會出現在每一頁的頁首和頁尾，改一次，全站一起更新。每一頁的標題請到「分享設定」改。</p>
      {samples > 0 && (
        <p className="site-data-warn" role="status">
          還有 {samples} 項是範本的範例內容（標示「範例」），發布前記得換成研究室的資料。
        </p>
      )}
      {SITE_GROUPS.map(([group, legend]) => {
        const fields = siteData.fields.filter((f) => (f.group || "other") === group);
        if (!fields.length) return null;
        return (
          <fieldset className="site-data-group" key={group}>
            <legend>{legend}</legend>
            {fields.map((f) => {
              const def = SITE_FIELDS[f.key] || {};
              const sample = !f.unused && isSampleValue(f.value);
              const badEmail = def.type === "email" && f.value && !EMAIL.test(f.value);
              return (
                <div className={"site-data-field" + (f.unused ? " unused" : "")} key={f.key}>
                  <Field
                    label={
                      <>
                        {f.label}
                        {sample && <span className="sample-badge">範例</span>}
                      </>
                    }
                    value={f.value}
                    area={def.long || f.value.length > 50}
                    rows={2}
                    type={def.type === "email" ? "email" : undefined}
                    onChange={(v) => setSiteField(f.key, v)}
                  />
                  {f.where && <span className="small-note">{f.where}</span>}
                  {badEmail && <span className="small-note error-text">Email 格式看起來不對，例如 lab@school.edu.tw。</span>}
                </div>
              );
            })}
          </fieldset>
        );
      })}
      {autosave && writable ? (
        <span className="small-note">修改會自動存成草稿；按上方的「發布」，網站才會更新。</span>
      ) : (
        <>
          <Button disabled={!siteDirty || !writable || busy} onClick={saveSiteData}>
            {writable ? "保存研究室資料" : "這個網站不能在這裡修改"}
          </Button>
          {siteDirty && writable && <span className="small-note">保存後一樣要按「發布」，網站才會更新。</span>}
        </>
      )}
    </div>
  );
}
