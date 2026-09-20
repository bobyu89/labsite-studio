import { useState, useReducer, useEffect, useMemo } from "react";
import { KEY, seed, nextRecord } from "../model.js";
import { loadRecord, storeRecord } from "../domain/storage.js";
import { createHistory, historyReducer } from "../domain/history.js";
import { deepEqual } from "../domain/equal.js";

const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(KEY) : null;

export function useDraft(notify) {
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [state, dispatch] = useReducer(historyReducer, seed, createHistory);
  const [error, setError] = useState(null),
    [conflict, setConflict] = useState(false),
    [saving, setSaving] = useState(false);
  const draft = state.present;
  const dirty = useMemo(
    () => !deepEqual(draft, saved?.draft ?? seed),
    [draft, saved],
  );
  useEffect(() => {
    let alive = true;
    loadRecord().then((r) => {
      if (!alive) return;
      if (r.record) {
        setSaved(r.record);
        dispatch({ type: "reset", draft: r.record.draft });
        if (r.imported)
          notify("已從舊版瀏覽器儲存空間讀入草稿；下次保存後會改存到本機資料庫。");
      }
      if (r.error) setError(r.error);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onLeave = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);
  useEffect(() => {
    if (!channel) return;
    const onMessage = (e) => {
      if (e.data?.type === "saved" && e.data.revision !== (saved?.revision ?? 0))
        setConflict(true);
    };
    channel.addEventListener("message", onMessage);
    return () => channel.removeEventListener("message", onMessage);
  }, [saved]);
  function change(update, group) {
    const keys = typeof update === "object" ? Object.keys(update) : [];
    const auto =
      keys.length === 1 && typeof update[keys[0]] === "string"
        ? "site:" + keys[0]
        : null;
    dispatch({ type: "change", update, group: group ?? auto, at: Date.now() });
  }
  function boundary() {
    dispatch({ type: "boundary" });
  }
  async function save() {
    boundary();
    setSaving(true);
    const persist = async () => {
      try {
        const loaded = await loadRecord();
        if (loaded.error && !loaded.record) throw Error("read");
        const next = nextRecord(loaded.record, saved?.revision ?? 0, draft);
        await storeRecord(next);
        setSaved(next);
        setConflict(false);
        setError(null);
        channel?.postMessage({ type: "saved", revision: next.revision });
        notify("草稿已保存到此瀏覽器，正式網站尚未更新。");
      } catch (e) {
        if (e.message === "conflict") setConflict(true);
        else
          setError(
            "草稿尚未保存。內容仍在畫面中，請下載備份後檢查儲存空間或重試。",
          );
      }
    };
    try {
      if (navigator.locks) await navigator.locks.request(KEY, persist);
      else await persist();
    } catch {
      setError("未能取得本機保存權限，請下載備份或稍後重試。");
    } finally {
      setSaving(false);
    }
  }
  async function loadLatest() {
    const r = await loadRecord();
    if (r.record) {
      setSaved(r.record);
      dispatch({ type: "reset", draft: r.record.draft });
      setConflict(false);
      setError(null);
    } else setError(r.error ?? "找不到可讀取的草稿。");
  }
  return {
    draft,
    saved,
    dirty,
    loading,
    error,
    conflict,
    saving,
    change,
    save,
    loadLatest,
    boundary,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
