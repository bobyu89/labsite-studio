import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { themeCSS } from "./domain/theme";
import { homepage } from "./domain/project";
import siteCss from "./site.css?raw";
export function Site({ draft: d }) {
  const sections = homepage(d).blocks.filter((b) => b.visible);
  return (
    <>
      <header>
        <strong>{d.name}</strong>
        <nav>
          {sections
            .filter((b) => b.type !== "hero")
            .map((b) => (
              <a key={b.id} href={"#" + b.id}>
                {b.title}
              </a>
            ))}
        </nav>
      </header>
      <main>
        {sections.map((b) => (
          <section
            key={b.id}
            id={b.id}
            className={
              b.type === "hero"
                ? "hero " + (b.props.layout === "center" ? "center" : "")
                : ""
            }
          >
            {b.type === "hero" ? (
              <>
                <div className="intro">
                  <span className="eyebrow">{d.english}</span>
                  <h1>{b.props.title}</h1>
                  <p>{b.props.description}</p>
                  {b.props.cover &&
                    d.assets.find((a) => a.id === b.props.cover) && (
                      <img
                        className="cover"
                        src={d.assets.find((a) => a.id === b.props.cover).src}
                        alt={d.assets.find((a) => a.id === b.props.cover).alt}
                      />
                    )}
                </div>
                <aside className="research-note">
                  <span className="eyebrow">Our approach</span>
                  <b>
                    理解問題。
                    <br />
                    連結知識。
                    <br />
                    實踐改變。
                  </b>
                  <p>從生活出發，讓知識與實踐相遇。</p>
                </aside>
              </>
            ) : (
              <>
                <h2>{b.title}</h2>
                {b.type === "research" ? (
                  <div className="grid">
                    {d.collections[b.collectionId].map((r, i) => (
                      <article key={r.id}>
                        <span>0{i + 1}</span>
                        <h3>{r.title}</h3>
                        <p>{r.description}</p>
                      </article>
                    ))}
                  </div>
                ) : b.type === "news" ? (
                  d.collections[b.collectionId].map((r) => (
                    <article className="news-row" key={r.id}>
                      <time>{r.date}</time>
                      <div>
                        <h3>{r.title}</h3>
                        <p>{r.description}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="team-grid">
                    {d.collections[b.collectionId].map((r) => (
                      <article key={r.id}>
                        <h3>{r.title}</h3>
                        <p>{r.description}</p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        ))}
      </main>
      <footer>
        <span>
          {d.name} · {d.english}
        </span>
        <a href={"mailto:" + d.email}>{d.email}</a>
      </footer>
    </>
  );
}
export function siteDocument(d) {
  const content = renderToStaticMarkup(<Site draft={d} />);
  const title = d.name.replace(/[<>&"']/g, "");
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${siteCss}${themeCSS(d.theme)}</style></head><body>${content}</body></html>`;
}
