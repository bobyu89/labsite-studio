// 前 10 分鐘: a new site made from a template still carries sample text and
// pictures. This card turns 發布前檢查's findings into five steps, each one
// click from the place to change, ticked off as the samples disappear.
import React, { useEffect, useState } from "react";
import { Check, X } from "@phosphor-icons/react";

const PUB = /(^|\/)(publications?|conferences?|papers?|pubs)\.html?$/i;
const PEOPLE = /(^|\/)(members?|team|people|pi)\.html?$/i;

export function startSteps(checks, { published, unpublished }) {
  const items = (kind) => checks.find((c) => c.kind === kind)?.items || [];
  const sample = items("sample").filter((x) => !x.page?.startsWith("en/"));
  const placeholder = items("placeholder").filter((x) => !x.page?.startsWith("en/"));
  const left = (test) => sample.filter((x) => x.page && test(x.page));
  const other = sample.filter((x) => x.page && !PUB.test(x.page) && !PEOPLE.test(x.page));
  return [
    { id: "site", title: "填上研究室名稱、地址、Email", done: !sample.some((x) => !x.page), go: { tab: "site" } },
    { id: "photos", title: "換上研究室和成員的照片", done: !placeholder.length, go: { page: placeholder[0]?.page } },
    { id: "people", title: "改主持人介紹和成員", done: !left((p) => PEOPLE.test(p)).length, go: { page: left((p) => PEOPLE.test(p))[0]?.page } },
    { id: "papers", title: "放上自己的論文", done: !left((p) => PUB.test(p)).length, go: { papers: true, page: left((p) => PUB.test(p))[0]?.page } },
    { id: "pages", title: "改其他頁面的範例文字", done: !other.length, go: { page: other[0]?.page } },
    { id: "publish", title: "發布，讓大家看到", done: !!published && !unpublished, go: { publish: true } },
  ];
}

export default function GettingStarted({ p, onGo }) {
  const siteId = p.cloudSite?.id;
  const key = "labsite.start.hidden." + siteId;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const [steps, setSteps] = useState(null);
  const version = (p.dirtyPages || []).join(",") + "|" + (p.siteData?.text?.length || 0) + "|" + (p.html?.length || 0);
  useEffect(() => {
    if (hidden || !siteId) return;
    let alive = true;
    const t = setTimeout(() => {
      p.prepublishCheck([], { withDesign: false })
        .then((checks) => alive && setSteps(startSteps(checks || [], { published: p.cloudSite?.published, unpublished: p.cloudSite?.unpublished })))
        .catch(() => {});
    }, 800);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, siteId, version, p.cloudSite?.published, p.cloudSite?.unpublished]);

  // Only for sites that still look like the template.
  if (hidden || !steps || steps.slice(0, 5).every((s) => s.done)) return null;
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const hide = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* private window */
    }
    setHidden(true);
  };
  return (
    <div className="getting-started" role="region" aria-label="開始使用">
      <div className="gs-head">
        <strong>把範本變成你的網站</strong>
        <span className="muted">
          {done}／{steps.length}
        </span>
        <button type="button" className="gs-x" aria-label="不用了，收起來" title="不用了，收起來" onClick={hide}>
          <X size={14} />
        </button>
      </div>
      <div className="gs-bar" aria-hidden="true">
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="gs-steps">
        {steps.map((s) => (
          <li key={s.id} className={s.done ? "done" : s === next ? "next" : ""}>
            {s.done ? <Check size={14} weight="bold" /> : <span className="gs-dot" />}
            {s.done ? (
              <span>{s.title}</span>
            ) : (
              <button type="button" className="text-link" onClick={() => onGo(s.go)}>
                {s.title}
              </button>
            )}
          </li>
        ))}
      </ol>
      <p className="small-note">還有標著「（範例）」的文字或範例照片時，這一步就還沒完成。</p>
    </div>
  );
}
