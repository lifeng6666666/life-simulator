/**
 * 人生历程页 - 时间线 + 轮次详情卡片 + 总结报告
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Compass,
  Footprints,
  Globe,
  FileText,
  Flag,
  ScrollText,
} from "lucide-react";
import { useSimStore, type RoundData } from "@/store/simStore";
import { cn } from "@/lib/utils";

export default function Journey() {
  const navigate = useNavigate();
  const { rounds, finalReport, age, goal, goalProgress } = useSimStore();

  useEffect(() => {
    if (rounds.length === 0) {
      navigate("/");
    }
  }, [rounds.length, navigate]);

  if (rounds.length === 0) {
    return null;
  }

  return (
    <div className="relative min-h-screen">
      <div className="starfield" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-starwhite/50 hover:text-amber"
          >
            <ArrowLeft size={16} />
            新的推演
          </button>
          <div className="text-right">
            <p className="font-mono text-xs text-starwhite/40">
              {rounds.length} 轮推演 · 最终 {age} 岁
            </p>
            <p className="text-sm text-starwhite/60 truncate max-w-xs" title={goal}>
              {goal}
            </p>
          </div>
        </div>

        {/* 总览卡片 */}
        <div className="glass rounded-2xl p-8 mb-10 text-center animate-slide-up">
          <Compass className="mx-auto mb-3 text-amber" size={32} />
          <h1 className="font-serif text-4xl text-starwhite mb-2">人生历程</h1>
          <p className="text-starwhite/50 text-sm">
            从 {(rounds[0]?.age ?? age) - 1} 岁到 {age} 岁，目标完成度 {goalProgress}%
          </p>

          {/* 进度条 */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="h-2 bg-midnight-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber rounded-full transition-all duration-1000"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-starwhite/30 font-mono">
              <span>起点</span>
              <span className="text-amber">{goalProgress}%</span>
              <span>目标</span>
            </div>
          </div>
        </div>

        {/* 时间线 */}
        <div className="relative pl-8">
          {/* 时间线主线 */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-midnight-600">
            <div
              className="absolute top-0 w-full timeline-line rounded-full"
              style={{ height: "100%" }}
            />
          </div>

          {rounds.map((round, i) => (
            <TimelineNode key={round.round} round={round} isLast={i === rounds.length - 1} />
          ))}
        </div>

        {/* 总结报告 */}
        {finalReport && (
          <div className="glass rounded-2xl p-8 mt-10 animate-slide-up">
            <div className="flex items-center gap-3 mb-5">
              <ScrollText className="text-amber" size={24} />
              <h2 className="font-serif text-2xl text-starwhite">人生总结</h2>
            </div>
            <p className="text-starwhite/70 text-sm leading-relaxed whitespace-pre-wrap">
              {finalReport}
            </p>
          </div>
        )}

        <div className="h-20" />
      </div>
    </div>
  );
}

function TimelineNode({
  round,
  isLast,
}: {
  round: RoundData;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative mb-6">
      {/* 时间线节点 */}
      <div
        className="absolute -left-5 top-3 w-4 h-4 rounded-full border-2 border-amber bg-midnight-950 animate-pulse-glow"
        style={{ animationDelay: `${round.round * 0.1}s` }}
      />
      {!isLast && (
        <div className="absolute -left-3.5 top-7 w-0.5 h-full bg-midnight-600/50" />
      )}

      {/* 轮次卡片 */}
      <div className="glass rounded-xl overflow-hidden">
        {/* 卡片头部 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-midnight-700/30"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-amber/60">第 {round.round} 轮</span>
            <span className="text-sm text-starwhite/70">{round.age} 岁</span>
            {round.goalChanged && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-agent-env/20 text-agent-envLight">
                目标调整
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-starwhite/40">
              {round.goalProgress}%
            </span>
            <ChevronDown
              size={16}
              className={cn(
                "text-starwhite/30 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </div>
        </button>

        {/* 摘要行 */}
        {!expanded && (
          <div className="px-5 pb-3">
            <p className="text-sm text-starwhite/50 truncate">{round.result}</p>
          </div>
        )}

        {/* 展开详情 */}
        {expanded && (
          <div className="px-5 pb-5 space-y-4 animate-slide-up">
            <DetailBlock
              icon={Compass}
              label="整体规划"
              content={round.overallPlan}
              color="#8b6db5"
            />
            <DetailBlock
              icon={Footprints}
              label="下一步行动"
              content={round.nextStep}
              color="#8b6db5"
            />
            <DetailBlock
              icon={Footprints}
              label="执行行动"
              content={round.action}
              color="#3d7a6e"
            />
            <DetailBlock
              icon={Globe}
              label="环境反馈"
              content={round.envFeedback}
              color="#c4663a"
            />
            <DetailBlock
              icon={FileText}
              label="执行记录"
              content={round.result}
              color="#3d7a6e"
            />

            {/* 目标变化 */}
            {round.goalChanged && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-agent-env/10 border border-agent-env/20">
                <Flag size={16} className="text-agent-envLight mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-agent-envLight mb-1">目标调整</p>
                  <p className="text-sm text-starwhite/70">{round.newGoal}</p>
                </div>
              </div>
            )}

            {/* 关键事件 */}
            {round.keyEvents.length > 0 && (
              <div>
                <p className="text-xs text-starwhite/40 mb-2">关键事件</p>
                <div className="flex flex-wrap gap-2">
                  {round.keyEvents.map((e, i) => (
                    <span
                      key={i}
                      className="text-xs px-3 py-1 rounded-full bg-midnight-700 text-starwhite/60"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
  return (
    <div className="border-l-2 pl-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color }} />
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      </div>
      <p className="text-sm text-starwhite/70 leading-relaxed whitespace-pre-wrap pl-5">
        {content}
      </p>
    </div>
  );
}
