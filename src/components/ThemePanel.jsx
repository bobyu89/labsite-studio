import React from "react";
import { Select } from "@radix-ui/themes";
import { Check } from "@phosphor-icons/react";
import { Field } from "./ui";
import { THEME_OPTIONS } from "../domain/theme";
export default function ThemePanel({ draft, change }) {
  const update = (key, value) =>
    change((d) => {
      d.theme[key] = value;
      return d;
    }, "theme:" + key);
  return (
    <div className="block-editor">
      <h3>全站外觀</h3>
      <p className="small-note">
        主題會同步套用到所有區塊，預覽與匯出保持一致。
      </p>
      <Field
        label="研究室名稱"
        value={draft.name}
        onChange={(name) => change({ name })}
      />
      <Field
        label="英文名稱"
        value={draft.english}
        onChange={(english) => change({ english })}
      />
      <Field
        label="聯絡 Email"
        type="email"
        value={draft.email}
        onChange={(email) => change({ email })}
      />
      <label className="field">
        <span>網站主色</span>
        <div className="color-picker">
          {["#0d6557", "#245a90", "#7d453e", "#444c58"].map((color) => (
            <button
              key={color}
              aria-label={"選擇主色 " + color}
              aria-pressed={draft.theme.color === color}
              style={{ background: color }}
              onClick={() => update("color", color)}
            >
              {draft.theme.color === color && <Check size={18} color="white" />}
            </button>
          ))}
          <input
            type="color"
            aria-label="自訂網站主色"
            value={draft.theme.color}
            onChange={(e) => update("color", e.target.value)}
          />
        </div>
      </label>
      {Object.entries(THEME_OPTIONS).map(([key, options]) => (
        <label className="field" key={key}>
          <span>
            {
              {
                font: "字體風格",
                radius: "圓角",
                spacing: "區塊間距",
                textSize: "內文字級",
              }[key]
            }
          </span>
          <Select.Root
            value={draft.theme[key]}
            onValueChange={(v) => update(key, v)}
          >
            <Select.Trigger />
            <Select.Content>
              {Object.entries(options).map(([id, label]) => (
                <Select.Item key={id} value={id}>
                  {label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </label>
      ))}
      <p className="small-note">字體使用裝置內建字型，未安裝時採用系統黑體。</p>
    </div>
  );
}
