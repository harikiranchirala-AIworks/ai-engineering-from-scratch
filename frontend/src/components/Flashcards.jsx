import { useState, useMemo, useEffect } from "react";
import { RotateCw, ArrowRight, ArrowLeft, Shuffle, AlertTriangle, Flame, Layers, Clock, CheckCircle2 } from "lucide-react";
import { FLASHCARDS } from "../data/curriculum";
import { cardKey } from "../hooks/useRatings";

const RATING_META = {
  again: { label: "Again", cls: "bg-[#FF3B30] text-white", key: "again" },
  good: { label: "Good", cls: "bg-[#FAFF00] text-black", key: "good" },
  easy: { label: "Easy", cls: "bg-[#00C853] text-black", key: "easy" },
};

// Box intervals in milliseconds (Box 1: Immediate/1 day, Box 2: 3 days, Box 3: 7 days, Box 4: 14 days, Box 5: 30 days)
const LEITNER_INTERVALS = {
  1: 1 * 24 * 60 * 60 * 1000,
  2: 3 * 24 * 60 * 60 * 1000,
  3: 7 * 24 * 60 * 60 * 1000,
  4: 14 * 24 * 60 * 60 * 1000,
  5: 30 * 24 * 60 * 60 * 1000,
};

const LEITNER_STORAGE_KEY = "genai_leitner_box_state";

export const Flashcards = ({ rate, getRating, ratings }) => {
  const [mode, setMode] = useState("drill"); // "drill" | "leitner"
  const [weakOnly, setWeakOnly] = useState(false);
  const [order, setOrder] = useState(FLASHCARDS);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Leitner state: { [cardId]: { box: 1..5, lastReviewed: timestamp, nextDue: timestamp } }
  const [leitnerData, setLeitnerData] = useState(() => {
    try {
      const saved = localStorage.getItem(LEITNER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LEITNER_STORAGE_KEY, JSON.stringify(leitnerData));
    } catch (e) {
      console.error(e);
    }
  }, [leitnerData]);

  const now = Date.now();

  // Box statistics
  const boxCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    FLASHCARDS.forEach((c) => {
      const k = cardKey(c);
      const box = (leitnerData[k] && leitnerData[k].box) || 1;
      counts[box] = (counts[box] || 0) + 1;
    });
    return counts;
  }, [leitnerData]);

  const weakCards = useMemo(
    () => FLASHCARDS.filter((c) => ratings[cardKey(c)] === "again"),
    [ratings]
  );

  // Filter deck based on mode
  const deck = useMemo(() => {
    if (mode === "leitner") {
      const due = FLASHCARDS.filter((c) => {
        const info = leitnerData[cardKey(c)];
        if (!info) return true; // never reviewed
        return info.nextDue <= now;
      });
      return due.length > 0 ? due : FLASHCARDS;
    }
    const base = weakOnly ? order.filter((c) => ratings[cardKey(c)] === "again") : order;
    return base.length ? base : order;
  }, [mode, weakOnly, order, ratings, leitnerData, now]);

  const idx = Math.min(i, Math.max(0, deck.length - 1));
  const card = deck[idx] || FLASHCARDS[0];

  const next = () => {
    setFlipped(false);
    setI((p) => (p + 1) % deck.length);
  };
  const prev = () => {
    setFlipped(false);
    setI((p) => (p - 1 + deck.length) % deck.length);
  };
  const shuffle = () => {
    setFlipped(false);
    setOrder([...order].sort(() => Math.random() - 0.5));
    setI(0);
  };

  const doRate = (val) => {
    rate(card, val);
    
    // Also update Leitner progression
    const k = cardKey(card);
    const currentBox = (leitnerData[k] && leitnerData[k].box) || 1;
    let newBox = currentBox;

    if (val === "easy" || val === "good") {
      newBox = Math.min(5, currentBox + 1);
    } else if (val === "again") {
      newBox = 1; // Demote back to Box 1 for immediate review
    }

    setLeitnerData((prev) => ({
      ...prev,
      [k]: {
        box: newBox,
        lastReviewed: Date.now(),
        nextDue: Date.now() + LEITNER_INTERVALS[newBox],
      },
    }));

    next();
  };

  const current = getRating(card);
  const currentCardBox = (leitnerData[cardKey(card)] && leitnerData[cardKey(card)].box) || 1;

  return (
    <div data-testid="flashcard-drill">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex border border-black bg-white">
          <button
            onClick={() => { setMode("drill"); setI(0); setFlipped(false); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              mode === "drill" ? "bg-[#002FA7] text-white" : "hover:bg-neutral-100"
            }`}
          >
            Standard Drill Deck
          </button>
          <button
            onClick={() => { setMode("leitner"); setI(0); setFlipped(false); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              mode === "leitner" ? "bg-[#002FA7] text-white" : "hover:bg-neutral-100"
            }`}
          >
            <Layers size={13} /> 5-Box Leitner Spaced Repetition
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {mode === "drill" && (
            <button
              data-testid="flashcard-weak-toggle"
              onClick={() => {
                setWeakOnly((w) => !w);
                setI(0);
                setFlipped(false);
              }}
              disabled={!weakOnly && weakCards.length === 0}
              className={`flex items-center gap-2 border border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40 ${
                weakOnly ? "bg-[#FF3B30] text-white" : "hover:bg-[#FAFF00]"
              }`}
            >
              <Flame size={13} /> Weak ({weakCards.length})
            </button>
          )}
          <button
            data-testid="flashcard-shuffle"
            onClick={shuffle}
            className="flex items-center gap-2 border border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-[#FAFF00] transition-colors"
          >
            <Shuffle size={13} /> Shuffle
          </button>
        </div>
      </div>

      {/* Leitner Box Status Indicator */}
      {mode === "leitner" && (
        <div className="grid grid-cols-5 gap-2 mb-6 border border-black bg-white p-3 hard-shadow">
          {[1, 2, 3, 4, 5].map((b) => (
            <div
              key={b}
              className={`p-2.5 text-center border ${
                currentCardBox === b ? "border-[#002FA7] bg-[#002FA7]/10" : "border-neutral-200 bg-[#F4F4F0]"
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-neutral-500 block">
                Box {b} ({b === 1 ? "1d" : b === 2 ? "3d" : b === 3 ? "7d" : b === 4 ? "14d" : "30d"})
              </span>
              <span className="font-display font-black text-lg block text-black">
                {boxCounts[b]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Flashcard Header Info */}
      <div className="flex items-center justify-between text-xs tracking-[0.2em] uppercase font-bold text-neutral-500 mb-3">
        <span>
          Card {idx + 1} / {deck.length} · {card.moduleCode}
        </span>
        {mode === "leitner" && (
          <span className="bg-[#111111] text-[#FAFF00] px-2 py-0.5 font-mono text-[10px]">
            Current Box: {currentCardBox}
          </span>
        )}
      </div>

      {/* Main Flashcard Card */}
      <button
        data-testid="flashcard-flip"
        onClick={() => setFlipped((f) => !f)}
        className="w-full text-left bg-white border border-black hard-shadow min-h-[260px] p-8 flex flex-col justify-center transition-transform hover:-translate-y-1"
      >
        {!flipped ? (
          <>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-400 mb-3">
              {card.moduleTitle}
            </span>
            <h3 className="font-display text-3xl sm:text-4xl font-black tracking-tighter leading-none">
              {card.front}
            </h3>
            <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#002FA7] mt-6 font-bold">
              <RotateCw size={13} /> Tap or click to reveal definition & example
            </span>
          </>
        ) : (
          <div className="animate-rise">
            <p className="text-base leading-relaxed text-neutral-800 font-medium">{card.back}</p>
            {card.example && (
              <div className="mt-4 border-l-4 border-[#002FA7] bg-[#F4F4F0] px-4 py-3">
                <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#002FA7]">Practical Production Example</span>
                <p className="text-sm text-neutral-800 mt-1 leading-relaxed">{card.example}</p>
              </div>
            )}
          </div>
        )}
      </button>

      {/* Rating row */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {Object.values(RATING_META).map((r) => (
          <button
            key={r.key}
            data-testid={`flashcard-rate-${r.key}`}
            onClick={() => doRate(r.key)}
            className={`border border-black px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
              current === r.key ? r.cls : "bg-white hover:bg-neutral-100"
            }`}
          >
            {mode === "leitner" ? (
              r.key === "again" ? "Demote (Box 1)" : r.key === "good" ? "Retain (Good)" : "Promote (Next Box)"
            ) : (
              r.label
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-4 mt-3">
        <button
          data-testid="flashcard-prev"
          onClick={prev}
          className="flex-1 flex items-center justify-center gap-2 border border-black px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> Prev
        </button>
        <button
          data-testid="flashcard-next"
          onClick={next}
          className="flex-1 flex items-center justify-center gap-2 bg-[#002FA7] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>

      {/* Weak areas summary */}
      {weakCards.length > 0 && mode === "drill" && (
        <div className="mt-8 border border-black bg-white p-5" data-testid="weak-areas">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-[#FF3B30]" />
            <span className="text-xs tracking-[0.2em] uppercase font-bold">
              Weak Areas · {weakCards.length} to review
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {weakCards.map((c) => (
              <span
                key={cardKey(c)}
                className="border border-black bg-[#F4F4F0] px-2.5 py-1 text-xs font-bold"
              >
                {c.moduleCode} · {c.front}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
