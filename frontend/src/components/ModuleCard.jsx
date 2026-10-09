import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Circle, GraduationCap, Sparkles, Lightbulb, Zap } from "lucide-react";
import { LEVEL_STYLES } from "../data/curriculum";
import { ReadAloud } from "./ReadAloud";

export const ModuleCard = ({ module, index, isDone, toggle, completedCount, total, recommended, openSignal, onQuiz, onExplain }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pct = total ? Math.round((completedCount / total) * 100) : 0;

  useEffect(() => {
    if (openSignal && openSignal.id === module.id) {
      setOpen(true);
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [openSignal, module.id]);

  return (
    <div
      ref={ref}
      data-testid={`module-card-${module.id}`}
      className={`bg-white border hard-shadow flex flex-col animate-rise ${
        recommended ? "border-[#002FA7] border-2 ring-2 ring-[#FAFF00]" : "border-black"
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="p-6 sm:p-7 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">
              {module.code}
            </span>
            {recommended && (
              <span className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 bg-[#FAFF00] text-black border border-black" data-testid={`rec-badge-${module.id}`}>
                ★ For you
              </span>
            )}
          </div>
          <span
            className={`text-xs font-bold uppercase tracking-wider px-2 py-1 border border-black ${LEVEL_STYLES[module.level] || "bg-[#EAEAEA]"}`}
          >
            {module.level}
          </span>
        </div>

        <h3 className="font-display text-2xl font-bold tracking-tight leading-none">{module.title}</h3>
        {module.tag && (
          <span className="text-xs tracking-[0.15em] uppercase font-bold text-neutral-400">{module.tag}</span>
        )}
        <p className="text-sm text-neutral-600 leading-relaxed">{module.blurb}</p>

        <div className="mt-1">
          <div className="flex justify-between text-xs font-bold mb-1.5">
            <span>{completedCount}/{total} topics</span>
            <span className={pct === 100 ? "text-[#00C853]" : "text-[#002FA7]"}>{pct}%</span>
          </div>
          <div className="h-2 w-full bg-neutral-200 border border-black" data-testid={`module-progress-${module.id}`}>
            <div
              className={`h-full ${pct === 100 ? "bg-[#00C853]" : "bg-[#002FA7]"} transition-all duration-300`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-2 flex gap-3">
          <button
            data-testid={`module-toggle-${module.id}`}
            onClick={() => setOpen((o) => !o)}
            className="flex-1 flex items-center justify-between border border-black px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-[#FAFF00] transition-colors"
          >
            {open ? "Hide topics" : `Explore ${total} topics`}
            <ChevronDown size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
          <button
            data-testid={`module-quiz-${module.id}`}
            onClick={() => onQuiz(module)}
            className="flex items-center gap-1.5 bg-[#002FA7] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
          >
            <GraduationCap size={15} /> Quiz
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-black">
          {module.sections.map((section, si) => {
            const secTotal = section.topics.length;
            const secDone = section.topics.filter((t) => isDone(t.key)).length;
            const secPct = secTotal ? Math.round((secDone / secTotal) * 100) : 0;
            return (
            <div key={si} className="border-b border-neutral-300 last:border-b-0">
              <div className="bg-[#EAEAEA] border-b border-neutral-300 px-5 sm:px-6 py-2.5" data-testid={`section-${module.id}-${si}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#002FA7]">
                    {section.heading}
                  </span>
                  <span className="text-xs font-bold text-neutral-500 shrink-0">
                    {secDone}/{secTotal}
                  </span>
                </div>
                <div className="h-1 w-full bg-neutral-300 mt-2" data-testid={`section-progress-${module.id}-${si}`}>
                  <div
                    className={`h-full ${secPct === 100 ? "bg-[#00C853]" : "bg-[#002FA7]"} transition-all duration-300`}
                    style={{ width: `${secPct}%` }}
                  />
                </div>
              </div>
              <div className="divide-y divide-neutral-200">
                {section.topics.map((t) => {
                  const dn = isDone(t.key);
                  return (
                    <div key={t.key} className="p-5 sm:p-6" data-testid={`topic-${t.key}`}>
                      <div className="flex items-start gap-3">
                        <button
                          data-testid={`topic-check-${t.key}`}
                          onClick={() => toggle(t.key)}
                          className={`mt-0.5 shrink-0 w-6 h-6 border border-black flex items-center justify-center transition-colors ${
                            dn ? "bg-[#00C853] text-black" : "bg-white text-neutral-300 hover:bg-neutral-100"
                          }`}
                          aria-label="mark complete"
                        >
                          {dn ? <Check size={15} /> : <Circle size={11} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-display text-lg font-semibold tracking-tight ${dn ? "line-through decoration-2 text-neutral-400" : ""}`}>
                            {t.term}
                          </h4>
                          <p className="text-sm text-neutral-700 mt-1.5 leading-relaxed">{t.definition}</p>

                          {t.analogy && (
                            <div className="mt-3 flex gap-2 items-start bg-[#F4F4F0] border-l-4 border-[#FAFF00] px-4 py-2.5">
                              <Lightbulb size={15} className="text-[#b8a600] mt-0.5 shrink-0" />
                              <p className="text-sm text-neutral-800 leading-relaxed">{t.analogy}</p>
                            </div>
                          )}

                          {t.code && (
                            <pre className="mt-3 bg-[#111111] text-[#F4F4F0] px-4 py-3 overflow-x-auto text-xs leading-relaxed custom-scroll border border-black">
                              <code>{t.code}</code>
                            </pre>
                          )}

                          {t.insight && (
                            <div className="mt-3 flex gap-2 items-start border-l-4 border-[#002FA7] px-4 py-2.5">
                              <Zap size={15} className="text-[#002FA7] mt-0.5 shrink-0" />
                              <p className="text-sm text-neutral-800 leading-relaxed font-medium">{t.insight}</p>
                            </div>
                          )}

                          {t.note && !t.analogy && !t.insight && (
                            <p className="mt-3 text-sm text-neutral-600 italic leading-relaxed">{t.note}</p>
                          )}

                          <button
                            data-testid={`topic-explain-${t.key}`}
                            onClick={() => onExplain({ term: t.term, definition: t.definition, example: t.example, moduleTitle: module.title })}
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#002FA7] hover:text-black transition-colors"
                          >
                            <Sparkles size={13} /> Explain with AI
                          </button>
                          <span className="mt-3 ml-4 inline-flex">
                            <ReadAloud
                              testid={`topic-listen-${t.key}`}
                              text={`${t.term}. ${t.definition}. For example: ${t.example}`}
                            />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
