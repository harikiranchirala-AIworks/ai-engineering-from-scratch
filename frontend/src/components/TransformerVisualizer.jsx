import React, { useState, useMemo } from 'react';

const PRESET_SENTENCES = [
  "The robot lifted the heavy box because it was strong",
  "The nurse helped the patient because she was caring",
  "Attention is all you need for deep contextual embeddings",
  "Developers build robust AI agents with modern tools"
];

export default function TransformerVisualizer() {
  const [activeTab, setActiveTab] = useState('attention');
  const [sentence, setSentence] = useState(PRESET_SENTENCES[0]);
  const [selectedHead, setSelectedHead] = useState(1);
  const [hoveredCell, setHoveredCell] = useState(null);

  const tokens = useMemo(() => {
    return sentence.trim().split(/\s+/).filter(Boolean);
  }, [sentence]);

  const attentionMatrix = useMemo(() => {
    const n = tokens.length;
    const mat = [];

    for (let i = 0; i < n; i++) {
      const row = [];
      let rowSum = 0;
      const rawScores = [];

      for (let j = 0; j < n; j++) {
        let score = 0.5;
        const ti = tokens[i].toLowerCase();
        const tj = tokens[j].toLowerCase();

        if (selectedHead === 1) {
          if ((ti === 'it' && (tj === 'robot' || tj === 'box')) || (ti === 'she' && tj === 'nurse')) score += 4.5;
          if ((ti === 'strong' && tj === 'robot') || (ti === 'heavy' && tj === 'box')) score += 3.8;
          if (ti === tj) score += 1.0;
        } else if (selectedHead === 2) {
          if ((ti === 'lifted' && (tj === 'robot' || tj === 'box')) || (ti === 'helped' && (tj === 'nurse' || tj === 'patient'))) score += 4.0;
          if (Math.abs(i - j) === 1) score += 2.0;
        } else {
          const dist = Math.abs(i - j);
          score = Math.max(0.1, 4.0 - dist * 0.8);
        }

        rawScores.push(score);
        rowSum += Math.exp(score);
      }

      for (let j = 0; j < n; j++) {
        row.push(Math.exp(rawScores[j]) / rowSum);
      }
      mat.push(row);
    }
    return mat;
  }, [tokens, selectedHead]);

  // LoRA State
  const [loraRank, setLoraRank] = useState(8);
  const baseDim = 4096;

  const loraMetrics = useMemo(() => {
    const baseParams = baseDim * baseDim;
    const trainableParams = 2 * baseDim * loraRank;
    const compressionPct = ((1 - (trainableParams / baseParams)) * 100).toFixed(2);

    return {
      baseParams: baseParams.toLocaleString(),
      trainableParams: trainableParams.toLocaleString(),
      compressionPct,
      loraMb: ((trainableParams * 2) / (1024 * 1024)).toFixed(2)
    };
  }, [loraRank]);

  return (
    <div className="space-y-6" id="transformer-visualizer-widget">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="p-1.5 bg-purple-50 text-purple-700 rounded-lg font-bold text-xs">
              🔬 DEEP LEARNING LAB
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
              Self-Attention Matrix &amp; LoRA Low-Rank Decomposer
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Inspect multi-head Query × Key dot-product attention heatmaps, soft-max probability weights, and low-rank parameter compression.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('attention')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold ${
                activeTab === 'attention' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              🔥 Self-Attention Heatmap
            </button>
            <button
              onClick={() => setActiveTab('lora')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold ${
                activeTab === 'lora' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              📐 LoRA Weight Decomposer
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'attention' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <span className="text-xs font-mono font-bold uppercase text-slate-800">
                Input Sentence &amp; Attention Head Selection
              </span>
              <div className="flex gap-1.5">
                {[
                  { id: 1, name: 'Head 1: Coreference' },
                  { id: 2, name: 'Head 2: Syntactic' },
                  { id: 3, name: 'Head 3: Positional' }
                ].map(h => (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHead(h.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${
                      selectedHead === h.id ? 'bg-purple-600 text-white' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-medium"
            />
          </div>

          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 text-white shadow-xl space-y-4 overflow-x-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-mono font-bold text-slate-300">
                Attention Softmax Matrix: A = softmax(Q · Kᵀ / √dₖ)
              </span>
            </div>

            <div className="inline-block min-w-full py-4 font-mono">
              <div className="flex items-center mb-2">
                <div className="w-20 text-[10px] text-slate-400 text-right pr-3">Query \ Key</div>
                {tokens.map((tok, j) => (
                  <div key={`col-${j}`} className="w-12 text-center text-[10px] text-purple-300 truncate">
                    {tok}
                  </div>
                ))}
              </div>

              {tokens.map((qTok, i) => (
                <div key={`row-${i}`} className="flex items-center mb-1">
                  <div className="w-20 text-[11px] text-right pr-3 truncate text-slate-300 font-bold">{qTok}</div>
                  {attentionMatrix[i].map((weight, j) => {
                    const isHovered = hoveredCell && hoveredCell.i === i && hoveredCell.j === j;
                    const intensity = Math.min(1, weight * 2.2);

                    return (
                      <div
                        key={`cell-${i}-${j}`}
                        onMouseEnter={() => setHoveredCell({ i, j })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`w-12 h-10 m-0.5 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                          isHovered ? 'ring-2 ring-white scale-110' : ''
                        }`}
                        style={{
                          backgroundColor: `rgba(168, 85, 247, ${Math.max(0.12, intensity)})`,
                          color: intensity > 0.4 ? '#ffffff' : '#cbd5e1'
                        }}
                      >
                        {(weight * 100).toFixed(0)}%
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lora' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-800 tracking-wider border-b border-slate-100 pb-3">
              LoRA Parameter Compression Sandbox: W = W₀ + (α / r) · (B · A)
            </h3>

            <div className="space-y-2 max-w-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">LoRA Rank (r)</span>
                <span className="font-mono font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  r = {loraRank}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="64"
                step="1"
                value={loraRank}
                onChange={(e) => setLoraRank(parseInt(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 text-white shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-mono font-bold text-purple-400 uppercase">
                Low-Rank Decomposition Matrix Geometry
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                ⚡ {loraMetrics.compressionPct}% Parameter Reduction
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 py-6 font-mono text-center">
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2 min-w-[150px]">
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">FROZEN ❄️</span>
                <div className="text-base font-extrabold text-white">W₀</div>
                <div className="text-xs text-purple-300">[{baseDim} × {baseDim}]</div>
                <div className="text-[11px] text-slate-400">{loraMetrics.baseParams} Params</div>
              </div>

              <div className="text-2xl font-black text-slate-600">+</div>

              <div className="p-4 bg-purple-950/40 rounded-2xl border border-purple-500/40 space-y-2 min-w-[150px]">
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">TRAINABLE 🔥</span>
                <div className="text-base font-extrabold text-white">B · A</div>
                <div className="text-xs text-purple-300">[{baseDim} × {loraRank}] × [{loraRank} × {baseDim}]</div>
                <div className="text-[11px] text-slate-400">{loraMetrics.trainableParams} Params</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
