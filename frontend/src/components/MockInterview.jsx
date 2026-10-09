import React, { useState, useEffect, useMemo } from 'react';

export default function MockInterview({ qaList = [] }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [durationMode, setDurationMode] = useState(120);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [rubricScores, setRubricScores] = useState({
    architecture: false,
    tradeoffs: false,
    pitfalls: false,
    numbers: false
  });

  const questions = useMemo(() => {
    if (!qaList || qaList.length === 0) return [];
    if (selectedCategory === 'all') return qaList;
    return qaList.filter(q => (q.t && q.t.toLowerCase().includes(selectedCategory.toLowerCase())) || String(q.m) === selectedCategory);
  }, [qaList, selectedCategory]);

  const activeQuestion = questions[currentIdx] || questions[0];

  useEffect(() => {
    let interval;
    if (sessionActive && isTimerRunning && durationMode > 0 && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            setIsAnswerRevealed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive, isTimerRunning, durationMode, timeLeft]);

  const startSession = () => {
    if (questions.length === 0) return;
    setSessionActive(true);
    setCurrentIdx(0);
    setTimeLeft(durationMode);
    setIsTimerRunning(durationMode > 0);
    setIsAnswerRevealed(false);
    setRubricScores({ architecture: false, tradeoffs: false, pitfalls: false, numbers: false });
  };

  const handleNextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setTimeLeft(durationMode);
      setIsTimerRunning(durationMode > 0);
      setIsAnswerRevealed(false);
      setRubricScores({ architecture: false, tradeoffs: false, pitfalls: false, numbers: false });
    } else {
      setSessionActive(false);
    }
  };

  const toggleRubric = (key) => {
    setRubricScores(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6" id="mock-interview-simulator">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-50 text-rose-700 rounded-lg font-bold text-xs">
                ⏱️ INTERVIEW SIMULATOR
              </span>
              <span className="text-xs font-mono text-slate-500 uppercase font-bold tracking-wider">
                Timed Practice Mode
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
              Senior GenAI Technical Mock Interview Simulator
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Simulate realistic high-pressure interview conditions. Practice verbal explanations with timed countdowns, senior model answers, and a 4-point production grading rubric.
            </p>
          </div>

          {!sessionActive && (
            <button
              onClick={startSession}
              disabled={questions.length === 0}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-sm rounded-2xl shadow-sm transition-all flex items-center gap-2 shrink-0"
            >
              <span>🚀 Start Mock Interview</span>
              <span>→</span>
            </button>
          )}
        </div>

        {!sessionActive && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-[11px] font-mono font-bold text-slate-500 uppercase">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="all">All Domains ({qaList.length} Questions)</option>
                <option value="RAG">RAG &amp; Embeddings (Module 06)</option>
                <option value="Agents">AI Agents &amp; MCP (Module 07)</option>
                <option value="Transformers">Transformers &amp; Deep Learning (M03/M04)</option>
                <option value="LLMOps">LLMOps &amp; Security (Module 08)</option>
                <option value="Strategy">AI PM &amp; Strategy (Module 11)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono font-bold text-slate-500 uppercase">Timer Countdown</label>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {[60, 120, 180].map(sec => (
                  <button
                    key={sec}
                    onClick={() => setDurationMode(sec)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                      durationMode === sec
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {sessionActive && activeQuestion && (
        <div className="space-y-6">
          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 sm:p-8 text-white shadow-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase">
                  {activeQuestion.t} · MODULE {String(activeQuestion.m).padStart(2, '0')}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Question {currentIdx + 1} of {questions.length}
                </span>
              </div>

              {durationMode > 0 && (
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border font-mono font-extrabold text-sm transition-all ${
                  timeLeft <= 10
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                    : timeLeft <= 30
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-slate-900 text-emerald-400 border-slate-700'
                }`}>
                  <span>⏱️</span>
                  <span>{formatTimer(timeLeft)}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                "{activeQuestion.q}"
              </h2>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              {!isAnswerRevealed ? (
                <button
                  onClick={() => { setIsAnswerRevealed(true); setIsTimerRunning(false); }}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-sm transition-all"
                >
                  👁️ Reveal Model Answer &amp; Scoring Rubric
                </button>
              ) : (
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  ✓ Model Answer Unlocked — Grade Your Response Below
                </span>
              )}

              <button
                onClick={handleNextQuestion}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all ml-auto"
              >
                Next Question →
              </button>
            </div>
          </div>

          {isAnswerRevealed && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
                <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Senior AI Engineer Model Answer
                </span>
                <p className="text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {activeQuestion.a}
                </p>
                {activeQuestion.w && (
                  <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase">💡 Why Interviewers Ask This</span>
                    <p className="text-xs text-emerald-950 leading-relaxed">{activeQuestion.w}</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
                  Self-Evaluation Rubric
                </h3>
                <div className="space-y-2.5">
                  {[
                    { key: 'architecture', label: 'Underlying Mechanism Explained' },
                    { key: 'tradeoffs', label: 'Addressed Real Tradeoffs (Latency vs Cost)' },
                    { key: 'pitfalls', label: 'Highlighted Edge Cases / Pitfalls' },
                    { key: 'numbers', label: 'Quoted Concrete SLAs & Numbers' }
                  ].map(r => (
                    <label
                      key={r.key}
                      onClick={() => toggleRubric(r.key)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                        rubricScores[r.key] ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <input type="checkbox" checked={rubricScores[r.key]} onChange={() => {}} className="mt-0.5 rounded text-emerald-600" />
                      <span className="text-xs font-semibold">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
