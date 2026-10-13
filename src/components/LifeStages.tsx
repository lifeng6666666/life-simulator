/**
 * 分阶段人生历程展示（以目标为轴）
 * Journey 页、推演页抽屉、历史详情共用
 */

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Compass,
  Footprints,
  Globe,
  FileText,
  Flag,
  ScrollText,
  Target,
} from "lucide-react";
import type { RoundData } from "@/store/simStore";
import { deriveStages } from "@/lib/stages";
import { cn } from "@/lib/utils";

interface LifeStagesProps {
  rounds: RoundData[];
  startGoal: string;
  startAge: number;
  startProgress: number;
  finalReport?: string | null;
}

export default function LifeStages({
  rounds,
  startGoal,
  startAge,
  startProgress,
  finalReport,
}: LifeStagesProps) {
  const stages = useMemo(
    () => deriveStages(rounds, startGoal, startAge, startProgress),
    [rounds, startGoal, startAge, startProgress]
  );

  return (
    <div className="space-y-6">
      {stages.map((stage, si) => (
        <StageCard key={si} stage={stage} index={si} total={stages.length} />
      ))}

      {finalReport && (
        <div className="glass rounded-2xl p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <ScrollText className="text-amber" size={20} />
            <h2 className="font-serif text-xl text-starwhite">人生总结</h2>
          </div>
          <p className="text-starwhite/70 text-sm leading-relaxed whitespace-pre-wrap">
            {finalReport}
          </p>
        </div>
      )}
    </div>
  );
}

function StageCard({
  stage,
  index,
  total,
}: {
  stage: ReturnType<typeof deriveStages>[number];
  index: number;
  total: number;
}) {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const delta = stage.endProgress - stage.startProgress;
  const maxProgress = Math.max(...stage.rounds.map((r) => r.goalProgress), 1);

  // 里程碑去重
  const events = Array.from(new Set(stage.keyEvents.filter(Boolean)));
  const visibleEvents = showAllEvents ? events : events.slice(0, 6);

  return (
    <section className="relative">
      {/* 阶段头卡片 */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center flex-wrap gap-2 mb-3">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber/15 text-amber">
            阶段 {index + 1}
            {index === 0 && total > 1 && " · 初始目标"}
          </span>
          <span className="text-xs text-starwhite/40 font-mono">
            {stage.startAge}-{stage.endAge} 岁 · {stage.rounds.length} 轮
          </span>
          {delta !== 0 && (
            <span
              className={cn(
                "text-xs font-mono px-2 py-0.5 rounded-full",
                delta > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
          )}
        </div>

        <div className="flex items-start gap-2.5">
          <Target size={18} className="text-amber mt-1 flex-shrink-0" />
          <h3 className="font-serif text-lg text-starwhite leading-snug">{stage.goal}</h3>
        </div>

        {/* 阶段路线图 */}
        {stage.plan && (
          <div className="mt-4 border-l-2 border-amber/40 pl-4">
            <p className="text-xs text-amber/70 mb-1 flex items-center gap-1.5">
              <Compass size={12} />
              阶段路线图
            </p>
            <p className="text-sm text-starwhite/60 leading-relaxed">{stage.plan}</p>
          </div>
        )}

        {/* 关键里程碑 */}
        {events.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-starwhite/40 mb-2">关键里程碑</p>
            <div className="flex flex-wrap gap-1.5">
              {visibleEvents.map((e, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-midnight-700/80 text-starwhite/60"
                >
                  {e}
                </span>
              ))}
              {events.length > 6 && !showAllEvents && (
                <button
                  onClick={() => setShowAllEvents(true)}
                  className="text-xs px-2.5 py-1 rounded-full bg-amber/10 text-amber/80 hover:bg-amber/20"
                >
                  +{events.length - 6} 更多
                </button>
              )}
            </div>
          </div>
        )}

        {/* 完成度轨迹 */}
        <div className="mt-4">
          <p className="text-xs text-starwhite/40 mb-2">完成度轨迹</p>
          <div className="flex items-end gap-1.5 h-12">
            {stage.rounds.map((r) => (
              <div
                key={r.round}
                className="flex-1 flex flex-col items-center justify-end gap-1 group"
                title={`第 ${r.round} 轮 · ${r.age} 岁 · ${r.goalProgress}%`}
              >
                <span className="text-[10px] font-mono text-starwhite/0 group-hover:text-starwhite/50 transition-colors">
                  {r.goalProgress}%
                </span>
                <div
                  className="w-full max-w-[22px] rounded-t bg-amber/60 group-hover:bg-amber transition-colors"
                  style={{ height: `${Math.max((r.goalProgress / maxProgress) * 100, 6)}%` }}
                />
                <span className="text-[10px] font-mono text-starwhite/25">R{r.round}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 轮次折叠明细 */}
      <div className="mt-3 space-y-2 pl-2 sm:pl-6">
        {stage.rounds.map((r) => (
          <RoundRow key={r.round} round={r} />
        ))}
      </div>
    </section>
  );
}

function RoundRow({ round }: { round: RoundData }) {
  const [open, setOpen] = useState(false);
  const summary = round.result || round.action;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-midnight-700/30 transition-colors"
      >
        <span className="font-mono text-xs text-amber/60 w-12 flex-shrink-0">
          第{round.round}轮
        </span>
        <span className="text-xs text-starwhite/40 w-9 flex-shrink-0 font-mono">
          {round.age}岁
        </span>
        <span className="flex-1 text-sm text-starwhite/55 truncate">{summary}</span>
        <span className="font-mono text-xs text-starwhite/35 flex-shrink-0">
          {round.goalProgress}%
        </span>
        <ChevronDown
          size={15}
          className={cn("text-starwhite/30 transition-transform flex-shrink-0", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-4 pb-5 pt-1 space-y-3.5 animate-slide-up">
          <DetailBlock icon={Compass} label="整体规划" content={round.overallPlan} color="#8b6db5" />
          <DetailBlock
            icon={Footprints}
            label="下一步行动"
            content={round.nextStep}
            color="#8b6db5"
          />
          <DetailBlock icon={Footprints} label="执行行动" content={round.action} color="#3d7a6e" />
          <DetailBlock icon={Globe} label="环境反馈" content={round.envFeedback} color="#c4663a" />
          <DetailBlock icon={FileText} label="执行记录" content={round.result} color="#3d7a6e" />

          {round.goalChanged && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-agent-env/10 border border-agent-env/20">
              <Flag size={16} className="text-agent-envLight mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-agent-envLight mb-1">本轮后目标调整</p>
                <p className="text-sm text-starwhite/70">{round.newGoal}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailBlock({
  icon: Icon,
  label,
  content,
  color,
}: {
  icon: typeof Compass;
  label: string;
  content: string;
  color: string;
}) {
  if (!content) return null;
  return (
    <div className="border-l-2 pl-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color }} />
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      </div>
      <p className="text-sm text-starwhite/70 leading-relaxed whitespace-pre-wrap pl-5">{content}</p>
    </div>
  );
}
