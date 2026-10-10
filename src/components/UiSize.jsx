// The editor's own text size, remembered per browser. Default 大: teachers
// found the standard size too small.
import React, { useState } from "react";

const KEY = "labsite-ui-size";
const SIZES = [
  ["normal", "標準", 13],
  ["large", "大", 15],
  ["xlarge", "特大", 17],
];
function stored() {
  try {
    return localStorage.getItem(KEY) || "large";
  } catch {
    return "large";
  }
}
export function applyUiSize(size = stored()) {
  document.documentElement.dataset.uiSize = size;
}

export default function UiSize() {
  const [size, setSize] = useState(stored);
  const pick = (s) => {
    setSize(s);
    applyUiSize(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* private mode: lasts until reload */
    }
  };
  return (
    <div className="ui-size">
      <span>文字</span>
      <div className="segmented" role="radiogroup" aria-label="編輯器文字大小">
        {SIZES.map(([id, label, px]) => (
          <button key={id} type="button" role="radio" aria-checked={size === id} className={size === id ? "active" : ""} style={{ fontSize: px }} onClick={() => pick(id)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
