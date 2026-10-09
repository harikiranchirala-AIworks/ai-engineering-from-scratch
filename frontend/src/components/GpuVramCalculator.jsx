import React, { useState, useMemo } from 'react';

const MODEL_PRESETS = [
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B (Meta)', params: 8.03, layers: 32, hiddenDim: 4096, kvHeads: 8, headDim: 128 },
  { id: 'mistral-7b', name: 'Mistral 7B v0.3', params: 7.24, layers: 32, hiddenDim: 4096, kvHeads: 8, headDim: 128 },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B (Meta)', params: 70.6, layers: 80, hiddenDim: 8192, kvHeads: 8, headDim: 128 },
  { id: 'qwen-2.5-72b', name: 'Qwen 2.5 72B (Alibaba)', params: 72.7, layers: 80, hiddenDim: 8192, kvHeads: 8, headDim: 128 },
  { id: 'deepseek-v3', name: 'DeepSeek V3 (671B MoE)', params: 671.0, layers: 61, hiddenDim: 7168, kvHeads: 1, headDim: 128 },
  { id: 'llama-3.1-405b', name: 'Llama 3.1 405B (Flagship)', params: 405.0, layers: 126, hiddenDim: 16384, kvHeads: 8, headDim: 128 }
];

const PRECISION_FORMATS = [
  { id: 'fp16', name: 'FP16 / BF16 (16-bit)', bytesPerParam: 2.0, kvBytes: 2.0, tag: 'Full Precision' },
  { id: 'fp8', name: 'FP8 (8-bit Hopper/Ada)', bytesPerParam: 1.0, kvBytes: 1.0, tag: 'Modern FP8' },
  { id: 'int8', name: 'INT8 (8-bit Quant)', bytesPerParam: 1.0, kvBytes: 1.0, tag: 'BitsAndBytes' },
  { id: 'int4', name: 'INT4 AWQ / GPTQ (4-bit)', bytesPerParam: 0.55, kvBytes: 1.0, tag: 'High Speed AWQ' },
  { id: 'gguf_q4', name: 'GGUF Q4_K_M (4.5-bit)', bytesPerParam: 0.58, kvBytes: 1.0, tag: 'Ollama / GGUF' }
];

const GPU_SPECS = [
  { name: '1× NVIDIA RTX 4090', vram: 24, costPerHour: 0.45, monthlyCost: 324 },
  { name: '2× NVIDIA RTX 4090', vram: 48, costPerHour: 0.90, monthlyCost: 648 },
  { name: '1× NVIDIA A100 80GB SXM', vram: 80, costPerHour: 2.20, monthlyCost: 1584 },
  { name: '2× NVIDIA A100 80GB', vram: 160, costPerHour: 4.40, monthlyCost: 3168 },
  { name: '4× NVIDIA A100 80GB', vram: 320, costPerHour: 8.80, monthlyCost: 6336 },
  { name: '8× NVIDIA H100 80GB SXM5', vram: 640, costPerHour: 24.00, monthlyCost: 17280 }
];

export default function GpuVramCalculator() {
  const [selectedModelId, setSelectedModelId] = useState('llama-3.1-8b');
  const [selectedPrecision, setSelectedPrecision] = useState('fp16');
  const [contextLength, setContextLength] = useState(8192);
  const [concurrency, setConcurrency] = useState(4);
  const [workloadMode, setWorkloadMode] = useState('inference');

  const model = useMemo(() => {
    return MODEL_PRESETS.find(m => m.id === selectedModelId) || MODEL_PRESETS[0];
  }, [selectedModelId]);

  const precision = useMemo(() => {
    return PRECISION_FORMATS.find(p => p.id === selectedPrecision) || PRECISION_FORMATS[0];
  }, [selectedPrecision]);

  const metrics = useMemo(() => {
    const weightGb = model.params * precision.bytesPerParam * 1.05;
    const kvPerTokenPerSeqBytes = 2 * model.layers * model.kvHeads * model.headDim * precision.kvBytes;
    const totalKvBytes = kvPerTokenPerSeqBytes * contextLength * concurrency;
    const kvCacheGb = totalKvBytes / (1024 * 1024 * 1024);

    let activationOverheadGb = 1.5;
    let trainingStateGb = 0;

    if (workloadMode === 'lora') {
      trainingStateGb = (model.params * 0.05) + 3.0;
      activationOverheadGb = 2.5 + (contextLength / 4096) * 0.8;
    } else if (workloadMode === 'full_sft') {
      trainingStateGb = model.params * 14.0;
      activationOverheadGb = 4.0 + (contextLength / 2048) * 1.5;
    }

    const totalVramGb = weightGb + (workloadMode === 'inference' ? kvCacheGb : 0) + trainingStateGb + activationOverheadGb;

    return {
      weightGb: weightGb.toFixed(2),
      kvCacheGb: kvCacheGb.toFixed(2),
      trainingStateGb: trainingStateGb.toFixed(2),
      activationOverheadGb: activationOverheadGb.toFixed(2),
      totalVramGb: totalVramGb.toFixed(2),
      rawTotal: totalVramGb
    };
  }, [model, precision, contextLength, concurrency, workloadMode]);

  return (
    <div className="space-y-6" id="gpu-vram-calculator-widget">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div>
          <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-xs">
            🧮 SYSTEM DESIGN CALCULATOR
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
            Interactive GPU VRAM &amp; Hardware Cost Sizing Engine
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Configure model parameters, precision formats, context windows, and concurrent batch sizes to compute exact memory footprint and hardware recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {[
            { id: 'inference', name: 'Inference Serving (vLLM)', desc: 'Model Weights + Dynamic KV-Cache' },
            { id: 'lora', name: 'LoRA Fine-Tuning (Rank 16)', desc: 'Base Weights + LoRA Gradients/Optimizer' },
            { id: 'full_sft', name: 'Full Parameter Fine-Tuning', desc: '16-bit Master AdamW (16-20x Weight Size)' }
          ].map(w => (
            <button
              key={w.id}
              onClick={() => setWorkloadMode(w.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                workloadMode === w.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-500/50'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <div className="text-xs font-bold font-mono">{w.name}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">{w.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">Model Architecture</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MODEL_PRESETS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModelId(m.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border text-left ${
                      selectedModelId === m.id ? 'bg-slate-900 text-white font-bold' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">Precision / Quantization</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRECISION_FORMATS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPrecision(p.id)}
                    className={`p-2.5 rounded-xl text-xs border text-left ${
                      selectedPrecision === p.id ? 'bg-slate-900 text-white font-bold' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="font-bold">{p.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Context Length</span>
                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {(contextLength / 1024).toFixed(0)}K Tokens
                  </span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max="131072"
                  step="1024"
                  value={contextLength}
                  onChange={(e) => setContextLength(parseInt(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Concurrent Concurrency</span>
                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {concurrency} Active Streams
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="64"
                  step="1"
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 text-white space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase">Memory Allocation</span>
              <span className="text-xs font-mono text-slate-400">
                Total Required: <strong className="text-emerald-400 text-sm">{metrics.totalVramGb} GB</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-emerald-400 font-bold">Weights</div>
                <div className="text-lg font-extrabold text-white mt-1">{metrics.weightGb} GB</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-teal-400 font-bold">KV-Cache</div>
                <div className="text-lg font-extrabold text-white mt-1">{metrics.kvCacheGb} GB</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-amber-400 font-bold">Overhead</div>
                <div className="text-lg font-extrabold text-white mt-1">{metrics.activationOverheadGb} GB</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
              🖥️ Hardware Cluster Matcher
            </h3>
            <div className="space-y-2.5">
              {GPU_SPECS.map(gpu => {
                const canFit = gpu.vram >= metrics.rawTotal;
                return (
                  <div
                    key={gpu.name}
                    className={`p-3.5 rounded-2xl border ${
                      canFit ? 'bg-emerald-50/60 border-emerald-300' : 'bg-rose-50/40 border-rose-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{gpu.name}</span>
                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${
                        canFit ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'
                      }`}>
                        {canFit ? '✅ FITS' : '❌ OOM'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mt-2">
                      <span>Total Pool: {gpu.vram} GB</span>
                      <span>${gpu.costPerHour.toFixed(2)}/hr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
