import { useState, useEffect, useCallback } from "react";

const KEY = "genai_interview_history_v1";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function useInterviewHistory() {
  const [history, setHistory] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(history));
  }, [history]);

  const add = useCallback((entry) => {
    setHistory((prev) => [...prev, { ts: Date.now(), ...entry }].slice(-50));
  }, []);

  return { history, add };
}
