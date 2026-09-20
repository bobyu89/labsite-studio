import React, { useEffect, useMemo } from "react";
import { Button, Switch, Badge } from "@radix-ui/themes";
import { Translate, Warning, CheckCircle } from "@phosphor-icons/react";
import { Field } from "./ui";
import { parsePage, sectionElements, collectFields, listSections } from "../site/page.js";

const lang = (path) => (path.startsWith("en/") ? "English" : "中文");

/* Side-by-side text fields of the selected section in both languages. */
export default function PairPanel({ p, selected }) {
  const { current, pair, html, pairHtml } = p;
  useEffect(() => {
    if (pair && !pairHtml) p.ensurePair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, pairHtml]);
  const mine = useMemo(() => {
    if (!html) return null;
    const doc = parsePage(html).doc;
    const s = sectionElements(doc)[selected];
    return s ? { sections: listSections(doc), fields: collectFields(s) } : null;
  }, [html, selected]);
  const theirs = useMemo(() => {
    if (!pairHtml) return null;
    const doc = parsePage(pairHtml).doc;
    const s = sectionElements(doc)[selected];
    return { sections: listSections(doc), fields: s ? collectFields(s) : [] };
  }, [pairHtml, selected]);

  if (!pair)
    return (
      <p className="small-note">
        這一頁沒有對應的{current.startsWith("en/") ? "中文" : "英文"}版本（找不到 <code>{current.startsWith("en/") ? current.slice(3) : "en/" + current}</code>）。
      </p>
    );
  if (!theirs) return <p className="small-note">正在載入 {pair}…</p>;
  const status = p.pairStatus[current];
  const rows = Math.max(mine?.fields.length || 0, theirs.fields.length);
  const textRows = [];
  for (let i = 0; i < rows; i++) {
    const a = mine?.fields[i],
      b = theirs.fields[i];
    if ((a && a.kind === "text") || (b && b.kind === "text")) textRows.push([i, a, b]);
  }
  return (
    <div className="pair-panel">
      <div className="pair-status">
        {status === "same" ? (
          <Badge color="teal" variant="soft">
            <CheckCircle size={13} /> 兩頁結構相同
          </Badge>
        ) : (
          <Badge color="orange" variant="soft">
            <Warning size={13} /> 結構不同：{mine?.sections.length ?? 0} vs {theirs.sections.length} 個區塊
          </Badge>
        )}
        <label className="mirror-toggle">
          <Switch size="1" checked={p.mirror} onCheckedChange={p.setMirror} />
          <span>新增／刪除／排序同步到{lang(pair)}頁</span>
        </label>
      </div>
      <p className="small-note">
        左為 <strong>{lang(current)}</strong>（{current}），右為 <strong>{lang(pair)}</strong>（{pair}）。同步過去的新項目會先帶著原文，請在右欄翻譯。
        <button type="button" className="text-link" onClick={p.checkPairs} disabled={p.busy}>
          <Translate size={14} /> 檢查全部頁面的結構
        </button>
      </p>
      {!textRows.length && <p className="small-note">這個區塊沒有可對照的文字。</p>}
      {textRows.map(([i, a, b]) => (
        <div className={"pair-row" + (!a || !b ? " pair-row--missing" : "")} key={i}>
          <div>
            {a ? (
              <Field
                label={a.label}
                value={a.value}
                area={a.long}
                rows={a.long ? 3 : undefined}
                onChange={(v) => p.setText(selected, a.path, v, current)}
              />
            ) : (
              <span className="small-note">（{lang(current)}頁沒有這個欄位）</span>
            )}
          </div>
          <div>
            {b ? (
              <Field
                label={b.label}
                value={b.value}
                area={b.long}
                rows={b.long ? 3 : undefined}
                onChange={(v) => p.setText(selected, b.path, v, pair)}
              />
            ) : (
              <span className="small-note">（{lang(pair)}頁沒有這個欄位）</span>
            )}
          </div>
        </div>
      ))}
      {p.dirtyPages.includes(pair) && (
        <Button size="1" variant="surface" onClick={() => p.savePage(pair)} disabled={p.busy || !p.project.source.writable}>
          保存 {pair}
        </Button>
      )}
    </div>
  );
}
