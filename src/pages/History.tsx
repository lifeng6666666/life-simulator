/**
 * 历史推演页 - 存档列表 + 分阶段详情回看
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Target,
  Trash2,
  History as HistoryIcon,
  Cpu,
} from "lucide-react";
import type { RoundData } from "@/store/simStore";
import { listRuns, deleteRun, type HistoryRun } from "@/lib/history";
import LifeStages from "@/components/LifeStages";

export default function History() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<HistoryRun[]>(() => listRuns());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleDelete = useCallback((id: string) => {
    deleteRun(id);
    setRuns(listRuns());
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const selected = runs.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="relative min-h-screen">
      <div className="starfield" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => (selected ? setSelectedId(null) : navigate("/"))}
            className="flex items-center gap-2 text-sm text-starwhite/50 hover:text-amber"
          >
            <ArrowLeft size={16} />
            {selected ? "返回列表" : "返回首页"}
          </button>
          <div className="flex items-center gap-2 text-starwhite/40">
            <HistoryIcon size={16} />
            <span className="text-sm">历史推演 · {runs.length} 条存档</span>
          </div>
        </div>

        {selected ? (
          <HistoryDetail run={selected} />
        ) : (
          <RunList runs={runs} onOpen={setSelectedId} onDelete={handleDelete} />
        )}

        <div className="h-20" />
      </div>
    </div>
  );
}

function RunList({
  runs,
  onOpen,
  onDelete,
}: {
  runs: HistoryRun[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (runs.length === 0) {
    return (
      <div className="glass rounded-2xl py-16 text-center">
        <HistoryIcon className="mx-auto mb-3 text-starwhite/20" size={36} />
        <p className="text-starwhite/40 text-sm">还没有历史推演存档</p>
        <p className="text-starwhite/20 text-xs mt-1">完成一次推演后会自动保存到这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <div
          key={run.id}
          className="glass rounded-xl p-5 hover:border-amber/30 transition-colors group"
        >
          <div className="flex items-start justify-between gap-4">
            <button onClick={() => onOpen(run.id)} className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber/15 text-amber">
                  {run.rounds.length}/{run.totalRounds} 轮
                </span>
                {run.completed ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                    已完成
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-agent-env/20 text-agent-envLight">
                    未完成
                  </span>
                )}
                <span className="text-xs text-starwhite/40 flex items-center gap-1">
                  <Calendar size={11} />
                  {new Date(run.createdAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs text-starwhite/30 font-mono">
                  {run.situation.age}→{run.finalAge} 岁
                </span>
              </div>
              <p className="text-starwhite/80 text-sm truncate flex items-center gap-2">
                <Target size={14} className="text-amber/70 flex-shrink-0" />
                {run.finalGoal}
              </p>
              <p className="text-xs text-starwhite/35 mt-1.5 truncate flex items-center gap-1.5">
                <Cpu size={11} className="flex-shrink-0" />
                {run.providerLabel} · {run.situation.occupation}
              </p>
            </button>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="text-right">
                <p className="font-mono text-lg text-amber">{run.goalProgress}%</p>
                <p className="text-[10px] text-starwhite/30">完成度</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onOpen(run.id)}
                  className="p-1.5 rounded-lg text-starwhite/40 hover:text-amber hover:bg-amber/10"
                  title="查看详情"
                >
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => onDelete(run.id)}
                  className="p-1.5 rounded-lg text-starwhite/30 hover:text-red-400 hover:bg-red-500/10"
                  title="删除存档"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryDetail({ run }: { run: HistoryRun }) {
  return (
    <div>
      {/* 存档信息 */}
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex items-start gap-2.5 mb-4">
          <Target size={18} className="text-amber mt-1 flex-shrink-0" />
          <div>
            <h1 className="font-serif text-xl text-starwhite leading-snug">{run.finalGoal}</h1>
            <p className="text-xs text-starwhite/40 mt-1.5 font-mono">
              {new Date(run.createdAt).toLocaleString("zh-CN")} · {run.providerLabel} ·{" "}
              {run.modelsLabel}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <StatBox label="初始年龄" value={`${run.situation.age} 岁`} />
          <StatBox label="最终年龄" value={`${run.finalAge} 岁`} />
          <StatBox label="完成轮数" value={`${run.rounds.length}/${run.totalRounds}`} />
          <StatBox label="目标完成度" value={`${run.goalProgress}%`} highlight />
        </div>
        <div className="mt-4 pt-4 border-t border-midnight-600/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-starwhite/40">
          <span>职业：{run.situation.occupation}</span>
          <span>初始资源：{run.situation.resources}</span>
        </div>
      </div>

      {/* 分阶段历程（存档数据转换为 RoundData 形状复用） */}
      <LifeStages
        rounds={run.rounds as RoundData[]}
        startGoal={run.situation.goal}
        startAge={run.situation.age}
        startProgress={0}
        finalReport={run.finalReport}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-midnight-800/60 py-3">
      <p className="text-[10px] text-starwhite/35 mb-0.5">{label}</p>
      <p className={highlight ? "font-mono text-amber text-lg" : "font-mono text-starwhite/80"}>
        {value}
      </p>
    </div>
  );
}
