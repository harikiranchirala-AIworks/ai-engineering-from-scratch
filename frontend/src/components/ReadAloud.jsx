import { useState, useRef } from "react";
import { Volume2, Loader2, Square } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Speaker button that streams ElevenLabs TTS for the given text and plays it.
export const ReadAloud = ({ text, label = "Listen", testid, className = "" }) => {
  const [state, setState] = useState("idle"); // idle | loading | playing
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setState("idle");
  };

  const play = async () => {
    if (state === "playing" || state === "loading") {
      stop();
      return;
    }
    setState("loading");
    try {
      const res = await fetch(`${API}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("tts failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = stop;
      audio.onerror = stop;
      await audio.play();
      setState("playing");
    } catch (e) {
      stop();
      toast("Couldn't play audio. Please try again.");
    }
  };

  return (
    <button
      data-testid={testid}
      onClick={play}
      title={state === "playing" ? "Stop" : "Read aloud"}
      className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
        state === "playing" ? "text-[#FF3B30]" : "text-[#002FA7] hover:text-black"
      } ${className}`}
    >
      {state === "loading" ? (
        <Loader2 size={13} className="animate-spin" />
      ) : state === "playing" ? (
        <Square size={13} className="fill-current" />
      ) : (
        <Volume2 size={13} />
      )}
      {state === "playing" ? "Stop" : label}
    </button>
  );
};
