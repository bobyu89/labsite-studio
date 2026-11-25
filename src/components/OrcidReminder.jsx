// ORCID 新論文提醒: when the site has an ORCID iD saved (一次匯入 › ORCID),
// the editor looks at the ORCID record at most once a day and says how many
// papers there are not yet on the publication pages. Nothing is added until
// the teacher opens the list and chooses.
import React, { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { siteIndex, isListed } from "../site/bibImport.js";
import { publicationPages } from "./AddPublication";

const DAY = 24 * 60 * 60 * 1000;
const keyOf = (w) => (w.doi || w.title).toLowerCase();
const store = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k) || "null");
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private window */
    }
  },
};

export default function OrcidReminder({ p, onOpen }) {
  const siteId = p.project?.source.kind === "cloud" ? p.project.source.site.id : null;
  const [found, setFound] = useState(null); // { orcid, works }
  const pagesKey = publicationPages(p.pages || []).join(",");

  useEffect(() => {
    if (!siteId || !pagesKey || !p.cloudCalls?.getOrcid) return;
    let alive = true;
    (async () => {
      try {
        const { orcid } = await p.cloudCalls.getOrcid(siteId);
        if (!orcid) return;
        const cacheKey = "labsite.orcid." + siteId;
        let cached = store.get(cacheKey);
        if (!cached || cached.orcid !== orcid || Date.now() - cached.at > DAY) {
          const r = await p.cloudCalls.lookupOrcid(orcid);
          cached = { orcid, at: Date.now(), works: r.works };
          store.set(cacheKey, cached);
        }
        const texts = [];
        for (const page of publicationPages(p.pages)) {
          texts.push((await p.ensureLoaded(page)) || "");
          if (p.pages.includes("en/" + page)) texts.push((await p.ensureLoaded("en/" + page)) || "");
        }
        const index = siteIndex(texts);
        const dismissed = new Set(store.get("labsite.orcid.dismissed." + siteId) || []);
        const works = cached.works.filter((w) => !isListed({ doi: w.doi, title: w.title }, index) && !dismissed.has(keyOf(w)));
        if (alive) setFound(works.length ? { orcid, works } : null);
      } catch {
        /* a reminder is not worth an error message */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, pagesKey]);

  if (!found) return null;
  const dismiss = () => {
    const k = "labsite.orcid.dismissed." + siteId;
    store.set(k, [...new Set([...(store.get(k) || []), ...found.works.map(keyOf)])].slice(-500));
    setFound(null);
  };
  return (
    <div className="orcid-reminder" role="status">
      <p>
        ORCID 上有 <strong>{found.works.length} 篇</strong>論文還沒放上網站。
      </p>
      <div>
        <button type="button" className="text-link" onClick={() => onOpen(found)}>
          看看是哪幾篇
        </button>
        <button type="button" className="orcid-reminder-x" aria-label="這幾篇不用放，不再提醒" title="這幾篇不用放，不再提醒" onClick={dismiss}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
