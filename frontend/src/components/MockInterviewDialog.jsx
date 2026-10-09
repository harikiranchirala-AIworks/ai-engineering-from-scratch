import { useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mic, Loader2, ArrowRight, RotateCcw, Trophy, Check, AlertTriangle, ChevronDown, SkipForward, Download, Share2 } from "lucide-react";
import { QNA, MODULES } from "../data/curriculum";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

const modulesWithQna = MODULES.filter((m) => QNA.some((q) => q.moduleCode === m.code));

const scoreColor = (s) => (s >= 75 ? "#00C853" : s >= 50 ? "#002FA7" : "#FF3B30");

export const MockInterviewDialog = ({ open, onClose, onComplete }) => {
  const [phase, setPhase] = useState("setup"); // setup | question | evaluating | feedback | summary
  const [scope, setScope] = useState("all");
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [showModel, setShowModel] = useState(false);
  const [results, setResults] = useState([]);
  const sessionRef = useRef(null);

  const start = () => {
    const pool = scope === "all" ? QNA : QNA.filter((q) => q.moduleCode === scope);
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    setQuestions(picked);
    setI(0);
    setAnswer("");
    setResult(null);
    setResults([]);
    setShowModel(false);
    setPhase("question");
  };

  const submit = async (skipped = false) => {
    setPhase("evaluating");
    const q = questions[i];
    try {
      const res = await fetch(`${API}/interview/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.q,
          answer: skipped ? "" : answer,
          reference: q.a,
          session_id: sessionRef.current,
        }),
      });
      const data = await res.json();
      if (data.session_id) sessionRef.current = data.session_id;
      setResult(data);
      setResults((r) => [...r, { question: q.q, moduleCode: q.moduleCode, score: data.score }]);
      setShowModel(false);
      setPhase("feedback");
    } catch (e) {
      setResult({ score: 0, verdict: "Error", strengths: [], improvements: ["Connection error, try again."], model_answer: "" });
      setPhase("feedback");
    }
  };

  const next = () => {
    if (i + 1 >= questions.length) {
      const a = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
      onComplete?.({ date: new Date().toISOString().slice(0, 10), avg: a, scope: scopeLabel, n: results.length });
      setPhase("summary");
    } else {
      setI((p) => p + 1);
      setAnswer("");
      setResult(null);
      setPhase("question");
    }
  };

  const avg = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;

  const reset = () => { setPhase("setup"); setAnswer(""); setResult(null); setResults([]); };
  const handleClose = () => { reset(); onClose(); };

  const scopeLabel = scope === "all" ? "All Modules" : (MODULES.find((m) => m.code === scope)?.title || scope);
  const [name, setName] = useState("");

  const drawCard = async () => {
    await (document.fonts?.ready || Promise.resolve());
    const W = 1200, H = 630;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext("2d");
    const col = scoreColor(avg);

    // paper bg + noise-ish border
    c.fillStyle = "#F4F4F0"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#111111"; c.fillRect(0, 0, W, 14); c.fillRect(0, H - 14, W, 14);
    c.fillRect(0, 0, 14, H); c.fillRect(W - 14, 0, 14, H);
    // klein accent bar
    c.fillStyle = "#002FA7"; c.fillRect(60, 150, 90, 8);

    // brand
    c.fillStyle = "#002FA7"; c.fillRect(60, 60, 54, 54);
    c.fillStyle = "#fff"; c.font = "900 38px Arial"; c.textBaseline = "middle"; c.textAlign = "center";
    c.fillText("N", 87, 88);
    c.textAlign = "left"; c.fillStyle = "#111"; c.font = "800 34px 'JetBrains Mono', monospace";
    c.fillText("GENAI ROADMAP", 130, 88);
    c.fillStyle = "#555"; c.font = "700 20px 'JetBrains Mono', monospace";
    c.fillText("AI MOCK INTERVIEW · SCORE CARD", 60, 190);

    // big score
    c.fillStyle = col; c.font = "900 210px Arial"; c.textBaseline = "alphabetic";
    const scoreStr = String(avg);
    c.fillText(scoreStr, 55, 430);
    const scoreW = c.measureText(scoreStr).width;
    c.fillStyle = "#555"; c.font = "700 40px 'JetBrains Mono', monospace";
    c.fillText("/100", 55 + scoreW + 16, 430);

    // verdict + meta (right column)
    const verdict = avg >= 75 ? "STRONG HIRE" : avg >= 50 ? "SOLID" : "KEEP PRACTISING";
    c.fillStyle = "#111"; c.font = "900 46px Arial";
    c.fillText(verdict, 620, 300);
    c.fillStyle = "#555"; c.font = "600 24px 'JetBrains Mono', monospace";
    c.fillText(`Focus: ${scopeLabel}`, 620, 350);
    c.fillText(`Questions: ${results.length}`, 620, 388);
    c.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), 620, 426);
    if (name.trim()) {
      c.fillStyle = "#111"; c.font = "800 30px 'JetBrains Mono', monospace";
      c.fillText(`— ${name.trim()}`, 620, 240);
    }

    // highlighter tag
    c.fillStyle = "#FAFF00"; c.fillRect(60, 470, 470, 46);
    c.fillStyle = "#111"; c.font = "700 22px 'JetBrains Mono', monospace"; c.textBaseline = "middle";
    c.fillText("More practical, less textbook.", 78, 494);

    // credit
    c.fillStyle = "#555"; c.font = "600 18px 'JetBrains Mono', monospace"; c.textBaseline = "alphabetic";
    c.fillText("Built & maintained by HARIKIRAN AI WORKS on EMERGENT AI", 60, 585);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  };

  const downloadCard = async () => {
    const blob = await drawCard();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `genai-interview-score-${avg}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Score card downloaded! 🎉");
  };

  const shareCard = async () => {
    const blob = await drawCard();
    const file = new File([blob], `genai-interview-${avg}.png`, { type: "image/png" });
    const text = `I scored ${avg}/100 on the GenAI Roadmap AI Mock Interview (${scopeLabel})! 🎯`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "GenAI Roadmap", text });
        return;
      } catch { /* user cancelled */ }
    }
    // Desktop fallback: download the card + copy the caption
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `genai-interview-score-${avg}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    toast("Card downloaded & caption copied — share it anywhere! 🎉");
  };

  const q = questions[i];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="rounded-none border-black bg-[#F4F4F0] p-0 max-w-2xl gap-0 hard-shadow-lg max-h-[90vh] overflow-y-auto custom-scroll"
        data-testid="mock-interview-dialog"
      >
        <div className="border-b border-black bg-[#111111] text-[#F4F4F0] px-6 py-4 flex items-center gap-3">
          <Mic size={18} className="text-[#FAFF00]" />
          <div>
            <DialogTitle className="font-display text-xl font-bold tracking-tight">AI Mock Interview</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Answer like a real interview — NEURON scores you and coaches you.
            </DialogDescription>
          </div>
          {phase !== "setup" && phase !== "summary" && (
            <span className="ml-auto text-xs font-bold text-neutral-400" data-testid="interview-counter">
              Q{i + 1} / {questions.length}
            </span>
          )}
        </div>

        {/* SETUP */}
        {phase === "setup" && (
          <div className="p-6 sm:p-8" data-testid="interview-setup">
            <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#002FA7] mb-3">Focus area</p>
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                data-testid="interview-scope-all"
                onClick={() => setScope("all")}
                className={`border border-black px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${scope === "all" ? "bg-[#002FA7] text-white" : "bg-white hover:bg-[#FAFF00]"}`}
              >
                All modules
              </button>
              {modulesWithQna.map((m) => (
                <button
                  key={m.id}
                  data-testid={`interview-scope-${m.code}`}
                  onClick={() => setScope(m.code)}
                  className={`border border-black px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${scope === m.code ? "bg-[#002FA7] text-white" : "bg-white hover:bg-[#FAFF00]"}`}
                >
                  {m.code}
                </button>
              ))}
            </div>

            <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#002FA7] mb-3"># of questions</p>
            <div className="flex gap-2 mb-8">
              {[3, 5, 8].map((n) => (
                <button
                  key={n}
                  data-testid={`interview-count-${n}`}
                  onClick={() => setCount(n)}
                  className={`border border-black px-5 py-2 text-sm font-bold transition-colors ${count === n ? "bg-[#002FA7] text-white" : "bg-white hover:bg-[#FAFF00]"}`}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              data-testid="interview-start"
              onClick={start}
              className="w-full flex items-center justify-center gap-2 bg-[#111111] text-white px-6 py-4 text-sm font-bold uppercase tracking-widest hover:bg-[#002FA7] transition-colors"
            >
              <Mic size={16} /> Begin Interview
            </button>
          </div>
        )}

        {/* QUESTION */}
        {phase === "question" && q && (
          <div className="p-6 sm:p-8" data-testid="interview-question">
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-400">{q.moduleCode} · Interviewer asks</span>
            <p className="font-display text-xl sm:text-2xl font-bold tracking-tight mt-2 mb-5 leading-snug">{q.q}</p>
            <textarea
              data-testid="interview-answer-input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer as if speaking to an interviewer..."
              rows={6}
              className="w-full border border-black bg-white p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-[#002FA7] resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                data-testid="interview-skip"
                onClick={() => submit(true)}
                className="flex items-center gap-2 border border-black px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-neutral-100 transition-colors"
              >
                <SkipForward size={14} /> Skip
              </button>
              <button
                data-testid="interview-submit"
                onClick={() => submit(false)}
                disabled={!answer.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-[#002FA7] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-40"
              >
                Submit Answer <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* EVALUATING */}
        {phase === "evaluating" && (
          <div className="p-12 text-center" data-testid="interview-evaluating">
            <Loader2 size={36} className="mx-auto animate-spin text-[#002FA7]" />
            <p className="text-sm text-neutral-600 mt-4 font-bold uppercase tracking-widest">NEURON is grading your answer...</p>
          </div>
        )}

        {/* FEEDBACK */}
        {phase === "feedback" && result && (
          <div className="p-6 sm:p-8" data-testid="interview-feedback">
            <div className="flex items-center justify-between border border-black bg-white p-5 mb-5">
              <div>
                <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">Verdict</span>
                <p className="font-display text-2xl font-black tracking-tight" data-testid="interview-verdict">{result.verdict}</p>
              </div>
              <span className="font-display text-5xl font-black tracking-tighter" style={{ color: scoreColor(result.score) }} data-testid="interview-score">
                {result.score}
              </span>
            </div>

            {result.strengths?.length > 0 && (
              <div className="mb-4">
                <span className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-bold text-[#00C853] mb-2">
                  <Check size={14} /> Strengths
                </span>
                <ul className="space-y-1.5">
                  {result.strengths.map((s, k) => (
                    <li key={k} className="text-sm text-neutral-800 leading-relaxed flex gap-2"><span className="text-[#00C853]">▸</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.improvements?.length > 0 && (
              <div className="mb-4">
                <span className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-bold text-[#FF3B30] mb-2">
                  <AlertTriangle size={14} /> Improve
                </span>
                <ul className="space-y-1.5">
                  {result.improvements.map((s, k) => (
                    <li key={k} className="text-sm text-neutral-800 leading-relaxed flex gap-2"><span className="text-[#FF3B30]">▸</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.model_answer && (
              <div className="border border-black bg-white mb-5">
                <button
                  data-testid="interview-model-toggle"
                  onClick={() => setShowModel((s) => !s)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#F4F4F0] transition-colors"
                >
                  Model answer
                  <ChevronDown size={16} className={`transition-transform ${showModel ? "rotate-180" : ""}`} />
                </button>
                {showModel && (
                  <p className="px-4 pb-4 text-sm text-neutral-800 leading-relaxed border-t border-neutral-200 pt-3">{result.model_answer}</p>
                )}
              </div>
            )}

            <button
              data-testid="interview-next"
              onClick={next}
              className="w-full flex items-center justify-center gap-2 bg-[#111111] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#002FA7] transition-colors"
            >
              {i + 1 >= questions.length ? "See results" : "Next question"} <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* SUMMARY */}
        {phase === "summary" && (
          <div className="p-8 text-center" data-testid="interview-summary">
            <Trophy size={40} className="mx-auto mb-3" style={{ color: scoreColor(avg) }} />
            <p className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">Overall Score</p>
            <p className="font-display text-6xl font-black tracking-tighter my-2" style={{ color: scoreColor(avg) }}>{avg}</p>
            <p className="text-sm text-neutral-600 mb-6">
              {avg >= 75 ? "Strong hire signal! 🎯" : avg >= 50 ? "Solid — keep sharpening the weak spots." : "Good practice — review these topics and retry."}
            </p>

            <div className="border border-black bg-white divide-y divide-neutral-200 mb-6 text-left">
              {results.map((r, k) => (
                <div key={k} className="flex items-center justify-between px-4 py-3 gap-3">
                  <span className="text-sm truncate"><span className="text-xs font-bold text-neutral-400 mr-2">{r.moduleCode}</span>{r.question}</span>
                  <span className="font-display font-black shrink-0" style={{ color: scoreColor(r.score) }}>{r.score}</span>
                </div>
              ))}
            </div>

            <div className="border border-black bg-white p-4 mb-4 text-left">
              <label className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">Add your name to the score card (optional)</label>
              <input
                data-testid="interview-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Harikiran"
                className="w-full mt-2 border border-black bg-[#F4F4F0] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#002FA7]"
              />
              <div className="flex gap-3 mt-3">
                <button
                  data-testid="interview-download-card"
                  onClick={downloadCard}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#FAFF00] text-black px-4 py-3 text-xs font-bold uppercase tracking-widest border border-black hover:bg-white transition-colors"
                >
                  <Download size={14} /> Download Card
                </button>
                <button
                  data-testid="interview-share-card"
                  onClick={shareCard}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#002FA7] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
                >
                  <Share2 size={14} /> Share
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                data-testid="interview-restart"
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 border border-black px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#FAFF00] transition-colors"
              >
                <RotateCcw size={14} /> New Interview
              </button>
              <button
                data-testid="interview-done"
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
