import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Check, X, RotateCcw, Trophy } from "lucide-react";
import { ALL_TOPICS } from "../data/curriculum";

const ALL_TERMS = [...new Set(ALL_TOPICS.map((t) => t.term))];
const MAX_Q = 8;

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildQuiz(module) {
  const topics = module.sections.flatMap((s) => s.topics);
  const chosen = shuffle(topics).slice(0, Math.min(MAX_Q, topics.length));
  return chosen.map((t) => {
    const distractors = shuffle(ALL_TERMS.filter((x) => x !== t.term)).slice(0, 3);
    return {
      prompt: t.definition,
      correct: t.term,
      options: shuffle([t.term, ...distractors]),
    };
  });
}

export const QuizDialog = ({ module, open, onClose }) => {
  const questions = useMemo(() => (module ? buildQuiz(module) : []), [module]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const reset = () => {
    setI(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!module) return null;
  const q = questions[i];

  const choose = (opt) => {
    if (picked !== null) return;
    setPicked(opt);
    if (opt === q.correct) setScore((s) => s + 1);
  };

  const next = () => {
    if (i + 1 >= questions.length) {
      setFinished(true);
    } else {
      setI((p) => p + 1);
      setPicked(null);
    }
  };

  const pct = Math.round((score / questions.length) * 100);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="rounded-none border-black bg-[#F4F4F0] p-0 max-w-xl gap-0 hard-shadow-lg max-h-[90vh] overflow-y-auto custom-scroll"
        data-testid="quiz-dialog"
      >
        <div className="border-b border-black bg-[#111111] text-[#F4F4F0] px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#FAFF00]">
              {module.code} Quiz
            </span>
            <DialogTitle className="font-display text-xl font-bold tracking-tight">
              {module.title}
            </DialogTitle>
          </div>
          {!finished && (
            <span className="text-xs font-bold text-neutral-400">
              {i + 1} / {questions.length}
            </span>
          )}
        </div>

        {!finished ? (
          <div className="p-6 sm:p-8">
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#002FA7]">
              Which concept matches?
            </span>
            <p className="text-base leading-relaxed mt-2 mb-6 font-medium" data-testid="quiz-prompt">
              {q.prompt}
            </p>

            <div className="space-y-3">
              {q.options.map((opt, oi) => {
                const isCorrect = opt === q.correct;
                const isPicked = opt === picked;
                let cls = "bg-white hover:bg-[#FAFF00]";
                if (picked !== null) {
                  if (isCorrect) cls = "bg-[#00C853] text-black";
                  else if (isPicked) cls = "bg-[#FF3B30] text-white";
                  else cls = "bg-white opacity-60";
                }
                return (
                  <button
                    key={opt}
                    data-testid={`quiz-option-${oi}`}
                    onClick={() => choose(opt)}
                    disabled={picked !== null}
                    className={`w-full text-left border border-black px-4 py-3 text-sm font-bold flex items-center justify-between transition-colors ${cls}`}
                  >
                    {opt}
                    {picked !== null && isCorrect && <Check size={16} />}
                    {picked !== null && isPicked && !isCorrect && <X size={16} />}
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <button
                data-testid="quiz-next"
                onClick={next}
                className="mt-6 w-full bg-[#002FA7] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
              >
                {i + 1 >= questions.length ? "See results" : "Next question"}
              </button>
            )}
          </div>
        ) : (
          <div className="p-8 text-center" data-testid="quiz-result">
            <Trophy size={40} className={`mx-auto mb-4 ${pct >= 70 ? "text-[#002FA7]" : "text-neutral-400"}`} />
            <p className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">Your Score</p>
            <p className="font-display text-6xl font-black tracking-tighter my-2">{pct}%</p>
            <p className="text-sm text-neutral-600 mb-6">
              {score} of {questions.length} correct ·{" "}
              {pct >= 70 ? "Mastered! 🎯" : "Review the module and retry."}
            </p>
            <div className="flex gap-3">
              <button
                data-testid="quiz-retry"
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 border border-black px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#FAFF00] transition-colors"
              >
                <RotateCcw size={14} /> Retry
              </button>
              <button
                data-testid="quiz-close"
                onClick={handleClose}
                className="flex-1 bg-[#111111] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#002FA7] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
