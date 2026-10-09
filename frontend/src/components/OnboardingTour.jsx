import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BookOpen, Sparkles, Mic, Layers, ArrowRight, ArrowLeft, Check } from "lucide-react";

const TOUR_KEY = "genai_tour_seen_v1";

const STEPS = [
  {
    icon: Layers,
    title: "Welcome to GenAI Roadmap",
    body: "A single page to learn AI end-to-end — 766 topics across 11 modules, each with a plain-English definition, an analogy, code, and a production insight. Here's the 20-second tour.",
  },
  {
    icon: BookOpen,
    title: "Explore the Curriculum",
    body: "Open any module to reveal its sections and topics. Check off what you've learned — your progress, streak, and rank update live. Long modules show per-section progress bars.",
  },
  {
    icon: Sparkles,
    title: "Ask NEURON, your AI Tutor",
    body: "Type any AI question and get a streamed answer with a real example — or hit 'Explain with AI' on any topic for a fresh explanation on demand.",
  },
  {
    icon: Mic,
    title: "Practice with AI Mock Interviews",
    body: "Answer real interview questions and get instantly scored with strengths, gaps, and a model answer. Finish to download a shareable score card.",
  },
  {
    icon: Check,
    title: "Track everything",
    body: "Flashcards with weak-area review, per-module quizzes, an interview Q&A bank, and an analytics dashboard with your streak heatmap and focus areas. Dive in!",
  },
];

export const OnboardingTour = ({ open, onClose }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const finish = () => {
    localStorage.setItem(TOUR_KEY, "1");
    onClose();
  };

  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="rounded-none border-black bg-[#F4F4F0] p-0 max-w-md gap-0 hard-shadow-lg" data-testid="onboarding-tour">
        <div className="bg-[#111111] text-[#F4F4F0] px-6 py-8 flex flex-col items-center text-center">
          <span className="w-14 h-14 bg-[#002FA7] flex items-center justify-center mb-4">
            <Icon size={26} className="text-white" />
          </span>
          <DialogTitle className="font-display text-2xl font-black tracking-tighter">{s.title}</DialogTitle>
        </div>
        <div className="p-6 sm:p-8">
          <DialogDescription className="text-sm text-neutral-700 leading-relaxed text-center min-h-[80px]">
            {s.body}
          </DialogDescription>

          <div className="flex justify-center gap-2 my-6">
            {STEPS.map((_, k) => (
              <span
                key={k}
                className={`h-2 transition-all duration-300 ${k === step ? "w-6 bg-[#002FA7]" : "w-2 bg-neutral-300"}`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {step > 0 && (
              <button
                data-testid="tour-back"
                onClick={() => setStep((p) => p - 1)}
                className="flex items-center gap-2 border border-black px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-neutral-100 transition-colors"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            {!last ? (
              <>
                <button
                  data-testid="tour-skip"
                  onClick={finish}
                  className="flex-1 border border-black px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#FAFF00] transition-colors"
                >
                  Skip
                </button>
                <button
                  data-testid="tour-next"
                  onClick={() => setStep((p) => p + 1)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#002FA7] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
                >
                  Next <ArrowRight size={14} />
                </button>
              </>
            ) : (
              <button
                data-testid="tour-done"
                onClick={finish}
                className="flex-1 flex items-center justify-center gap-2 bg-[#111111] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#002FA7] transition-colors"
              >
                Start Learning <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const shouldShowTour = () => !localStorage.getItem(TOUR_KEY);
