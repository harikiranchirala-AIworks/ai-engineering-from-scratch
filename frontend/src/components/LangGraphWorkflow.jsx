import React, { useState, useEffect } from 'react';

const PATTERNS = {
  supervisor: {
    title: "Supervisor Multi-Agent Orchestration",
    tag: "ORCHESTRATION",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    description: "A centralized Coordinator Agent evaluates user intent, orchestrates specialized subagents (Web Search, Code Interpreter, Data Synthesizer), and routes intermediate observations to solve complex goals.",
    nodes: [
      { id: "start", label: "__start__", type: "system" },
      { id: "supervisor", label: "Supervisor Agent", type: "router" },
      { id: "search", label: "Web Search Tool", type: "agent" },
      { id: "coder", label: "Code Executor", type: "agent" },
      { id: "synthesizer", label: "Report Synthesizer", type: "agent" },
      { id: "end", label: "__end__", type: "system" },
    ],
    steps: [
      {
        nodeId: "start",
        title: "Goal Initialization",
        thought: "User submits query: 'Analyze NVIDIA Q3 revenue, calculate gross margin growth vs 2023, and summarize key drivers.'",
        state: {
          messages: [{ role: "user", content: "Analyze NVIDIA Q3 revenue, calculate gross margin growth vs 2023..." }],
          next_agent: "supervisor",
          iterations: 0
        }
      },
      {
        nodeId: "supervisor",
        title: "Supervisor Routing: Decision 1",
        thought: "I need raw financial figures for NVIDIA Q3 2024 and 2023. Routing task to WebSearchAgent.",
        state: {
          messages: [{ role: "supervisor", content: "Calling WebSearchAgent(query='NVIDIA Q3 2024 vs 2023 revenue gross margin')" }],
          next_agent: "search",
          iterations: 1
        }
      },
      {
        nodeId: "search",
        title: "Web Search Execution",
        thought: "Fetched SEC 10-Q filing: Q3 2024 Revenue = $35.08B (Gross Margin 74.6%); Q3 2023 Revenue = $18.12B (Gross Margin 74.0%).",
        state: {
          messages: [{ role: "tool_search", content: "Extracted: Q3 2024: $35.08B, 74.6% GM; Q3 2023: $18.12B, 74.0% GM." }],
          next_agent: "supervisor",
          data_collected: { rev_24: 35.08, rev_23: 18.12, gm_24: 74.6, gm_23: 74.0 },
          iterations: 2
        }
      },
      {
        nodeId: "supervisor",
        title: "Supervisor Routing: Decision 2",
        thought: "Raw numbers gathered. Now routing to CodeExecutor to calculate percentage revenue growth and gross profit delta in Python.",
        state: {
          messages: [{ role: "supervisor", content: "Calling CodeExecutor(calc_metrics)" }],
          next_agent: "coder",
          iterations: 3
        }
      },
      {
        nodeId: "coder",
        title: "Python Sandbox Execution",
        thought: "Executed calculation: Growth = ((35.08 - 18.12) / 18.12) * 100 = 93.6% YoY revenue growth. Gross profit = $26.17B (+95.1%).",
        state: {
          messages: [{ role: "tool_coder", content: "YoY Revenue Growth: +93.6%; GM Expansion: +60 bps; Gross Profit: $26.17B" }],
          next_agent: "supervisor",
          calculations: { yoy_growth_pct: 93.6, gm_expansion_bps: 60 },
          iterations: 4
        }
      },
      {
        nodeId: "synthesizer",
        title: "Executive Synthesis & Grounding",
        thought: "Formatting structured executive summary with exact data points and citations.",
        state: {
          messages: [{ role: "assistant", content: "NVIDIA delivered record Q3 revenue of $35.08B (+93.6% YoY), driven by Data Center compute demand. Gross margin expanded 60 bps to 74.6% ($26.17B gross profit)." }],
          next_agent: "__end__",
          status: "COMPLETE",
          iterations: 5
        }
      },
      {
        nodeId: "end",
        title: "Workflow Complete",
        thought: "All intermediate checkpoints verified. Final response delivered to user with zero hallucinations.",
        state: {
          final_output: "Delivered to user with full citation trace.",
          status: "SUCCESS"
        }
      }
    ],
    pythonCode: `from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], "add_messages"]
    next_agent: str
    data_collected: dict

def supervisor_node(state: AgentState):
    return {"next_agent": "search_agent"}

workflow = StateGraph(AgentState)
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("search_agent", search_tool_node)
workflow.add_node("code_agent", python_sandbox_node)
workflow.add_node("synthesizer", synthesis_node)

workflow.add_conditional_edges(
    "supervisor",
    lambda state: state["next_agent"],
    {"search_agent": "search_agent", "code_agent": "code_agent", "synthesizer": "synthesizer", "end": END}
)
app = workflow.compile()`
  },
  hitl: {
    title: "Human-in-the-Loop (HITL) Interrupt Gates",
    tag: "SAFETY & GOVERNANCE",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    description: "State persistence via checkpointers pauses agent execution before high-risk actions (DB migrations, fund transfers, emails), surfacing the full diff to human reviewers for approval.",
    nodes: [
      { id: "start", label: "__start__", type: "system" },
      { id: "planner", label: "Migration Planner", type: "agent" },
      { id: "sql_gen", label: "SQL Generator", type: "agent" },
      { id: "hitl_gate", label: "⏸️ Human Gate", type: "gate" },
      { id: "db_exec", label: "DB Executor", type: "agent" },
      { id: "end", label: "__end__", type: "system" }
    ],
    steps: [
      {
        nodeId: "start",
        title: "Goal: Vector Index Schema Migration",
        thought: "User requests: 'Add pgvector 1536-dim embedding column and HNSW index to production customer_knowledge table.'",
        state: { goal: "Vector index schema update", status: "STARTED" }
      },
      {
        nodeId: "planner",
        title: "Migration Plan Generation",
        thought: "Plan constructed: 1) Enable extension vector, 2) Add column embedding vector(1536), 3) Build HNSW index with m=16, ef_construction=64.",
        state: { plan_steps: 3, target_table: "customer_knowledge" }
      },
      {
        nodeId: "sql_gen",
        title: "DDL SQL Generation",
        thought: "Generated SQL: ALTER TABLE customer_knowledge ADD COLUMN IF NOT EXISTS embedding vector(1536); CREATE INDEX CONCURRENTLY idx_hnsw ON customer_knowledge USING hnsw (embedding vector_cosine_ops);",
        state: { sql: "ALTER TABLE customer_knowledge ADD COLUMN embedding vector(1536)...", risk_level: "HIGH" }
      },
      {
        nodeId: "hitl_gate",
        title: "PAUSED: Human Review Gate",
        thought: "LangGraph MemorySaver checkpointed current state. Execution is interrupted awaiting Human Reviewer confirmation.",
        state: {
          checkpoint_id: "chk_9841f3e",
          interrupt_reason: "Destructive write operation on production PostgreSQL cluster",
          sql_preview: "CREATE INDEX CONCURRENTLY idx_hnsw ON customer_knowledge USING hnsw (embedding vector_cosine_ops);",
          status: "AWAITING_HUMAN_APPROVAL"
        },
        isGate: true
      },
      {
        nodeId: "db_exec",
        title: "Execution Confirmed",
        thought: "Human approved transaction. Resumed state checkpointer and executed SQL against production replica pool with zero downtime.",
        state: { rows_affected: 0, execution_time_ms: 142, status: "SUCCESS" }
      },
      {
        nodeId: "end",
        title: "Migration Complete",
        thought: "Database vector schema upgraded and verified. Migration logged to audit table.",
        state: { status: "COMPLETED", audit_log_id: "AUD-2026-904" }
      }
    ],
    pythonCode: `from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
workflow = StateGraph(MigrationState)
workflow.add_node("planner", plan_migration)
workflow.add_node("sql_gen", generate_sql)
workflow.add_node("db_exec", execute_db_transaction)

app = workflow.compile(
    checkpointer=checkpointer,
    interrupt_before=["db_exec"]
)`
  },
  reflection: {
    title: "Reflection & Self-Correction (Actor-Critic)",
    tag: "SELF-HEALING CODE",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    description: "An Actor Generator writes code, a Critic Evaluator tests logic against edge cases and static linters, and loops back with structured critique until verification passes.",
    nodes: [
      { id: "start", label: "__start__", type: "system" },
      { id: "actor", label: "Actor (Generator)", type: "agent" },
      { id: "linter", label: "AST / Mypy Linter", type: "tool" },
      { id: "critic", label: "Critic Evaluator", type: "agent" },
      { id: "end", label: "__end__ (Deploy)", type: "system" }
    ],
    steps: [
      {
        nodeId: "start",
        title: "Task: Implement Cosine Similarity with Fallback",
        thought: "Request: 'Write a Python function to compute cosine similarity between two NumPy arrays with zero-division handling.'",
        state: { prompt: "Write cosine_similarity(a, b) with zero-division safety.", turn: 1 }
      },
      {
        nodeId: "actor",
        title: "Actor: Draft 1 (Initial Code)",
        thought: "Drafting code: def cosine_sim(a, b): return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))",
        state: { code_draft: "def cosine_sim(a, b): return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))", turn: 1 }
      },
      {
        nodeId: "linter",
        title: "Static Linter & Test Evaluation",
        thought: "Running test vectors: input a=[0, 0], b=[1, 2]. Result: ZeroDivisionError encountered! Norm of a is 0.0.",
        state: { tests_passed: false, error: "ZeroDivisionError: float division by zero on zero vector input" }
      },
      {
        nodeId: "critic",
        title: "Critic: Constructing Critique Payload",
        thought: "Generating feedback: 'Fix zero-division: check if norm_a * norm_b == 0 or add epsilon 1e-9 threshold before division.'",
        state: { critique: "Add epsilon 1e-9 check or return 0.0 when either norm is zero.", loop_count: 1 }
      },
      {
        nodeId: "actor",
        title: "Actor: Draft 2 (Self-Corrected Code)",
        thought: "Refactoring code: norm_ab = np.linalg.norm(a) * np.linalg.norm(b); if norm_ab < 1e-9: return 0.0; return float(np.dot(a, b) / norm_ab)",
        state: { code_draft: "def cosine_sim(a, b):\\n    norm_ab = np.linalg.norm(a) * np.linalg.norm(b)\\n    if norm_ab < 1e-9: return 0.0\\n    return float(np.dot(a, b) / norm_ab)", turn: 2 }
      },
      {
        nodeId: "linter",
        title: "Re-Lint & Test Suite Verification",
        thought: "Re-running all 12 edge cases including zero-vectors, NaN vectors, and dimension mismatches. 100% tests PASSED!",
        state: { tests_passed: true, coverage_pct: 100 }
      },
      {
        nodeId: "end",
        title: "Verification Complete & Deployed",
        thought: "Verified, robust implementation ready for production pipeline integration.",
        state: { status: "DEPLOYED", quality_score: "99.8%" }
      }
    ],
    pythonCode: `def should_continue(state: ReflectionState):
    if state["tests_passed"] or state["iterations"] >= 3:
        return END
    return "critic"

workflow = StateGraph(ReflectionState)
workflow.add_node("actor", actor_coder)
workflow.add_node("linter", run_tests_and_lint)
workflow.add_node("critic", critic_evaluator)

workflow.add_edge("actor", "linter")
workflow.add_conditional_edges("linter", should_continue, {"critic": "critic", END: END})
workflow.add_edge("critic", "actor")`
  }
};

export default function LangGraphWorkflow() {
  const [selectedPattern, setSelectedPattern] = useState('supervisor');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('canvas');

  const pattern = PATTERNS[selectedPattern];
  const activeStepData = pattern.steps[currentStep] || pattern.steps[0];
  const activeNodeId = activeStepData.nodeId;

  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= pattern.steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, pattern]);

  return (
    <div className="space-y-6" id="langgraph-simulator">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg font-bold text-xs">
                🤖 AGENT LAB
              </span>
              <span className="text-xs font-mono text-slate-500 uppercase font-bold tracking-wider">
                Stateful Multi-Agent Sandbox
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
              LangGraph Multi-Agent Visual Workflow Builder
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Step through real-world cyclic agent graphs with live state dictionaries, conditional edge routing, and human-in-the-loop interrupt checkpoints.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-slate-500 font-bold">Step {currentStep + 1} of {pattern.steps.length}</span>
            <button
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 rounded-xl text-xs font-mono font-bold transition-all"
            >
              ◀ Prev
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                isPlaying ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isPlaying ? '⏸ Pause' : '▶ Auto-Play'}
            </button>
            <button
              onClick={() => setCurrentStep(prev => Math.min(pattern.steps.length - 1, prev + 1))}
              disabled={currentStep === pattern.steps.length - 1}
              className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-mono font-extrabold transition-all"
            >
              Next ▶
            </button>
            <button
              onClick={() => { setCurrentStep(0); setIsPlaying(false); }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-mono font-bold"
            >
              🔄
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {Object.entries(PATTERNS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => { setSelectedPattern(key); setCurrentStep(0); setIsPlaying(false); }}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                selectedPattern === key
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-teal-500/50'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${p.badgeColor}`}>
                {p.tag}
              </span>
              <h4 className="text-xs font-bold mt-2">{p.title}</h4>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 text-white relative shadow-xl overflow-hidden min-h-[380px] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
                <span className="text-xs font-mono font-bold text-slate-300">Live StateGraph Topology</span>
              </div>
              <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded text-[11px] font-mono font-bold">
                Active Node: {activeNodeId}
              </span>
            </div>

            <div className="relative py-8 flex items-center justify-center flex-1 overflow-x-auto">
              <div className="flex items-center gap-4 sm:gap-8 min-w-[550px] justify-between w-full px-4">
                {pattern.nodes.map(node => {
                  const isActive = activeNodeId === node.id;
                  return (
                    <div
                      key={node.id}
                      className={`relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all duration-300 text-center ${
                        isActive
                          ? 'bg-teal-950 border-teal-400 ring-4 ring-teal-500/30 shadow-[0_0_25px_rgba(20,184,166,0.5)] scale-105 z-20'
                          : 'bg-slate-900/70 border-slate-800 text-slate-400'
                      }`}
                      style={{ minWidth: '90px' }}
                    >
                      <span className="text-lg">🤖</span>
                      <span className={`text-[11px] font-mono font-bold mt-1 ${isActive ? 'text-teal-300' : 'text-slate-300'}`}>
                        {node.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-4 space-y-2 z-10">
              <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">
                Step {currentStep + 1}: {activeStepData.title}
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">{activeStepData.thought}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                State &amp; Code Inspector
              </h3>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-mono font-bold">
                <button
                  onClick={() => setActiveTab('canvas')}
                  className={`px-2.5 py-1 rounded-lg ${activeTab === 'canvas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  StateDict
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-2.5 py-1 rounded-lg ${activeTab === 'code' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Python Code
                </button>
              </div>
            </div>

            {activeTab === 'canvas' ? (
              <pre className="p-3.5 bg-slate-950 text-teal-300 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-[300px] border border-slate-800">
                {JSON.stringify(activeStepData.state, null, 2)}
              </pre>
            ) : (
              <pre className="p-3.5 bg-slate-950 text-slate-200 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-[300px] border border-slate-800">
                {pattern.pythonCode}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
