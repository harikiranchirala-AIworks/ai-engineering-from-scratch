import { useState, useEffect } from "react";

const KEY = "genai_streak_v1";
const today = () => new Date().toISOString().slice(0, 10);
const dayBefore = (d) => {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() - 1);
  return dt.toISOString().slice(0, 10);
};

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { streak: 0, best: 0, lastDate: null };
  } catch {
    return { streak: 0, best: 0, lastDate: null };
  }
}

// Counts consecutive days the learner opened the app.
export function useStreak() {
  const [state, setState] = useState(load);

  useEffect(() => {
    setState((prev) => {
      const t = today();
      if (prev.lastDate === t) return prev;
      let streak;
      if (prev.lastDate === dayBefore(t)) streak = prev.streak + 1;
      else streak = 1;
      const next = { streak, best: Math.max(prev.best, streak), lastDate: t };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
