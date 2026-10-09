import { useState, useEffect } from "react";
import { Zap, BookOpen, Terminal, RotateCcw, ArrowRight, Layers, Search, Command, Flame, Play, BarChart3, Compass } from "lucide-react";
import { MODULES, TOTAL_TOPICS, QNA, moduleTopicKeys, moduleTopicCount } from "../data/curriculum";
import { ROLES } from "../data/roles";
import { useProgress } from "../hooks/useProgress";
import { useStreak } from "../hooks/useStreak";
import { useRatings } from "../hooks/useRatings";
import { useActivity } from "../hooks/useActivity";
import { useInterviewHistory } from "../hooks/useInterviewHistory";
import { AITutor } from "../components/AITutor";
import { ModuleCard } from "../components/ModuleCard";
import { Flashcards } from "../components/Flashcards";
import { SearchPalette } from "../components/SearchPalette";
import { RoleRoadmap } from "../components/RoleRoadmap";
import { QuizDialog } from "../components/QuizDialog";
import { ExplainDialog } from "../components/ExplainDialog";
import { InterviewBank } from "../components/InterviewBank";
import { MockInterviewDialog } from "../components/MockInterviewDialog";
import { Analytics } from "../components/Analytics";
import { OnboardingTour, shouldShowTour } from "../components/OnboardingTour";
import { RAGPlayground } from "../components/RAGPlayground";
import { SmartReview } from "../components/SmartReview";
import LangGraphWorkflow from "../components/LangGraphWorkflow";
import MockInterview from "../components/MockInterview";
import NotesBookmarks from "../components/NotesBookmarks";
import GpuVramCalculator from "../components/GpuVramCalculator";
import TransformerVisualizer from "../components/TransformerVisualizer";
import { CountUp } from "../components/CountUp";
import { Reveal } from "../components/Reveal";
import { toast } from "sonner";

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

export default function Home() {
  const { toggle, isDone, countDone, reset } = useProgress();
  const { streak, best } = useStreak();
  const ratingsApi = useRatings();
  const { activity, ping } = useActivity();
  const interview = useInterviewHistory();
  const totalDone = MODULES.reduce((n, m) => n + countDone(moduleTopicKeys(m)), 0);
  const overallPct = Math.round((totalDone / TOTAL_TOPICS) * 100);

  const toggleAndLog = (key) => { toggle(key); ping(); };

  const [searchOpen, setSearchOpen] = useState(false);
  const [openSignal, setOpenSignal] = useState(null);
  const [role, setRole] = useState("all");
  const [quizModule, setQuizModule] = useState(null);
  const [explainTopic, setExplainTopic] = useState(null);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (shouldShowTour()) {
      const t = setTimeout(() => setTourOpen(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  const recommended = new Set((ROLES.find((r) => r.id === role) || ROLES[0]).modules);
  const showRec = role !== "all";

  const jumpToModule = (moduleId) => {
    setOpenSignal({ id: moduleId, n: Date.now() });
  };

  const continueStudying = () => {
    const nextModule = MODULES.find((m) => countDone(moduleTopicKeys(m)) < moduleTopicCount(m));
    if (nextModule) {
      jumpToModule(nextModule.id);
      toast(`Resuming ${nextModule.code} · ${nextModule.title}`);
    } else {
      toast("🎉 You've completed every module!");
    }
  };

  const rank =
    overallPct >= 100 ? "Production Engineer" :
    overallPct >= 66 ? "Senior Builder" :
    overallPct >= 33 ? "AI Practitioner" :
    overallPct > 0 ? "Apprentice" : "Novice Explorer";

  return (
    <div className="noise-overlay relative">
      <SearchPalette open={searchOpen} setOpen={setSearchOpen} onJump={jumpToModule} />
      <QuizDialog module={quizModule} open={!!quizModule} onClose={() => setQuizModule(null)} />
      <ExplainDialog topic={explainTopic} open={!!explainTopic} onClose={() => setExplainTopic(null)} />
      <MockInterviewDialog
        open={interviewOpen}
        onClose={() => setInterviewOpen(false)}
        onComplete={(e) => { interview.add(e); ping(); }}
      />
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />

      {/* NAV */}
      <header className="sticky top-0 z-40 bg-[#F4F4F0]/90 backdrop-blur border-b border-black">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 bg-[#002FA7] text-white flex items-center justify-center font-display font-black">
              N
            </span>
            <span className="font-display font-bold tracking-tight text-lg hidden sm:block">
              AI Prompt2Prod
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              data-testid="open-search"
              className="flex items-center gap-2 border border-black bg-white px-3 py-2 text-xs font-bold text-neutral-500 hover:bg-[#FAFF00] hover:text-black transition-colors"
            >
              <Search size={14} /> <span className="hidden sm:inline">Search</span>
              <span className="hidden sm:flex items-center gap-0.5 border border-neutral-300 px-1.5 py-0.5 text-[10px]">
                <Command size={9} /> K
              </span>
            </button>
            <nav className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest">
              <button onClick={() => scrollTo("roadmap")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden xl:block" data-testid="nav-roadmap">Roadmap</button>
              <button onClick={() => scrollTo("smart-review")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden lg:block" data-testid="nav-smart-review">Smart Review</button>
              <button onClick={() => scrollTo("curriculum")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden md:block" data-testid="nav-curriculum">Curriculum</button>
              <button onClick={() => scrollTo("gpu-vram-calculator-widget")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden xl:block">VRAM Calc</button>
              <button onClick={() => scrollTo("transformer-visualizer-widget")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden xl:block">Attention &amp; LoRA</button>
              <button onClick={() => scrollTo("langgraph-simulator")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden xl:block">LangGraph</button>
              <button onClick={() => scrollTo("mock-interview-simulator")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden xl:block">Mock Interview</button>
              <button onClick={() => scrollTo("notes-bookmarks-hub")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden xl:block">My Notes</button>
              <button onClick={() => scrollTo("rag-simulator")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden xl:block" data-testid="nav-rag">RAG Sandbox</button>
              <button onClick={() => scrollTo("analytics")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden lg:block" data-testid="nav-analytics">Analytics</button>
              <button onClick={() => scrollTo("interview")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden lg:block" data-testid="nav-interview">Interview</button>
              <button onClick={() => scrollTo("tutor")} className="px-3 py-2 hover:bg-[#FAFF00] transition-colors hidden sm:block" data-testid="nav-tutor">AI Tutor</button>
              <button onClick={() => setTourOpen(true)} className="px-2 py-2 hover:bg-[#FAFF00] transition-colors flex items-center gap-1" data-testid="nav-tour" title="Replay tour"><Compass size={14} /></button>
              <button onClick={() => scrollTo("study")} className="bg-[#002FA7] text-white px-3 py-2 hover:bg-black transition-colors" data-testid="nav-flashcards">Flashcards</button>
              <a href="/standalone.html" target="_blank" rel="noopener noreferrer" className="border border-black bg-white px-2.5 py-1.5 hover:bg-[#FAFF00] transition-colors text-[11px] font-bold uppercase hidden 2xl:inline-block" title="Open single-file standalone offline version">
                ⚡ Offline Mode
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-8 pt-14 pb-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-start">
        <div>
          <span className="inline-block border border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] mb-6">
            ⚡ AI PROMPT2PROD
          </span>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.92]">
            The Production<br />GenAI Engineer<br /><span className="text-[#002FA7]">Roadmap</span>
          </h1>
          <p className="font-display text-xl sm:text-2xl mt-6 text-neutral-500 italic">
            "The Production GenAI Engineer Blueprint"
          </p>
          <p className="text-sm sm:text-base text-neutral-600 mt-4 max-w-xl leading-relaxed">
            Eleven structured modules sequenced for real-world AI engineering — from Python & ML math
            to Transformers, QLoRA, RAG pipelines, Agents, and LLMOps deployment. Every concept comes
            with a plain-English definition and a real example.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4 max-w-lg" data-testid="hero-stats">
            {[
              { n: TOTAL_TOPICS, label: "Topics" },
              { n: QNA.length, label: "Interview Qs" },
              { n: MODULES.length, label: "Modules" },
            ].map((s) => (
              <div key={s.label} className="border border-black bg-white px-3 py-4 text-center hard-shadow">
                <CountUp end={s.n} className="font-display text-3xl sm:text-4xl font-black tracking-tighter text-[#002FA7] block" />
                <span className="text-xs tracking-[0.15em] uppercase font-bold text-neutral-500">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-4 mt-8">
            <button onClick={() => scrollTo("curriculum")} data-testid="hero-explore-btn" className="flex items-center gap-2 bg-[#002FA7] text-white px-6 py-3.5 text-sm font-bold uppercase tracking-widest hover:bg-black transition-colors">
              Explore Curriculum <ArrowRight size={16} />
            </button>
            <button onClick={continueStudying} data-testid="hero-continue-btn" className="flex items-center gap-2 border border-black px-6 py-3.5 text-sm font-bold uppercase tracking-widest hover:bg-[#FAFF00] transition-colors">
              <Play size={16} /> Continue Studying
            </button>
            <a href="/standalone.html" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-black bg-white px-5 py-3.5 text-sm font-bold uppercase tracking-widest hover:bg-[#FAFF00] transition-colors">
              ⚡ Offline Mode
            </a>
          </div>

          {/* progress strip */}
          <div className="mt-10 bg-white border border-black hard-shadow p-6">
            <div className="flex items-end justify-between mb-3">
              <div>
                <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">Current Rank</span>
                <p className="font-display text-2xl font-black tracking-tight">{rank}</p>
              </div>
              <span className="font-display text-5xl font-black tracking-tighter text-[#002FA7]" data-testid="overall-percent">{overallPct}%</span>
            </div>
            <div className="h-3 w-full bg-neutral-200 border border-black">
              <div className="h-full bg-[#002FA7] transition-all duration-500" style={{ width: `${overallPct}%` }} data-testid="overall-progress" />
            </div>
            <div className="flex justify-between items-center mt-2 text-xs font-bold text-neutral-500">
              <span>{totalDone}/{TOTAL_TOPICS} topics mastered</span>
              <button onClick={() => { reset(); toast("Progress reset."); }} data-testid="reset-progress" className="flex items-center gap-1 hover:text-[#FF3B30] transition-colors uppercase tracking-widest">
                <RotateCcw size={12} /> Reset
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-200 flex items-center gap-3" data-testid="streak-badge">
              <span className="flex items-center gap-2 bg-[#111111] text-[#FAFF00] px-3 py-2 border border-black">
                <Flame size={15} />
                <span className="font-display text-lg font-black leading-none">{streak}</span>
                <span className="text-xs uppercase tracking-widest">day{streak === 1 ? "" : "s"} streak</span>
              </span>
              <span className="text-xs text-neutral-500 uppercase tracking-widest">Best · {best}</span>
            </div>
          </div>
        </div>

        <div id="tutor" className="lg:sticky lg:top-24">
          <AITutor />
          <p className="text-xs text-neutral-500 mt-3 flex items-center gap-2">
            <Terminal size={13} /> Live tutor powered by an LLM — ask any AI concept.
          </p>
        </div>
      </section>

      {/* DASHBOARD */}
      <section id="dashboard" className="relative z-10 bg-[#111111] text-[#F4F4F0] border-y border-black py-16">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <Reveal>
            <div className="flex items-center gap-3 mb-2">
              <Layers size={18} className="text-[#FAFF00]" />
              <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#FAFF00]">Completion Dashboard</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tighter mb-10">Module Progress</h2>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-neutral-700 border border-neutral-700">
            {MODULES.map((m) => {
              const c = countDone(moduleTopicKeys(m));
              const cnt = moduleTopicCount(m);
              const pct = cnt ? Math.round((c / cnt) * 100) : 0;
              return (
                <button
                  key={m.id}
                  onClick={() => jumpToModule(m.id)}
                  data-testid={`dash-${m.id}`}
                  className="bg-[#111111] p-5 text-left hover:bg-[#1c1c1c] transition-colors"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-neutral-500">{m.code}</span>
                    <span className={`font-display text-xl font-black ${pct === 100 ? "text-[#00C853]" : "text-white"}`}>{pct}%</span>
                  </div>
                  <p className="text-sm font-bold mt-1 mb-3 leading-tight truncate">{m.title}</p>
                  <div className="h-1.5 w-full bg-neutral-800">
                    <div className={`h-full ${pct === 100 ? "bg-[#00C853]" : "bg-[#FAFF00]"} transition-all duration-300`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ROLE ROADMAP */}
      <section id="roadmap" className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-8 py-16">
        <RoleRoadmap selected={role} setSelected={setRole} />
      </section>

      {/* SMART REVIEW & WEAK AREAS */}
      <section id="smart-review" className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-8 pb-16 pt-2">
        <SmartReview
          countDone={countDone}
          ratings={ratingsApi.ratings}
          selectedRole={role}
          onJumpToModule={jumpToModule}
        />
      </section>

      {/* CURRICULUM */}
      <section id="curriculum" className="relative z-10 bg-white border-y border-black">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-16">
          <Reveal>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen size={18} className="text-[#002FA7]" />
              <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">11 Modules · {TOTAL_TOPICS} Topics</span>
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-black tracking-tighter mb-10">The Curriculum</h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {MODULES.map((m, i) => (
              <ModuleCard
                key={m.id}
                module={m}
                index={i}
                isDone={isDone}
                toggle={toggleAndLog}
                completedCount={countDone(moduleTopicKeys(m))}
                total={moduleTopicCount(m)}
                recommended={showRec && recommended.has(m.id)}
                openSignal={openSignal}
                onQuiz={setQuizModule}
                onExplain={setExplainTopic}
              />
            ))}
          </div>
        </div>
      </section>

      {/* RAG SIMULATOR SANDBOX */}
      <section id="rag-simulator" className="relative z-10 bg-[#F4F4F0] border-b border-black py-16">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <RAGPlayground />
        </div>
      </section>

      {/* STUDY / FLASHCARDS */}
      <section id="study" className="relative z-10 py-16">
        <div className="max-w-[900px] mx-auto px-5 sm:px-8">
          <Reveal>
            <div className="flex items-center gap-3 mb-2">
              <Zap size={18} className="text-[#002FA7]" />
              <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">Interview Drill Mode</span>
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-black tracking-tighter mb-3">Flashcard Drill</h2>
            <p className="text-sm text-neutral-600 mb-10 max-w-xl leading-relaxed">
              Test your recall across every module. Flip each card for the definition and a real example,
              then rate it — weak cards resurface in your review list.
            </p>
          </Reveal>
          <Flashcards rate={ratingsApi.rate} getRating={ratingsApi.getRating} ratings={ratingsApi.ratings} />
        </div>
      </section>

      {/* ANALYTICS */}
      <section id="analytics" className="relative z-10 bg-[#F4F4F0] border-y border-black py-16">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8">
          <Reveal>
            <Analytics
              countDone={countDone}
              activity={activity}
              interviewHistory={interview.history}
              ratings={ratingsApi.ratings}
            />
          </Reveal>
        </div>
      </section>

      {/* INTERVIEW BANK */}
      <section id="interview" className="relative z-10 bg-white border-y border-black py-16">
        <div className="max-w-[1000px] mx-auto px-5 sm:px-8">
          <div className="bg-[#111111] text-[#F4F4F0] border border-black hard-shadow-blue p-6 sm:p-8 mb-12 flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
            <div>
              <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#FAFF00]">New · AI-Powered</span>
              <h3 className="font-display text-2xl sm:text-3xl font-black tracking-tighter mt-1">Practice with an AI Mock Interview</h3>
              <p className="text-sm text-neutral-400 mt-2 max-w-lg leading-relaxed">
                Answer real questions out loud (or by typing). NEURON scores each answer, highlights your strengths, and coaches your gaps — just like a live interview.
              </p>
            </div>
            <button
              data-testid="open-mock-interview"
              onClick={() => setInterviewOpen(true)}
              className="shrink-0 flex items-center justify-center gap-2 bg-[#FAFF00] text-black px-6 py-4 text-sm font-bold uppercase tracking-widest hover:bg-white transition-colors"
            >
              Start Mock Interview →
            </button>
          </div>
          <InterviewBank />
        </div>
      </section>

      {/* GPU VRAM & HARDWARE CALCULATOR */}
      <section id="gpu-vram-calculator-widget" className="relative z-10 py-16 bg-white border-t border-black">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <GpuVramCalculator />
        </div>
      </section>

      {/* TRANSFORMER ATTENTION & LORA VISUALIZER */}
      <section id="transformer-visualizer-widget" className="relative z-10 py-16 bg-[#F4F4F0] border-t border-black">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <TransformerVisualizer />
        </div>
      </section>

      {/* LANGGRAPH MULTI-AGENT WORKFLOW BUILDER */}
      <section id="langgraph-simulator" className="relative z-10 py-16 bg-[#F4F4F0] border-t border-black">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <LangGraphWorkflow />
        </div>
      </section>

      {/* TIMED TECHNICAL MOCK INTERVIEW */}
      <section id="mock-interview-simulator" className="relative z-10 py-16 bg-white border-t border-black">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <MockInterview qaList={QNA} />
        </div>
      </section>

      {/* PERSONAL NOTES & BOOKMARKS */}
      <section id="notes-bookmarks-hub" className="relative z-10 py-16 bg-[#F4F4F0] border-t border-black">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <NotesBookmarks modules={MODULES} />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 bg-[#111111] text-[#F4F4F0] py-10">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 bg-[#002FA7] text-white flex items-center justify-center font-display font-black">
              ⚡
            </span>
            <span className="font-display font-black tracking-tighter text-xl">AI Prompt2Prod</span>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-neutral-400 tracking-widest uppercase">The Production GenAI Engineer Blueprint · Built by HARIKIRAN - AI WORKS</p>
            <p className="text-xs text-[#FAFF00] tracking-widest uppercase font-bold mt-2" data-testid="footer-credit">
              🐛 Found a bug or have a suggestion? Report to HARIKIRAN - AI WORKS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
