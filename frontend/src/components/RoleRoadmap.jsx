import { useMemo } from "react";
import { Target, Check } from "lucide-react";
import { ROLES } from "../data/roles";
import { MODULES } from "../data/curriculum";

export const RoleRoadmap = ({ selected, setSelected }) => {
  const role = ROLES.find((r) => r.id === selected) || ROLES[0];
  const recModules = useMemo(
    () => MODULES.filter((m) => role.modules.includes(m.id)),
    [role]
  );

  return (
    <div data-testid="role-roadmap">
      <div className="flex items-center gap-3 mb-2">
        <Target size={18} className="text-[#002FA7]" />
        <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">
          Career Roadmaps · Role-Based Filter
        </span>
      </div>
      <h2 className="font-display text-3xl sm:text-5xl font-black tracking-tighter mb-3">
        Personalized Path
      </h2>
      <p className="text-sm text-neutral-600 mb-8 max-w-2xl leading-relaxed">
        Pick your role to highlight the modules that matter most for you. Everything else stays one
        click away in the curriculum below.
      </p>

      <div className="flex flex-wrap gap-3 mb-8">
        {ROLES.map((r) => {
          const active = r.id === selected;
          return (
            <button
              key={r.id}
              data-testid={`role-${r.id}`}
              onClick={() => setSelected(r.id)}
              className={`border border-black px-4 py-2.5 text-left transition-colors ${
                active ? "bg-[#002FA7] text-white" : "bg-white hover:bg-[#FAFF00]"
              }`}
            >
              <span className="block text-sm font-bold tracking-tight">{r.label}</span>
              <span className={`block text-xs ${active ? "text-blue-200" : "text-neutral-500"}`}>
                {r.modules.length} modules
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-black hard-shadow p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
          <h3 className="font-display text-2xl font-bold tracking-tight">
            {role.label} <span className="text-neutral-400">· {role.sub}</span>
          </h3>
          <span className="text-xs tracking-[0.2em] uppercase font-bold border border-black bg-[#EAEAEA] px-2 py-1 w-fit">
            {role.modules.length} Recommended
          </span>
        </div>

        <p className="text-sm text-neutral-700 leading-relaxed border-l-4 border-[#002FA7] bg-[#F4F4F0] px-4 py-3 mb-6">
          {role.advice}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {recModules.map((m) => (
            <div key={m.id} className="flex items-center gap-3" data-testid={`role-rec-${m.id}`}>
              <span className="w-5 h-5 bg-[#002FA7] text-white flex items-center justify-center shrink-0">
                <Check size={12} />
              </span>
              <span className="text-xs font-bold text-neutral-400">{m.code}</span>
              <span className="text-sm font-bold">{m.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
