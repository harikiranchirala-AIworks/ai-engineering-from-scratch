import { useState, useMemo } from "react";
import { Search, Database, Layers, ArrowRight, CheckCircle2, Sliders, Cpu, Sparkles, FileText, BookOpen } from "lucide-react";

const SAMPLE_QUERIES = [
  {
    query: "How does Rotary Position Embedding (RoPE) scale LLM context?",
    module: "M04 · NLP & Transformers",
    documents: [
      { id: 1, title: "Doc A: RoPE Architecture", text: "RoPE applies a rotation matrix to Query and Key representations in 2D chunks, preserving relative token distances instead of absolute coordinates. This allows seamless context extension.", denseScore: 0.94, bm25Score: 0.88 },
      { id: 2, title: "Doc B: Attention Complexity", text: "Self-attention has O(N^2) memory complexity relative to sequence length N. FlashAttention mitigates this with GPU SRAM tiling.", denseScore: 0.72, bm25Score: 0.35 },
      { id: 3, title: "Doc C: Positional Encodings", text: "Sinusoidal encodings add fixed frequencies to token vectors. RoPE multiplies representations by complex rotational angles.", denseScore: 0.89, bm25Score: 0.79 },
      { id: 4, title: "Doc D: LoRA Adapters", text: "Low-Rank Adaptation freezes base model weights and trains rank-decomposition matrices A and B in parallel.", denseScore: 0.31, bm25Score: 0.12 },
    ],
    idealAnswer: "Rotary Position Embedding (RoPE) encodes sequence positions by multiplying Query and Key representations with rotational matrices in 2D subspaces. Because inner products depend strictly on relative angular displacement, RoPE naturally generalizes to long context windows while preserving semantic relationships [Doc A, Doc C]."
  },
  {
    query: "What causes Catastrophic Forgetting and how does LoRA prevent it?",
    module: "M03 · Deep Learning & PEFT",
    documents: [
      { id: 1, title: "Doc A: Parameter-Efficient Fine-Tuning", text: "LoRA freezes all pre-trained base model weights and introduces low-rank trainable adapter matrices (rank r << d). Base knowledge remains untouched.", denseScore: 0.96, bm25Score: 0.91 },
      { id: 2, title: "Doc B: Full Fine-Tuning Risks", text: "When updating all model weights on a narrow domain dataset, gradient updates overwrite previously learned neural pathways, causing catastrophic forgetting.", denseScore: 0.92, bm25Score: 0.84 },
      { id: 3, title: "Doc C: Quantization Formats", text: "AWQ and GPTQ compress 16-bit float weights into 4-bit integers with minimal perplexity degradation.", denseScore: 0.28, bm25Score: 0.15 },
      { id: 4, title: "Doc D: Rehearsal & EWC", text: "Elastic Weight Consolidation adds a penalty for changing important weights to mitigate forgetting in sequential learning.", denseScore: 0.81, bm25Score: 0.65 },
    ],
    idealAnswer: "Catastrophic forgetting occurs during full fine-tuning when backpropagation overwrites base model weights needed for prior general capabilities [Doc B]. LoRA completely prevents this by freezing the original weights and learning task-specific adaptations in low-rank adapter matrices [Doc A]."
  },
  {
    query: "How does LangGraph maintain cyclic state across agent tools?",
    module: "M07 · Agents & MCP",
    documents: [
      { id: 1, title: "Doc A: StateGraph Architecture", text: "LangGraph defines workflows as directed graphs where Nodes are Python functions and Edges control execution flow via shared State schemas.", denseScore: 0.95, bm25Score: 0.90 },
      { id: 2, title: "Doc B: Memory & Checkpointing", text: "LangGraph checkpointers persist State snapshots after every node turn, enabling cyclic tool loops, human-in-the-loop approvals, and time-travel debugging.", denseScore: 0.91, bm25Score: 0.82 },
      { id: 3, title: "Doc C: Model Context Protocol", text: "MCP standardizes client-server tool discovery via JSON-RPC, decoupling LLM clients from tool backend code.", denseScore: 0.64, bm25Score: 0.40 },
      { id: 4, title: "Doc D: ReAct Loop", text: "The ReAct paradigm alternates Thought, Action, and Observation cycles until a termination condition is met.", denseScore: 0.78, bm25Score: 0.58 },
    ],
    idealAnswer: "LangGraph coordinates stateful agent cycles by passing a centralized TypedDict/Pydantic State object through graph Nodes [Doc A]. After each tool execution, state checkpointers persist intermediate memory snapshots, enabling resilient cyclic loops and human oversight [Doc B]."
  }
];

export const RAGPlayground = () => {
  const [selectedSampleIdx, setSelectedSampleIdx] = useState(0);
  const [activeStep, setActiveStep] = useState(1);
  const [denseWeight, setDenseWeight] = useState(0.65);
  const [topK, setTopK] = useState(2);
  const [chunkStrategy, setChunkStrategy] = useState("recursive");
  const [rerankingEnabled, setRerankingEnabled] = useState(true);

  const sample = SAMPLE_QUERIES[selectedSampleIdx];

  // Calculate Hybrid & Reranked Scores
  const rankedDocs = useMemo(() => {
    return sample.documents.map((doc) => {
      const hybridScore = (doc.denseScore * denseWeight) + (doc.bm25Score * (1 - denseWeight));
      // Cross-encoder reranker bonus if enabled
      const rerankScore = rerankingEnabled 
        ? Math.min(0.99, hybridScore * 1.05 + (doc.denseScore > 0.85 ? 0.05 : 0))
        : hybridScore;
      return {
        ...doc,
        hybridScore: Number(hybridScore.toFixed(3)),
        rerankScore: Number(rerankScore.toFixed(3)),
      };
    }).sort((a, b) => b.rerankScore - a.rerankScore);
  }, [sample, denseWeight, rerankingEnabled]);

  const retrievedDocs = rankedDocs.slice(0, topK);

  return (
    <div className="border border-black bg-white hard-shadow p-6 sm:p-8" data-testid="rag-playground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#00C853] inline-block"></span>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">
              Interactive Architecture Sandbox
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-1">
            Production RAG Pipeline Simulator
          </h3>
        </div>
        
        {/* Preset Query Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Preset Query:</span>
          <select
            value={selectedSampleIdx}
            onChange={(e) => {
              setSelectedSampleIdx(Number(e.target.value));
              setActiveStep(1);
            }}
            className="border border-black bg-[#F4F4F0] px-3 py-2 text-xs font-bold focus:outline-none"
          >
            {SAMPLE_QUERIES.map((q, idx) => (
              <option key={idx} value={idx}>
                {q.module.split("·")[0]} — {q.query.slice(0, 32)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Query Bar */}
      <div className="mt-6 bg-[#111111] text-[#F4F4F0] p-4 border border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Search size={18} className="text-[#FAFF00] shrink-0" />
          <div>
            <span className="text-[10px] tracking-widest uppercase font-mono text-[#FAFF00] block">
              User Prompt · {sample.module}
            </span>
            <p className="font-display font-bold text-sm sm:text-base leading-snug">
              "{sample.query}"
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Navigation Steps */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6">
        {[
          { id: 1, label: "1. Chunking & Index", icon: Database },
          { id: 2, label: "2. Hybrid Search", icon: Sliders },
          { id: 3, label: "3. Reranking Filter", icon: Cpu },
          { id: 4, label: "4. Generation & Grounding", icon: Sparkles },
        ].map((step) => {
          const Icon = step.icon;
          const isCurrent = activeStep === step.id;
          const isPassed = activeStep > step.id;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`border border-black p-3 text-left transition-all ${
                isCurrent
                  ? "bg-[#002FA7] text-white font-bold hard-shadow"
                  : isPassed
                  ? "bg-[#F4F4F0] text-black font-bold"
                  : "bg-white text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon size={16} className={isCurrent ? "text-[#FAFF00]" : isPassed ? "text-[#00C853]" : "text-neutral-400"} />
                {isPassed && <CheckCircle2 size={13} className="text-[#00C853]" />}
              </div>
              <span className="text-xs uppercase tracking-wider block">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: CHUNKING & INDEXING */}
      {activeStep === 1 && (
        <div className="mt-6 border border-black bg-[#F4F4F0] p-6 animate-rise">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-300">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#002FA7] font-bold">Step 1: Document Chunking</span>
              <h4 className="font-display text-xl font-bold mt-1">Text Splitting & Vector Ingestion</h4>
              <p className="text-xs text-neutral-600 mt-1">Select the chunking strategy to evaluate boundary overlap and context retention.</p>
            </div>
            <div className="flex gap-2">
              {[
                { id: "fixed", label: "Fixed Size (500 chars)" },
                { id: "recursive", label: "Recursive Character (Optimal)" },
                { id: "semantic", label: "Semantic Boundary" },
              ].map((strat) => (
                <button
                  key={strat.id}
                  onClick={() => setChunkStrategy(strat.id)}
                  className={`border border-black px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    chunkStrategy === strat.id ? "bg-[#111111] text-[#FAFF00]" : "bg-white hover:bg-neutral-100"
                  }`}
                >
                  {strat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {sample.documents.map((doc) => (
              <div key={doc.id} className="border border-black bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-[#002FA7]">{doc.title}</span>
                  <span className="text-[10px] font-mono bg-neutral-100 border border-neutral-300 px-1.5 py-0.5">
                    {chunkStrategy === "fixed" ? "Chunk #1 (Fixed 512)" : chunkStrategy === "recursive" ? "Markdown Splitter" : "Sentence Boundary"}
                  </span>
                </div>
                <p className="text-xs text-neutral-700 leading-relaxed font-mono bg-[#F4F4F0] p-2.5 border border-neutral-200">
                  {doc.text}
                </p>
                <div className="mt-2 text-[10px] text-neutral-500 flex items-center justify-between">
                  <span>Tokens: ~{Math.round(doc.text.split(" ").length * 1.3)}</span>
                  <span>Embed: text-embedding-3-large (1536d)</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setActiveStep(2)}
              className="flex items-center gap-2 bg-[#002FA7] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
            >
              Proceed to Hybrid Search <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: HYBRID SEARCH */}
      {activeStep === 2 && (
        <div className="mt-6 border border-black bg-[#F4F4F0] p-6 animate-rise">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-300">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#002FA7] font-bold">Step 2: Multi-Modal Retrieval</span>
              <h4 className="font-display text-xl font-bold mt-1">Dense Vector (Cosine) vs. Sparse (BM25)</h4>
              <p className="text-xs text-neutral-600 mt-1">Tune the alpha weighting between semantic similarity and exact keyword matching.</p>
            </div>
            
            {/* Alpha Weight Slider */}
            <div className="bg-white border border-black p-3 min-w-[240px]">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Sparse BM25 ({Math.round((1 - denseWeight) * 100)}%)</span>
                <span className="text-[#002FA7]">Dense Vector ({Math.round(denseWeight * 100)}%)</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={denseWeight}
                onChange={(e) => setDenseWeight(parseFloat(e.target.value))}
                className="w-full accent-[#002FA7] cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {rankedDocs.map((doc, idx) => (
              <div key={doc.id} className="border border-black bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-[#111111] text-white flex items-center justify-center text-[10px] font-bold">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-neutral-800">{doc.title}</span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{doc.text}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-500 block uppercase">Dense: {doc.denseScore}</span>
                    <span className="text-[10px] text-neutral-500 block uppercase">BM25: {doc.bm25Score}</span>
                  </div>
                  <div className="border border-black bg-[#FAFF00] px-3 py-1 text-center min-w-[70px]">
                    <span className="text-[9px] uppercase font-bold text-neutral-600 block">Hybrid</span>
                    <span className="font-display font-black text-sm">{doc.hybridScore}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setActiveStep(1)}
              className="border border-black px-4 py-2.5 text-xs font-bold uppercase tracking-widest bg-white hover:bg-neutral-100"
            >
              Back
            </button>
            <button
              onClick={() => setActiveStep(3)}
              className="flex items-center gap-2 bg-[#002FA7] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
            >
              Proceed to Reranking <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RERANKING */}
      {activeStep === 3 && (
        <div className="mt-6 border border-black bg-[#F4F4F0] p-6 animate-rise">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-300">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#002FA7] font-bold">Step 3: Cross-Encoder Reranking</span>
              <h4 className="font-display text-xl font-bold mt-1">Cohere / BGE Reranker Pass</h4>
              <p className="text-xs text-neutral-600 mt-1">Cross-encoders score full query-document interaction to eliminate false positives before LLM context injection.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer border border-black bg-white px-3 py-2">
                <input
                  type="checkbox"
                  checked={rerankingEnabled}
                  onChange={(e) => setRerankingEnabled(e.target.checked)}
                  className="accent-[#002FA7]"
                />
                Enable Reranker
              </label>

              <div className="flex items-center gap-2 text-xs font-bold border border-black bg-white px-3 py-2">
                <span>Top-K:</span>
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="bg-transparent font-bold focus:outline-none"
                >
                  <option value={1}>1 Doc</option>
                  <option value={2}>2 Docs (Optimal)</option>
                  <option value={3}>3 Docs</option>
                  <option value={4}>4 Docs</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {rankedDocs.map((doc, idx) => {
              const isSelected = idx < topK;
              return (
                <div
                  key={doc.id}
                  className={`border p-4 transition-all ${
                    isSelected
                      ? "border-black bg-white hard-shadow"
                      : "border-neutral-300 bg-neutral-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase text-[#002FA7]">
                      {doc.title}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 border border-black ${
                      isSelected ? "bg-[#00C853] text-black" : "bg-neutral-400 text-white"
                    }`}>
                      {isSelected ? `SELECTED IN TOP-${topK}` : "FILTERED OUT"}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed mb-3">{doc.text}</p>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-200">
                    <span className="text-neutral-500 font-mono text-[10px]">Cross-Encoder Score:</span>
                    <span className="font-display font-black text-sm text-[#002FA7]">{doc.rerankScore}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setActiveStep(2)}
              className="border border-black px-4 py-2.5 text-xs font-bold uppercase tracking-widest bg-white hover:bg-neutral-100"
            >
              Back
            </button>
            <button
              onClick={() => setActiveStep(4)}
              className="flex items-center gap-2 bg-[#002FA7] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
            >
              Generate Synthesized Response <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: GENERATION */}
      {activeStep === 4 && (
        <div className="mt-6 border border-black bg-[#111111] text-[#F4F4F0] p-6 animate-rise">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-700">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#FAFF00] font-bold">Step 4: Augmented Generation</span>
              <h4 className="font-display text-xl font-bold mt-1 text-white">Grounded LLM Response & Attribution</h4>
              <p className="text-xs text-neutral-400 mt-1">Context from Top-{topK} retrieved chunks injected into system prompt.</p>
            </div>
            <span className="text-xs font-mono bg-neutral-800 text-[#00C853] px-3 py-1 border border-neutral-600">
              RAGAS Faithfulness: 0.98 / 1.00
            </span>
          </div>

          <div className="mt-6 grid lg:grid-cols-[1fr_1.2fr] gap-6">
            {/* Injected Context Box */}
            <div className="border border-neutral-700 bg-[#1c1c1c] p-4 text-xs font-mono space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#FAFF00] tracking-wider block">
                [Injected System Prompt Context]
              </span>
              {retrievedDocs.map((doc) => (
                <div key={doc.id} className="p-3 bg-neutral-900 border border-neutral-800">
                  <span className="text-[#FAFF00] font-bold block mb-1">Source: {doc.title}</span>
                  <p className="text-neutral-300 text-[11px] leading-relaxed">{doc.text}</p>
                </div>
              ))}
            </div>

            {/* Generated LLM Answer */}
            <div className="border border-neutral-700 bg-black p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-[#FAFF00]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-white">
                    Grounded AI Output
                  </span>
                </div>
                <p className="text-sm text-neutral-200 leading-relaxed font-sans">
                  {sample.idealAnswer}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-neutral-400">Cited Chunks: {retrievedDocs.map(d => d.title.split(":")[0]).join(", ")}</span>
                <span className="text-[#FAFF00] font-bold">Hallucination Risk: Minimal (&lt;1%)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={() => setActiveStep(3)}
              className="border border-neutral-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest bg-neutral-800 text-white hover:bg-neutral-700"
            >
              Back to Reranking
            </button>
            <button
              onClick={() => {
                setSelectedSampleIdx((prev) => (prev + 1) % SAMPLE_QUERIES.length);
                setActiveStep(1);
              }}
              className="flex items-center gap-2 bg-[#FAFF00] text-black px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-white transition-colors"
            >
              Try Next Preset Query →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
