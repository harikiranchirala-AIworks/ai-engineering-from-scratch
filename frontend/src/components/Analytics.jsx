import { useMemo } from "react";
import { BarChart3, Flame, Target, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { MODULES, moduleTopicKeys, moduleTopicCount } from "../data/curriculum";

const dateStr = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const heatColor = (c) => (c >= 4 ? "#002FA7" : c === 3 ? "#3a63c9" : c === 2 ? "#6f90dd" : c === 1 ? "#aec2ee" : "#e2e2de");

const Panel = ({ title, icon: Icon, children, testid }) => (
  <div className="border border-black bg-white hard-shadow p-5 sm:p-6" data-testid={testid}>
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-[#002FA7]" />
      <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">{title}</span>
    </div>
    {children}
  </div>
);

export const Analytics = ({ countDone, activity = {}, interviewHistory = [], ratings = {} }) => {
  const moduleStats = useMemo(
    () => MODULES.map((m) => ({
      code: m.code,
      pct: Math.round((countDone(moduleTopicKeys(m)) / moduleTopicCount(m)) * 100),
    })),
    [countDone]
  );

  const weakData = useMemo(() => {
    const byMod = {};
    Object.entries(ratings || {}).forEach(([k, v]) => {
      if (v === "again") {
        const code = k.split("::")[0];
        byMod[code] = (byMod[code] || 0) + 1;
      }
    });
    return MODULES.map((m) => ({ code: m.code, weak: byMod[m.code] || 0 })).filter((d) => d.weak > 0);
  }, [ratings]);

  const weeks = useMemo(() => {
    const cells = [];
    const today = new Date();
    for (let w = 11; w >= 0; w--) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(today);
        dt.setDate(today.getDate() - (w * 7 + (6 - d)));
        col.push({ date: dateStr(dt), count: activity[dateStr(dt)] || 0 });
      }
      cells.push(col);
    }
    return cells;
  }, [activity]);

  const totalActiveDays = Object.values(activity).filter((c) => c > 0).length;

  const lineData = useMemo(
    () => interviewHistory.map((h, i) => ({ name: `#${i + 1}`, score: h.avg })),
    [interviewHistory]
  );

  return (
    <div data-testid="analytics">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 size={18} className="text-[#002FA7]" />
        <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">Your Analytics</span>
      </div>
      <h2 className="font-display text-3xl sm:text-5xl font-black tracking-tighter mb-8">Progress Dashboard</h2>

      {/* Heatmap */}
      <Panel title={`Study Heatmap · ${totalActiveDays} active days`} icon={Flame} testid="heatmap-panel">
        <div className="flex gap-1 overflow-x-auto custom-scroll pb-2" data-testid="study-heatmap">
          {weeks.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              {col.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} action${cell.count === 1 ? "" : "s"}`}
                  className="w-3.5 h-3.5 border border-neutral-300"
                  style={{ backgroundColor: heatColor(cell.count) }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-neutral-500">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((c) => (
            <span key={c} className="w-3 h-3 border border-neutral-300" style={{ backgroundColor: heatColor(c) }} />
          ))}
          <span>More</span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Mastery by module */}
        <Panel title="Mastery by Module" icon={Target} testid="mastery-panel">
          {moduleStats.some((d) => d.pct > 0) ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={moduleStats} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="code" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} interval={0} angle={-90} textAnchor="end" height={44} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
              <Tooltip contentStyle={{ border: "1px solid #111", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 12 }} formatter={(v) => [`${v}%`, "Mastery"]} />
              <Bar dataKey="pct">
                {moduleStats.map((d, i) => (
                  <Cell key={i} fill={d.pct === 100 ? "#00C853" : "#002FA7"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex flex-col items-center justify-center text-center text-sm text-neutral-500">
              <Target size={28} className="text-neutral-300 mb-2" />
              Check off topics in the curriculum to fill your mastery bars.
            </div>
          )}
        </Panel>

        {/* Weakest areas */}
        <Panel title="Focus Areas · Weak Flashcards" icon={Target} testid="weak-panel">
          {weakData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weakData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                <YAxis type="category" dataKey="code" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={40} />
                <Tooltip contentStyle={{ border: "1px solid #111", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 12 }} formatter={(v) => [v, "Weak cards"]} />
                <Bar dataKey="weak" fill="#FF3B30" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex flex-col items-center justify-center text-center text-sm text-neutral-500">
              <Target size={28} className="text-neutral-300 mb-2" />
              Rate flashcards "Again" to see your weak areas surface here.
            </div>
          )}
        </Panel>
      </div>

      {/* Interview scores */}
      <div className="mt-6">
        <Panel title="AI Mock Interview Scores" icon={TrendingUp} testid="interview-trend-panel">
          {lineData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={lineData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e2de" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                <Tooltip contentStyle={{ border: "1px solid #111", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 12 }} formatter={(v) => [`${v}/100`, "Score"]} />
                <Line type="monotone" dataKey="score" stroke="#002FA7" strokeWidth={3} dot={{ fill: "#002FA7", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex flex-col items-center justify-center text-center text-sm text-neutral-500">
              <TrendingUp size={28} className="text-neutral-300 mb-2" />
              Take an AI Mock Interview and your scores will trend here.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
