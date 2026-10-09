import { useState, useEffect, useCallback } from "react";

const KEY = "genai_flashcard_ratings_v1";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export const cardKey = (c) => `${c.moduleCode}::${c.front}`;

export function useRatings() {
  const [ratings, setRatings] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(ratings));
  }, [ratings]);

  const rate = useCallback((card, value) => {
    setRatings((prev) => ({ ...prev, [cardKey(card)]: value }));
  }, []);

  const getRating = useCallback((card) => ratings[cardKey(card)], [ratings]);

  const reset = useCallback(() => setRatings({}), []);

  return { ratings, rate, getRating, reset };
}
