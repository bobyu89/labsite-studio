import { deepEqual } from "./equal.js";
// Consecutive changes to one field form an undo step; structural actions never coalesce.
export const createHistory = (draft) => ({
  present: structuredClone(draft),
  past: [],
  future: [],
  group: null,
  at: 0,
});
export function historyReducer(state, action) {
  if (action.type === "reset") return createHistory(action.draft);
  if (action.type === "boundary") return { ...state, group: null };
  if (action.type === "undo")
    return !state.past.length
      ? state
      : {
          present: state.past.at(-1),
          past: state.past.slice(0, -1),
          future: [state.present, ...state.future],
          group: null,
          at: 0,
        };
  if (action.type === "redo")
    return !state.future.length
      ? state
      : {
          present: state.future[0],
          past: [...state.past, state.present].slice(-30),
          future: state.future.slice(1),
          group: null,
          at: 0,
        };
  if (action.type !== "change") return state;
  const base = structuredClone(state.present);
  const next =
    typeof action.update === "function"
      ? action.update(base)
      : { ...base, ...action.update };
  if (deepEqual(next, state.present)) return state;
  const join =
    !!action.group &&
    action.group === state.group &&
    action.at - state.at < 1000;
  return {
    present: next,
    past: join ? state.past : [...state.past, state.present].slice(-30),
    future: [],
    group: action.group ?? null,
    at: action.at,
  };
}
