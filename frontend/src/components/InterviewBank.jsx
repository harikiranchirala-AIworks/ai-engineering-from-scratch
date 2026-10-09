import { useState, useMemo } from "react";
import { ChevronDown, MessageSquare } from "lucide-react";
import { QNA, MODULES } from "../data/curriculum";

export const InterviewBank = () => {
  const [active, setActive] = useState("all");
  const [openKey, setOpenKey] = useState(null);

  const filtered = useMemo(
    () => (active === "all" ? QNA : QNA.filter((x) => x.moduleCode === active)),
    [active]
  );

  return (
    <div data-testid="interview-bank">
      <div className="flex items-center gap-3 mb-2">
        <MessageSquare size={18} className="text-[#002FA7]" />
        <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">
          {QNA.length} Real Interview Questions
        </span>
      </div>
      <h2 className="font-display text-3xl sm:text-5xl font-black tracking-tighter mb-3">
        Interview Bank
      </h2>
      <p className="text-sm text-neutral-600 mb-8 max-w-2xl leading-relaxed">
        Battle-tested questions asked in real AI engineering interviews, with model answers. Filter
        by module and tap any question to reveal the answer.
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        <button
          data-testid="qna-filter-all"
          onClick={() => { setActive("all"); setOpenKey(null); }}
          className={`border border-black px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
            active === "all" ? "bg-[#002FA7] text-white" : "bg-white hover:bg-[#FAFF00]"
          }`}
        >
          All ({QNA.length})
        </button>
        {MODULES.map((m) => {
          const n = QNA.filter((x) => x.moduleCode === m.code).length;
          if (!n) return null;
          return (
            <button
              key={m.id}
              data-testid={`qna-filter-${m.code}`}
              onClick={() => { setActive(m.code); setOpenKey(null); }}
              className={`border border-black px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                active === m.code ? "bg-[#002FA7] text-white" : "bg-white hover:bg-[#FAFF00]"
              }`}
            >
              {m.code} ({n})
            </button>
          );
        })}
      </div>

      <div className="border border-black bg-white divide-y divide-neutral-300">
        {filtered.map((item, idx) => {
          const key = `${item.moduleCode}-${idx}`;
          const isOpen = openKey === key;
          return (
            <div key={key} data-testid={`qna-item-${key}`}>
              <button
                data-testid={`qna-toggle-${key}`}
                onClick={() => setOpenKey(isOpen ? null : key)}
                className="w-full text-left px-5 sm:px-6 py-4 flex items-start justify-between gap-4 hover:bg-[#F4F4F0] transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xs font-bold text-neutral-400 mt-0.5 shrink-0">
                    {item.moduleCode}
                  </span>
                  <span className="font-display text-base sm:text-lg font-semibold tracking-tight">
                    {item.q}
                  </span>
                </div>
                <ChevronDown
                  size={18}
                  className={`shrink-0 mt-1 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="px-5 sm:px-6 pb-5 animate-rise">
                  <div className="border-l-4 border-[#002FA7] bg-[#F4F4F0] px-4 py-3">
                    <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#002FA7]">
                      Answer
                    </span>
                    <p className="text-sm text-neutral-800 mt-1.5 leading-relaxed" data-testid={`qna-answer-${key}`}>
                      {item.a}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
