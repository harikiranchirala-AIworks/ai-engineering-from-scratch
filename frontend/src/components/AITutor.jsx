import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { ReadAloud } from "./ReadAloud";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SUGGESTIONS = [
  "What is self-attention?",
  "Explain RAG with an example",
  "Temperature vs top-p?",
  "What is QLoRA?",
];

export const AITutor = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const sessionRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch(`${API}/tutor/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, session_id: sessionRef.current }),
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
          if (data.type === "session") sessionRef.current = data.session_id;
          else if (data.type === "delta") {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = {
                role: "assistant",
                content: copy[copy.length - 1].content + data.content,
              };
              return copy;
            });
          } else if (data.type === "error") {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", content: "⚠ " + data.content };
              return copy;
            });
          }
        }
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "⚠ Connection error. Try again." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div
      data-testid="ai-tutor-console"
      className="bg-[#111111] text-[#F4F4F0] border border-black hard-shadow-blue flex flex-col h-[520px]"
    >
      <div className="flex items-center gap-2 border-b border-neutral-700 px-4 py-3">
        <Sparkles size={16} className="text-[#FAFF00]" />
        <span className="text-xs tracking-[0.2em] uppercase font-bold">NEURON · Live AI Tutor</span>
        <span className="ml-auto flex gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#FF3B30]" />
          <span className="w-2.5 h-2.5 bg-[#FAFF00]" />
          <span className="w-2.5 h-2.5 bg-[#00C853]" />
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scroll px-4 py-4 space-y-4 text-sm">
        {messages.length === 0 && (
          <div className="text-neutral-400 space-y-4">
            <p className="leading-relaxed">
              <span className="text-[#FAFF00]">$</span> Ask me anything about AI, ML, transformers,
              RAG, agents, or LLMOps. I answer with a definition, a real example, and code.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  data-testid={`tutor-suggestion-${s.slice(0, 8)}`}
                  onClick={() => send(s)}
                  className="border border-neutral-700 px-3 py-1.5 text-xs hover:border-[#FAFF00] hover:text-[#FAFF00] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} data-testid={`chat-msg-${m.role}`} className="leading-relaxed">
            <span
              className={`text-xs tracking-widest uppercase font-bold ${
                m.role === "user" ? "text-[#FAFF00]" : "text-[#4d7cff]"
              }`}
            >
              {m.role === "user" ? "> you" : "> neuron"}
            </span>
            <p
              className={`mt-1 whitespace-pre-wrap ${
                streaming && i === messages.length - 1 && m.role === "assistant" && !m.content
                  ? "blink-cursor"
                  : ""
              } ${m.role === "assistant" ? "text-neutral-200" : "text-white"}`}
            >
              {m.content}
            </p>
            {m.role === "assistant" && m.content && !(streaming && i === messages.length - 1) && (
              <div className="mt-1.5">
                <ReadAloud testid={`chat-listen-${i}`} text={m.content} label="Listen" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-neutral-700 px-4 py-3 flex items-center gap-3">
        <span className="text-[#FAFF00]">$</span>
        <input
          data-testid="ai-tutor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="type a question..."
          className="bg-transparent flex-1 py-1 outline-none placeholder:text-neutral-600"
        />
        <button
          data-testid="ai-tutor-send"
          onClick={() => send()}
          disabled={streaming}
          className="text-[#FAFF00] disabled:opacity-40 hover:scale-110 transition-transform"
        >
          {streaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};
