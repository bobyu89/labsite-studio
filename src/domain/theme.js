// Site theme is independent from the editor's own Radix theme.
export const DEFAULT_THEME = {
  color: "#0d6557",
  font: "sans",
  radius: "soft",
  spacing: "comfortable",
  textSize: "standard",
};
export const THEME_OPTIONS = {
  font: { sans: "清晰黑體", rounded: "圓潤黑體" },
  radius: { square: "方角", soft: "柔和", round: "圓潤" },
  spacing: { compact: "緊湊", comfortable: "舒適", airy: "寬鬆" },
  textSize: { standard: "標準", large: "加大" },
};
export function validTheme(t) {
  return (
    t &&
    /^#[0-9a-f]{6}$/i.test(t.color) &&
    Object.entries(THEME_OPTIONS).every(([key, values]) =>
      Object.hasOwn(values, t[key]),
    )
  );
}
export function themeCSS(theme) {
  const t = validTheme(theme) ? theme : DEFAULT_THEME;
  const fonts = {
    sans: '"Segoe UI","Microsoft JhengHei",sans-serif',
    rounded: '"Arial Rounded MT Bold","Microsoft JhengHei",sans-serif',
  };
  return `:root{--accent:${t.color};--site-font:${fonts[t.font]};--site-radius:${{ square: 0, soft: 10, round: 22 }[t.radius]}px;--site-space:${{ compact: 36, comfortable: 54, airy: 76 }[t.spacing]}px;--site-body:${t.textSize === "large" ? 19 : 16}px}`;
}
