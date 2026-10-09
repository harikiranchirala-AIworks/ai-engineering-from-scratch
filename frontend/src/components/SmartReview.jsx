import { useMemo } from "react";
import { Sparkles, AlertCircle, ArrowRight, CheckCircle, BookOpen, Target, Flame } from "lucide-react";
import { MODULES, moduleTopicKeys, moduleTopicCount } from "../data/curriculum";
import { ROLES } from "../data/roles";

export const SmartReview = ({ countDone, ratings = {}, selectedRole = "all", onJumpToModule }) => {
  const roleData = ROLES.find((r) => r.id === selectedRole) || ROLES[0];
  const targetModuleIds = new Set(roleData.modules);

  const analysis = useMemo(() => {
    const modulesStatus = MODULES.map((m) => {
      const completed = countDone(moduleTopicKeys(m));
      const total = moduleTopicCount(m);
      const pct = total ? Math.round((completed / total) * 100) : 0;
      const isTarget = targetModuleIds.has(m.id);
      return {
        ...m,
        completed,
        total,
        pct,
        isTarget,
      };
    });

    // Modules that are started but not finished, prioritized by role targets
    const inProgress = modulesStatus
      .filter((m) => m.pct > 0 && m.pct < 100)
      .sort((a, b) => (b.isTarget === a.isTarget ? b.pct - a.pct : b.isTarget ? 1 : -1));

    // Target modules not yet started
    const unstartedTargets = modulesStatus
      .filter((m) => m.isTarget && m.pct === 0);

    // Mastered modules
    const mastered = modulesStatus.filter((m) => m.pct === 100);

    // Count weak flashcard ratings
    const weakRatingsCount = Object.values(ratings).filter((v) => v === "again").length;

    return {
      modulesStatus,
      inProgress,
      unstartedTargets,
      mastered,
      weakRatingsCount,
    };
  }, [countDone, targetModuleIds, ratings]);

  return (
    <div className="border border-black bg-white hard-shadow p-6 sm:p-8" data-testid="smart-review">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#002FA7]" />
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-500">
              Personalized Learning Intelligence
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-1">
            Smart Review & Weak Areas Engine
          </h3>
        </div>
        <div className="border border-black bg-[#F4F4F0] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <Target size={14} className="text-[#002FA7]" />
          <span>Active Role: <strong className="text-black">{roleData.label}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {/* Status Box 1 */}
        <div className="border border-black bg-[#F4F4F0] p-4">
          <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">In-Progress Focus</span>
          <span className="font-display text-3xl font-black text-[#002FA7] block mt-1">
            {analysis.inProgress.length}
          </span>
          <p className="text-xs text-neutral-600 mt-1">Active modules awaiting completion</p>
        </div>

        {/* Status Box 2 */}
        <div className="border border-black bg-[#F4F4F0] p-4">
          <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">Unstarted Role Targets</span>
          <span className="font-display text-3xl font-black text-black block mt-1">
            {analysis.unstartedTargets.length}
          </span>
          <p className="text-xs text-neutral-600 mt-1">High-priority modules for {roleData.label}</p>
        </div>

        {/* Status Box 3 */}
        <div className="border border-black bg-[#F4F4F0] p-4">
          <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">Flashcard Weak Areas</span>
          <span className="font-display text-3xl font-black text-[#FF3B30] block mt-1">
            {analysis.weakRatingsCount}
          </span>
          <p className="text-xs text-neutral-600 mt-1">Cards marked 'Again' for drill review</p>
        </div>
      </div>

      {/* Suggested Actions Queue */}
      <div className="mt-8">
        <h4 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
          <Flame size={16} className="text-[#FAFF00] bg-black p-0.5" /> Recommended Next Steps
        </h4>

        {analysis.inProgress.length === 0 && analysis.unstartedTargets.length === 0 ? (
          <div className="border border-black bg-[#00C853]/10 p-6 text-center">
            <CheckCircle size={28} className="text-[#00C853] mx-auto mb-2" />
            <h5 className="font-display font-bold text-base">You are fully on track!</h5>
            <p className="text-xs text-neutral-600 mt-1">All target modules for this career path have been completed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top in progress */}
            {analysis.inProgress.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="border border-black bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#002FA7] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#111111] text-[#FAFF00] font-mono text-[10px] font-bold px-2 py-0.5">
                      {m.code}
                    </span>
                    <span className="font-display font-bold text-base">{m.title}</span>
                    {m.isTarget && (
                      <span className="text-[10px] bg-[#002FA7] text-white px-2 py-0.5 uppercase font-bold">
                        Target Role
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">{m.blurb}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs font-bold text-neutral-600">
                    <span>{m.completed}/{m.total} topics ({m.pct}%)</span>
                    <div className="w-28 h-2 bg-neutral-200 border border-black">
                      <div className="h-full bg-[#002FA7]" style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onJumpToModule(m.id)}
                  className="shrink-0 flex items-center justify-center gap-2 bg-[#002FA7] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
                >
                  Resume Module <ArrowRight size={14} />
                </button>
              </div>
            ))}

            {/* Next unstarted target */}
            {analysis.unstartedTargets.slice(0, 2).map((m) => (
              <div
                key={m.id}
                className="border border-black bg-[#F4F4F0] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-black transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-neutral-300 text-black font-mono text-[10px] font-bold px-2 py-0.5">
                      {m.code}
                    </span>
                    <span className="font-display font-bold text-base">{m.title}</span>
                    <span className="text-[10px] bg-[#FAFF00] text-black border border-black px-2 py-0.5 uppercase font-bold">
                      Not Started
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">{m.blurb}</p>
                </div>

                <button
                  onClick={() => onJumpToModule(m.id)}
                  className="shrink-0 flex items-center justify-center gap-2 border border-black bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-[#FAFF00] transition-colors"
                >
                  Start Module <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
