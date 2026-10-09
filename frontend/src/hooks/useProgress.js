import { useState, useEffect, useCallback } from "react";

const KEY = "genai_roadmap_progress_v2";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function useProgress() {
  const [done, setDone] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(done));
  }, [done]);

  const toggle = useCallback((key) => {
    setDone((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }, []);

  const isDone = useCallback((key) => !!done[key], [done]);

  const countDone = useCallback(
    (keys) => keys.reduce((n, k) => n + (done[k] ? 1 : 0), 0),
    [done]
  );

  const reset = useCallback(() => setDone({}), []);

  return { done, toggle, isDone, countDone, reset };
}
