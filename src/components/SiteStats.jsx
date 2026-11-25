// 網站造訪統計 on 我的網站: the last 30 days, compared with the 30 before,
// a bar per day and the most visited pages. Counted by the public host
// without cookies (cloud/src/sites.js countView).
import React, { useEffect, useState } from "react";
import { pageLabel } from "../hooks/useProject";

export default function SiteStats({ p, site }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    p.cloudCalls
      .stats(site.id, 30)
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [site.id]);
  if (error) return <p className="small-note error-text">{error}</p>;
  if (!stats) return <p className="small-note">讀取中…</p>;
  // One bar per day, days without visits included.
  const byDay = new Map(stats.daily.map((d) => [d.day, d.views]));
  const days = [];
  const start = new Date(stats.from + "T00:00:00Z").getTime();
  for (let i = 0; i < stats.days; i++) {
    const day = new Date(start + i * 86400000).toISOString().slice(0, 10);
    days.push({ day, views: byDay.get(day) || 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.views));
  const change = stats.previous ? Math.round(((stats.total - stats.previous) / stats.previous) * 100) : null;
  return (
    <div className="site-stats">
      <p className="site-stats-total">
        近 30 天 <strong>{stats.total.toLocaleString()}</strong> 次瀏覽
        {change !== null && <span className={change >= 0 ? "up" : "down"}>（比前 30 天{change >= 0 ? "多" : "少"} {Math.abs(change)}%）</span>}
      </p>
      <div className="site-stats-bars" role="img" aria-label={`近 30 天每天的瀏覽次數，最多一天 ${max} 次`}>
        {days.map((d) => (
          <span key={d.day} title={`${d.day}：${d.views} 次`} style={{ height: `${Math.max(2, (d.views / max) * 100)}%` }} className={d.views ? "" : "zero"} />
        ))}
      </div>
      {stats.pages.length > 0 ? (
        <ol className="site-stats-pages">
          {stats.pages.slice(0, 5).map((x) => (
            <li key={x.path}>
              <span>
                {pageLabel(x.path)}
                {x.path.startsWith("en/") ? "（英文）" : ""}
              </span>
              <b>{x.views.toLocaleString()}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="small-note">還沒有瀏覽紀錄。統計從這個功能上線後開始計算。</p>
      )}
      <p className="small-note">只算網頁被打開的次數，不記錄訪客是誰，也不使用 cookie；搜尋引擎的機器人不算。</p>
    </div>
  );
}
