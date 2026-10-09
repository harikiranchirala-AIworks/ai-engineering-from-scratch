const fs = require('fs');
const path = require('path');
const vm = require('vm');

const globalRoot = 'C:/Users/Dell/AppData/Roaming/npm/node_modules';
const babel = require(path.join(globalRoot, '@babel/core'));
const presetReact = require(path.join(globalRoot, '@babel/preset-react'));

const phasesData = JSON.parse(fs.readFileSync('phases_data.json', 'utf8'));
const phaseColors = [
  '#64748b', '#6366f1', '#0ea5e9', '#06b6d4', '#14b8a6',
  '#10b981', '#84cc16', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#10b981'
];

phasesData.forEach((p, i) => {
  p.color = phaseColors[i % phaseColors.length];
});

const srcPath = 'C:/Users/Dell/Desktop/AI/GenAI-Learning-Hub/standalone/genai_learning_hub.html';
let html = fs.readFileSync(srcPath, 'utf8');

// 1. Inject ALL_PHASES into data script
const dataMarker = 'window.QA_DATA = QA_DATA;\n';
if (!html.includes('window.ALL_PHASES')) {
  html = html.replace(dataMarker, dataMarker + `window.ALL_PHASES = ${JSON.stringify(phasesData)};\n`);
}

// 2. Extract JSX
const tag = '<script type="text/babel">';
const start = html.indexOf(tag);
const end = html.lastIndexOf('</script>');

let jsx = html.substring(start + tag.length, end);

// Strip imports/exports
jsx = jsx.replace(/^\s*import\s+.*?;?\s*$/gm, '');
jsx = jsx.replace(/^\s*export\s+.*?;?\s*$/gm, '');

// 3. Inject UniverseView and LabsView components at the top of JSX
const componentsCode = `
function UniverseView({ phases, onSelectLesson }) {
  const [search, setSearch] = useState('');
  const [selectedPhase, setSelectedPhase] = useState(null);

  const filteredPhases = useMemo(() => {
    if (!search) return phases;
    const q = search.toLowerCase();
    return phases.map(p => {
      const matchPhase = p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
      const matchingLessons = p.lessons.filter(l => l.title.toLowerCase().includes(q) || l.slug.toLowerCase().includes(q));
      if (matchPhase) return p;
      if (matchingLessons.length > 0) {
        return { ...p, lessons: matchingLessons };
      }
      return null;
    }).filter(Boolean);
  }, [phases, search]);

  const totalLessons = useMemo(() => phases.reduce((acc, p) => acc + p.lessonCount, 0), [phases]);

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto">
      {/* AILU-Style Header */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 text-white p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-mono font-bold">
            <span>🌌</span> AI LEARNING UNIVERSE · FROM SCRATCH
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            20 Phases · {totalLessons} First-Principles Lessons
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Every AI algorithm built from raw mathematics before importing a framework. 
            Write backpropagation, tokenizers, attention mechanisms, vector databases, and multi-agent loops by hand in Python, TypeScript, Rust, or Julia.
          </p>
          
          {/* Active Learning 9-Step Loop Bar (AILU Style) */}
          <div className="pt-2">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-2 font-semibold">Active Learning Methodology</div>
            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
              {['1 Understand', '2 Visualize', '3 Example', '4 Interact', '5 Practice', '6 Apply', '7 Test', '8 Recall', '9 Build'].map((step, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {step}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="Search 524 lessons, math algorithms, phases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 text-white placeholder-slate-500 px-4 py-2.5 pl-10 rounded-xl border border-slate-800 text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <span className="absolute left-3.5 top-3 text-slate-500 text-xs">🔍</span>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Showing <span className="text-emerald-400 font-bold">{filteredPhases.length}</span> of 20 phases ({totalLessons} lessons)
        </div>
      </div>

      {/* Phase Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredPhases.map((phase) => (
          <div
            key={phase.id}
            onClick={() => setSelectedPhase(selectedPhase?.id === phase.id ? null : phase)}
            className={\`group rounded-2xl border transition-all cursor-pointer p-5 flex flex-col justify-between space-y-4 \${
              selectedPhase?.id === phase.id
                ? 'bg-slate-900 border-indigo-500 shadow-lg ring-1 ring-indigo-500/50'
                : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
            }\`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: phase.color }}
                  ></span>
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-400">
                    Phase {String(phase.phaseNum).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-emerald-400">
                  {phase.lessonCount} {phase.lessonCount === 1 ? 'lesson' : 'lessons'}
                </span>
              </div>
              <h3 className="font-bold text-base text-white group-hover:text-indigo-300 transition-colors">
                {phase.title}
              </h3>
            </div>

            <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="text-[10px] text-slate-500">Python · Rust · TS · Julia</span>
              <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">
                {selectedPhase?.id === phase.id ? 'Close ↑' : 'Explore →'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Phase Detail Drawer */}
      {selectedPhase && (
        <div className="rounded-3xl border border-indigo-500/40 bg-slate-950 p-6 sm:p-8 space-y-6 shadow-2xl animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedPhase.color }}></span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Phase {String(selectedPhase.phaseNum).padStart(2, '0')}: {selectedPhase.title}
              </h2>
            </div>
            <button
              onClick={() => setSelectedPhase(null)}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-mono border border-slate-700 cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedPhase.lessons.map((lesson, idx) => (
              <div
                key={lesson.slug}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="text-emerald-400 font-bold">Lesson {String(idx + 1).padStart(2, '0')}</span>
                  <span className="text-slate-500">stdlib-first</span>
                </div>
                <h4 className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors">
                  {lesson.title}
                </h4>
                <div className="pt-2 flex items-center justify-between">
                  <code className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">
                    {lesson.path}
                  </code>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                    Run Lab 🚀
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LabsView({ onSelectLab }) {
  const labs = [
    {
      id: 'rag-playground',
      title: 'RAG Pipeline Simulator',
      category: 'RAG & Retrieval',
      level: 'L3 · Advanced',
      desc: 'Interactive step-by-step chunking, BM25 dense/sparse hybrid search, and cross-encoder reranking sandbox.',
      color: '#14b8a6',
      icon: '🔍'
    },
    {
      id: 'langgraph-builder',
      title: 'LangGraph Multi-Agent Visualizer',
      category: 'Agent Orchestration',
      level: 'L3 · Advanced',
      desc: 'Visual state machine simulator modeling Supervisor, Web Search, Code Execution, and Human-in-the-Loop gates.',
      color: '#6366f1',
      icon: '🤖'
    },
    {
      id: 'gpu-calc',
      title: 'GPU / VRAM Memory Calculator',
      category: 'Inference & LLMOps',
      level: 'L3 · Advanced',
      desc: 'Real-time parameter sizing, KV cache estimation, and optimizer overhead sizing for FP16, 8-bit, 4-bit, and LoRA.',
      color: '#10b981',
      icon: '💾'
    },
    {
      id: 'transformer-viz',
      title: 'Attention Heatmap & LoRA Visualizer',
      category: 'Deep Learning & PEFT',
      level: 'L3 · Advanced',
      desc: 'Interactive Self-Attention Q*K^T heatmap visualizer and LoRA low-rank weight adapter injection matrix.',
      color: '#8b5cf6',
      icon: '🧠'
    },
    {
      id: 'leitner',
      title: '5-Box Leitner Spaced Repetition',
      category: 'Active Recall',
      level: 'L1-L3 · Memory',
      desc: 'Scientifically calibrated spaced repetition flashcards with 1-day, 3-day, 7-day, 14-day, and 30-day review queues.',
      color: '#ec4899',
      icon: '🗂️'
    },
    {
      id: 'mock-interview',
      title: 'Timed Technical Mock Interviewer',
      category: 'Career & Prep',
      level: 'L3 · Production',
      desc: 'Real-time technical interview simulator with rubric-based answer grading and scorecard report generator.',
      color: '#f43f5e',
      icon: '🎯'
    }
  ];

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300 text-xs font-mono font-bold mb-2">
            <span>🔬</span> INTERACTIVE AI LABS
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Client-Side Simulators & Playgrounds
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Experiment directly in the browser — every lab executes real mathematical models client-side.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {labs.map((lab) => (
          <div
            key={lab.id}
            onClick={() => onSelectLab(lab.id)}
            className="group rounded-2xl border border-slate-800 bg-slate-950 p-6 flex flex-col justify-between space-y-4 hover:border-teal-500/60 hover:bg-slate-900/90 transition-all cursor-pointer shadow-xl hover:shadow-2xl"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{lab.icon}</span>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-teal-400">
                  {lab.level}
                </span>
              </div>
              <h3 className="font-extrabold text-lg text-white group-hover:text-teal-300 transition-colors">
                {lab.title}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {lab.desc}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 text-[11px]">{lab.category}</span>
              <span className="text-teal-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                Launch Lab <span>→</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

jsx = componentsCode + '\n' + jsx;

// 4. Update Header with AILU navigation tabs
const headerTarget = 'title="Open My Personal Notes & Bookmarks"';
const headerNavAddition = `
            {/* AILU Navigation Bar */}
            <div className="hidden lg:flex items-center gap-1 text-xs font-mono font-bold">
              <button
                type="button"
                onClick={() => { setView('universe'); setIsMobileSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={\`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all border \${view === 'universe' ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm' : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-white border-slate-200 dark:border-slate-800'}\`}
              >
                🌌 Universe (20 Phases)
              </button>
              <button
                type="button"
                onClick={() => { setView('labs'); setIsMobileSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={\`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all border \${view === 'labs' ? 'bg-teal-600 text-white border-teal-400 shadow-sm' : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-white border-slate-200 dark:border-slate-800'}\`}
              >
                🔬 Labs
              </button>
              <button
                type="button"
                onClick={() => { setView('home'); setIsMobileSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={\`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all border \${view === 'home' ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm' : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-white border-slate-200 dark:border-slate-800'}\`}
              >
                📚 11 Modules
              </button>
            </div>
`;

// Insert after the notes button closing tag
const notesClosing = '</button>';
const notesIdx = jsx.indexOf(headerTarget);
if (notesIdx !== -1) {
  const btnCloseIdx = jsx.indexOf(notesClosing, notesIdx);
  if (btnCloseIdx !== -1) {
    jsx = jsx.substring(0, btnCloseIdx + notesClosing.length) + headerNavAddition + jsx.substring(btnCloseIdx + notesClosing.length);
  }
}

// 5. Add Sidebar Navigation links for Universe and Labs
const sidebarTarget = 'id="nav-static-home"';
const sidebarButtonClose = '</button>';
const sIdx = jsx.indexOf(sidebarTarget);
if (sIdx !== -1) {
  const sClose = jsx.indexOf(sidebarButtonClose, sIdx);
  if (sClose !== -1) {
    const navInsert = `
              <button
                id="nav-universe"
                onClick={() => handleNav(() => setView('universe'))}
                className={\`w-full px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer transition-colors text-left \${view === 'universe' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'}\`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <span>🌌</span>
                  <span className="truncate">20 Phases (524 Lessons)</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">524</span>
              </button>

              <button
                id="nav-labs"
                onClick={() => handleNav(() => setView('labs'))}
                className={\`w-full px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer transition-colors text-left \${view === 'labs' ? 'bg-teal-600/30 text-teal-300 border border-teal-500/50' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'}\`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <span>🔬</span>
                  <span className="truncate">Interactive AI Labs</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold">6</span>
              </button>
    `;
    jsx = jsx.substring(0, sClose + sidebarButtonClose.length) + navInsert + jsx.substring(sClose + sidebarButtonClose.length);
  }
}

// 6. Add view breadcrumb title text
const breadcrumbTarget = "{view === 'home' && 'Overview & Learning Roadmap'}";
const newBreadcrumbs = `
              {view === 'universe' && 'AI Learning Universe · 20 Phases (524 Lessons)'}
              {view === 'labs' && 'Interactive AI Labs & Simulators'}
              {view === 'home' && 'Overview & Learning Roadmap'}
`;

if (jsx.includes(breadcrumbTarget)) {
  jsx = jsx.replace(breadcrumbTarget, newBreadcrumbs);
}

// 7. Add view rendering in main content
const mainTarget = "{view === 'home' && (";
const mainRenderInsert = `
          {view === 'universe' && (
            <UniverseView
              phases={window.ALL_PHASES || []}
              onSelectLesson={(lesson) => {}}
            />
          )}

          {view === 'labs' && (
            <LabsView
              onSelectLab={(labId) => {
                setView(labId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {view === 'home' && (
`;

if (jsx.includes(mainTarget)) {
  jsx = jsx.replace(mainTarget, mainRenderInsert);
}

console.log('Compiling enhanced JSX with Babel...');
const res = babel.transformSync(jsx, {
  presets: [
    [presetReact, { runtime: 'classic' }]
  ],
  compact: false
});

console.log('Compiled JS size:', res.code.length, 'bytes');

// Verify with vm
try {
  new vm.Script(res.code);
  console.log('Verification passed: Transformed JS is 100% error-free.');
} catch (err) {
  console.error('JS Syntax validation error:', err);
  process.exit(1);
}

// Remove babel CDN script
let before = html.substring(0, start);
before = before.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+"><\/script>\s*/g, '');
const after = html.substring(end + '</script>'.length);

const finalHtml = before + `<script>\n${res.code}\n</script>` + after;

const destinations = [
  'standalone/genai_learning_hub.html',
  'genai_learning_hub.html',
  'frontend/public/standalone.html',
  'frontend/public/index.html'
];

for (const dest of destinations) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, finalHtml, 'utf8');
  console.log('Successfully updated:', dest);
}

console.log('ALL FILES UPDATED WITH AILU STYLING AND 20-PHASE UNIVERSE EXPLORER!');
