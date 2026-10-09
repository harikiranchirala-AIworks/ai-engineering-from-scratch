import { useState, useEffect, useCallback } from "react";

const KEY = "genai_activity_v1";
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

// Tracks study intensity per day for the heatmap.
export function useActivity() {
  const [activity, setActivity] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(activity));
  }, [activity]);

  const ping = useCallback((n = 1) => {
    const t = today();
    setActivity((prev) => ({ ...prev, [t]: (prev[t] || 0) + n }));
  }, []);

  return { activity, ping };
}
