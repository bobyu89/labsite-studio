// 素材庫 views inside 雲端相簿: medical icons, illustrated people, backgrounds
// and decorations (all free to bundle), plus links to outside sources whose
// terms only allow downloading one by one. Picking an item writes a coloured
// SVG into the site (assets/library/…) and hands back its path.
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { ArrowSquareOut, ArrowsClockwise } from "@phosphor-icons/react";
import {
  ICONS_URL,
  COLOR_PRESETS,
  validColor,
  colorIcon,
  iconAssetPath,
  searchIcons,
  PEOPLE_STYLES,
  personSvg,
  personAssetPath,
  randomSeeds,
  DECOR,
  decorAssetPath,
  svgDataUrl,
  tint,
  EXTERNAL_SOURCES,
} from "../site/assetLibrary.js";

let iconsCache = null;
function useIcons() {
  const [data, setData] = useState(iconsCache);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (iconsCache) return;
    fetch(ICONS_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => setData((iconsCache = d)))
      .catch((e) => setError("讀不到圖示庫（" + e.message + "）"));
  }, []);
  return { data, error };
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="lib-colors" role="radiogroup" aria-label="顏色">
      {COLOR_PRESETS.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} className={value === c ? "active" : ""} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
      <label className="lib-color-custom" title="自訂顏色">
        <input type="color" value={validColor(value) ? value : "#0d6557"} onChange={(e) => onChange(e.target.value)} />
        自訂
      </label>
    </div>
  );
}

// One tile: a preview and, depending on the mode, 使用這張 or 加到相簿.
function Tile({ name, src, onUse, albums, onAddTo, pick, wide }) {
  return (
    <li className={"lib-tile" + (wide ? " wide" : "")}>
      {pick ? (
        <button type="button" className="lib-pick" onClick={onUse} aria-label={"使用「" + name + "」"}>
          <img src={src} alt="" />
          <span>{name}</span>
        </button>
      ) : (
        <>
          <div className="lib-preview">
            <img src={src} alt="" />
          </div>
          <span className="lib-name">{name}</span>
          {albums.length > 0 ? (
            <select aria-label={"把「" + name + "」加到相簿"} value="" onChange={(e) => e.target.value && onAddTo(e.target.value)}>
              <option value="">加到相簿…</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="muted lib-hint">先建立相簿才能加入</span>
          )}
        </>
      )}
    </li>
  );
}

export default function AssetLibrary({ p, kind, pick, onPick }) {
  const albums = p.albums?.albums || [];
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  // A picked item is written into the site with the page being edited (or
  // with the album when added to one), then used.
  const use = (path, svg, name) => {
    p.stageLibraryAsset(path, svg);
    onPick(path, name);
  };
  const addTo = (albumId, path, svg, name) => {
    p.stageLibraryAsset(path, svg, { album: albumId, caption: name });
  };
  if (kind === "icons") return <IconsView {...{ p, pick, color, setColor, use, addTo, albums }} />;
  if (kind === "people") return <PeopleView {...{ pick, color, setColor, use, addTo, albums }} />;
  if (kind === "decor") return <DecorView {...{ pick, color, setColor, use, addTo, albums }} />;
  return <ExternalView />;
}

function IconsView({ pick, color, setColor, use, addTo, albums }) {
  const { data, error } = useIcons();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [style, setStyle] = useState("outline");
  const groups = useMemo(() => (data ? [...new Set(data.icons.map((i) => i.group))] : []), [data]);
  const list = useMemo(() => (data ? searchIcons(data.icons, query, group) : []), [data, query, group]);
  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="small-note">讀取圖示中…</p>;
  return (
    <div className="lib-view">
      <p className="small-note">
        {data.icons.length} 個醫療護理圖示，可以選顏色和樣式。來源：Health Icons（MIT 授權，免費使用）。
      </p>
      <div className="lib-controls">
        <input className="lib-search" type="search" placeholder="搜尋：聽診器、nurse…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜尋圖示" />
        <div className="segmented" role="radiogroup" aria-label="樣式">
          {[
            ["outline", "線條"],
            ["filled", "實心"],
          ].map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={style === id} className={style === id ? "active" : ""} onClick={() => setStyle(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="lib-chips">
        {["", ...groups].map((g) => (
          <button key={g || "all"} type="button" className={group === g ? "active" : ""} onClick={() => setGroup(g)}>
            {g || "全部"}
          </button>
        ))}
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <ul className="lib-grid icons">
        {list.map((i) => {
          const svg = colorIcon(i[style] || i.outline, color);
          const path = iconAssetPath(i.id, style, color);
          return <Tile key={i.id} name={i.name} src={svgDataUrl(svg)} pick={pick} albums={albums} onUse={() => use(path, svg, i.name)} onAddTo={(a) => addTo(a, path, svg, i.name)} />;
        })}
      </ul>
      {list.length === 0 && <p className="small-note">找不到符合的圖示，換個關鍵字試試。</p>}
    </div>
  );
}

function PeopleView({ pick, color, setColor, use, addTo, albums }) {
  const [style, setStyle] = useState(PEOPLE_STYLES[0].id);
  const [seeds, setSeeds] = useState(() => randomSeeds(12, 20261012));
  const [withBg, setWithBg] = useState(true);
  const [svgs, setSvgs] = useState({});
  const bg = withBg ? tint(color, 0.82) : "";
  useEffect(() => {
    let alive = true;
    setSvgs({});
    Promise.all(seeds.map(async (s) => [s, await personSvg(style, s, bg)])).then((pairs) => alive && setSvgs(Object.fromEntries(pairs)));
    return () => {
      alive = false;
    };
  }, [style, seeds, bg]);
  const credit = PEOPLE_STYLES.find((s) => s.id === style).credit;
  return (
    <div className="lib-view">
      <p className="small-note">每次都能產生不同的人物，適合當成員頭像或版面插圖。畫風來源：{credit}，可以自由使用。</p>
      <div className="lib-controls">
        <div className="segmented" role="radiogroup" aria-label="畫風">
          {PEOPLE_STYLES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={style === s.id} className={style === s.id ? "active" : ""} onClick={() => setStyle(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <Button size="1" variant="soft" onClick={() => setSeeds(randomSeeds(12))}>
          <ArrowsClockwise size={14} /> 換一批
        </Button>
        <label className="check-row">
          <input type="checkbox" checked={withBg} onChange={(e) => setWithBg(e.target.checked)} /> 加底色
        </label>
      </div>
      {withBg && <ColorPicker value={color} onChange={setColor} />}
      <ul className="lib-grid people">
        {seeds.map((s, n) =>
          svgs[s] ? (
            <Tile key={s} name={"人物 " + (n + 1)} src={svgDataUrl(svgs[s])} pick={pick} albums={albums} onUse={() => use(personAssetPath(style, s, bg), svgs[s], "人物")} onAddTo={(a) => addTo(a, personAssetPath(style, s, bg), svgs[s], "人物")} />
          ) : (
            <li key={s} className="lib-tile loading" aria-hidden="true" />
          ),
        )}
      </ul>
    </div>
  );
}

function DecorView({ pick, color, setColor, use, addTo, albums }) {
  return (
    <div className="lib-view">
      <p className="small-note">背景圖可以放在圖文分割、單張照片或主視覺；分隔線和徽章可以放在任何圖片欄位。全部由 LabSite 繪製，跟著你選的顏色變。</p>
      <ColorPicker value={color} onChange={setColor} />
      {["背景", "裝飾"].map((kind) => (
        <section key={kind}>
          <h4 className="lib-subtitle">{kind}</h4>
          <ul className={"lib-grid decor " + (kind === "裝飾" ? "lines" : "")}>
            {DECOR.filter((d) => d.kind === kind).map((d) => {
              const svg = d.svg(color);
              const path = decorAssetPath(d.id, color);
              return <Tile key={d.id} name={d.name} src={svgDataUrl(svg)} wide={kind === "裝飾"} pick={pick} albums={albums} onUse={() => use(path, svg, d.name)} onAddTo={(a) => addTo(a, path, svg, d.name)} />;
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ExternalView() {
  return (
    <div className="lib-view">
      {EXTERNAL_SOURCES.map((s) => (
        <section key={s.id} className="lib-external">
          <h4>{s.name}</h4>
          <p>{s.note}</p>
          <ol>
            <li>在下方打開網站，找到喜歡的插畫，下載 PNG。</li>
            <li>回到這裡，選一本相簿（或新增一本），用「選擇照片」把剛下載的圖上傳。</li>
            <li>之後就能像一般照片一樣，放進任何圖片欄位。</li>
          </ol>
          <Button asChild variant="soft">
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              <ArrowSquareOut size={16} /> 打開 {s.name}
            </a>
          </Button>
        </section>
      ))}
    </div>
  );
}
