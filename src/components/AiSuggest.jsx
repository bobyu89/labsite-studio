// One AI suggestion for one field: ask, show what came back, 套用 or not.
// The field itself is never changed until 套用.
import React, { useState } from "react";
import { MagicWand } from "@phosphor-icons/react";

export default function AiSuggest({ label = "AI 建議", ask, pickText, onApply, disabled }) {
  const [state, setState] = useState({ busy: false, text: null, error: null });
  const run = async () => {
    setState({ busy: true, text: null, error: null });
    try {
      const r = await ask();
      setState({ busy: false, text: pickText(r), error: null });
    } catch (e) {
      setState({ busy: false, text: null, error: e.message });
    }
  };
  return (
    <div className="ai-suggest">
      {!state.text && (
        <button type="button" className="link-button small-note" disabled={disabled || state.busy} onClick={run}>
          <MagicWand size={13} /> {state.busy ? "AI 看照片中…" : label}
        </button>
      )}
      {state.text && (
        <div className="ai-suggest-box">
          <span>{state.text}</span>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              onApply(state.text);
              setState({ busy: false, text: null, error: null });
            }}
          >
            套用
          </button>
          <button type="button" className="link-button muted" onClick={() => setState({ busy: false, text: null, error: null })}>
            不要
          </button>
        </div>
      )}
      {state.error && <span className="small-note error-text">{state.error}</span>}
    </div>
  );
}
