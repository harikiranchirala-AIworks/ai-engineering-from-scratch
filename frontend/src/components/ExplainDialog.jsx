import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const ExplainDialog = ({ topic, open, onClose }) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  const run = async () => {
    if (!topic) return;
    setText("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const prompt = `Explain the AI concept "${topic.term}" in simple terms for a learner. Give a fresh, different real-world example than this one: "${topic.example}". Keep it under 150 words.`;
    try {
      const res = await fetch(`${API}/tutor/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
        signal: controller.signal,
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          let data;
          try {
            data = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (data.type === "delta") setText((t) => t + data.content);
          else if (data.type === "error") setText((t) => t + "\n⚠ " + data.content);
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") setText("⚠ Connection error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && topic) run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topic]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="rounded-none border-black bg-[#111111] text-[#F4F4F0] p-0 max-w-xl gap-0 hard-shadow-blue"
        data-testid="explain-dialog"
      >
        <div className="border-b border-neutral-700 px-6 py-4 flex items-center gap-2">
          <Sparkles size={16} className="text-[#FAFF00]" />
          <DialogTitle className="font-display text-lg font-bold tracking-tight">
            Explain: {topic?.term}
          </DialogTitle>
        </div>
        <DialogDescription className="sr-only">
          AI tutor explanation with a fresh example for {topic?.term}.
        </DialogDescription>

        <div className="p-6 min-h-[180px] font-mono text-sm leading-relaxed">
          {loading && !text && (
            <span className="flex items-center gap-2 text-neutral-400">
              <Loader2 size={15} className="animate-spin" /> NEURON is thinking...
            </span>
          )}
          <p className="whitespace-pre-wrap text-neutral-200" data-testid="explain-text">
            {text}
            {loading && text && <span className="blink-cursor" />}
          </p>
        </div>

        {!loading && (
          <div className="border-t border-neutral-700 px-6 py-3 flex justify-end">
            <button
              data-testid="explain-regenerate"
              onClick={run}
              className="flex items-center gap-2 border border-neutral-600 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:border-[#FAFF00] hover:text-[#FAFF00] transition-colors"
            >
              <RotateCcw size={13} /> New example
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
