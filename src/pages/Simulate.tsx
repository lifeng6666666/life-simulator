/**
 * 模拟运行页 - 三列智能体对话流 + 状态面板
 */

import { useRef, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  User,
  Globe,
  Square,
  Sparkles,
  Loader2,
  History,
  X,
  ChevronDown,
  Compass,
  Play,
  AlertTriangle,
} from "lucide-react";
import { useSimStore, type AgentRole, type AgentMessage, type RoundData } from "@/store/simStore";
import { useSimulation } from "@/hooks/useSimulation";
import LifeStages from "@/components/LifeStages";
import { cn } from "@/lib/utils";

export default function Simulate() {
  const navigate = useNavigate();
  const { abort, resume } = useSimulation();
  const {
    status,
    currentRound,
    totalRounds,
    agentMessages,
    rounds,
    finalReport,
    age,
    goal,
    goalProgress,
    keyEvents,
    error,
    activeAgent,
    retryInfo,
    pendingGoalChanged,
  } = useSimStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // 新消息到达时自动滚到底部
  useEffect(() => {
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollTop = timelineScrollRef.current.scrollHeight;
    }
  }, [agentMessages]);

  useEffect(() => {
    if (status === "idle") {
      navigate("/");
    }
  }, [status, navigate]);

  if (status === "idle") {
    return null;
  }

  const isCompleted = status === "completed";
  const isError = status === "error";

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="starfield" />

      {/* 顶栏 */}
      <header className="relative z-10 glass-strong border-b border-midnight-600/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-xl text-starwhite">
            人生<span className="text-amber italic">推演</span>
          </h1>
          <span className="font-mono text-xs text-starwhite/40">
            第 {currentRound}/{totalRounds} 轮
          </span>
        </div>

        <div className="flex items-center gap-3">
          {rounds.length > 0 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-midnight-600 text-starwhite/70 rounded-lg text-sm hover:border-amber/50 hover:text-amber"
            >
              <History size={16} />
              人生历程
              <span className="font-mono text-xs text-amber">{rounds.length}</span>
            </button>
          )}
          {isCompleted && (
            <button
              onClick={() => navigate("/journey")}
              className="flex items-center gap-2 px-4 py-2 bg-amber text-midnight-950 rounded-lg text-sm font-medium hover:bg-amber-light"
            >
              <Sparkles size={16} />
              查看人生历程
            </button>
          )}
          {!isCompleted && !isError && (
            <button
              onClick={() => {
                abort();
                navigate("/");
              }}
              className="flex items-center gap-2 px-4 py-2 border border-midnight-600 text-starwhite/60 rounded-lg text-sm hover:border-agent-env/50 hover:text-agent-envLight"
            >
              <Square size={14} />
              终止
            </button>
          )}
          {isError && (
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-4 py-2 bg-agent-env text-starwhite rounded-lg text-sm"
            >
              返回
            </button>
          )}
        </div>
      </header>

      {/* 错误提示：保留原页面内容，仅显示中断横幅 */}
      {isError && (
        <div className="relative z-10 mx-auto mt-3 max-w-3xl w-full px-6">
          <div className="glass border border-agent-env/40 rounded-xl p-5 animate-fade-in">
            <div className="flex items-start gap-3 flex-wrap">
              <AlertTriangle size={20} className="text-agent-envLight shrink-0 mt-0.5" />
              <div className="flex-1 min-w-48">
                <p className="text-agent-envLight text-sm mb-1">
                  推演中断 — 重试已达上限
                </p>
                <p className="text-starwhite/60 text-xs font-mono break-all">{error}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => resume()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber text-midnight-950 rounded-lg text-sm font-medium hover:bg-amber-light"
                >
                  <Play size={14} />
                  继续推演
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 border border-midnight-600 text-starwhite/60 rounded-lg text-sm hover:border-agent-env/50 hover:text-agent-envLight"
                >
                  返回
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重试提示 */}
      {retryInfo && !isError && (
        <div className="relative z-10 mx-auto mt-3 max-w-2xl w-full px-6">
          <div className="glass border border-amber/40 rounded-lg px-4 py-2.5 flex items-center gap-3 animate-fade-in">
            <Loader2 size={16} className="animate-spin text-amber shrink-0" />
            <p className="text-xs text-starwhite/70">
              <span className="text-amber font-medium">
                {retryInfo.agent === "openrouter" ? "OpenRouter" : retryInfo.agent === "nvidia" ? "NVIDIA" : retryInfo.agent}
              </span>{" "}
              调用失败（{retryInfo.reason}），正在重试{" "}
              <span className="font-mono text-amber">
                {retryInfo.attempt}/{retryInfo.maxRetries}
              </span>
              ，等待 {Math.round(retryInfo.waitMs / 1000)}s...
            </p>
          </div>
        </div>
      )}

      {/* 对话时间线：按轮对齐 + 整体规划归组 */}
      <main
        ref={timelineScrollRef}
        className="relative z-10 flex-1 overflow-y-auto p-3 min-h-0"
      >
        <RoundTimeline
          messages={agentMessages}
          rounds={rounds}
          pendingGoalChanged={pendingGoalChanged}
          currentRound={currentRound}
          activeAgent={activeAgent}
        />
      </main>

      {/* 底部状态面板 */}
      <footer className="relative z-10 glass-strong border-t border-midnight-600/50 px-6 py-4">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            {/* 目标 */}
            <div className="flex-1 min-w-0 max-w-md">
              <p className="text-xs text-starwhite/40 mb-1">当前目标</p>
              <p className="text-sm text-starwhite/80 truncate" title={goal}>
                {goal || "—"}
              </p>
            </div>

            {/* 年龄 */}
            <Stat label="模拟年龄" value={`${age} 岁`} />

            {/* 进度环 */}
            <div className="flex items-center gap-3">
              <ProgressRing value={goalProgress} />
              <div>
                <p className="text-xs text-starwhite/40">目标完成度</p>
                <p className="font-mono text-sm text-amber">{goalProgress}%</p>
              </div>
            </div>

            {/* 关键事件 */}
            {keyEvents.length > 0 && (
              <div className="max-w-xs">
                <p className="text-xs text-starwhite/40 mb-1">关键事件</p>
                <div className="flex flex-wrap gap-1">
                  {keyEvents.slice(-3).map((e, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full bg-midnight-700 text-starwhite/60 truncate max-w-32"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
      </footer>

      {/* 人生历程抽屉 */}
      <RoundHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

/**
 * 对话时间线：每轮一行四列对齐（轮次 | 教练·下一步 | 执行者 | 环境），
 * 同一目标的多个"下一步"归入同一阶段整体规划组；目标调整或规划更换时开启新组
 */
const GRID_COLS = "grid grid-cols-[3.5rem_1fr_1fr_1fr] gap-2";

function RoundTimeline({
  messages,
  rounds,
  pendingGoalChanged,
  currentRound,
  activeAgent,
}: {
  messages: AgentMessage[];
  rounds: RoundData[];
  pendingGoalChanged: boolean;
  currentRound: number;
  activeAgent: AgentRole | null;
}) {
  // 按轮聚合消息，保持到达顺序
  const byRound = useMemo(() => {
    const map = new Map<number, AgentMessage[]>();
    for (const m of messages) {
      const arr = map.get(m.round) ?? [];
      arr.push(m);
      map.set(m.round, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [messages]);

  // 目标调整发生过的轮（该轮结束后目标变更，下一轮开启新阶段）
  const goalChangedRounds = useMemo(() => {
    const set = new Set<number>();
    for (const r of rounds) if (r.goalChanged) set.add(r.round);
    if (pendingGoalChanged) set.add(currentRound);
    return set;
  }, [rounds, pendingGoalChanged, currentRound]);

  // 规划组：目标调整后开启新组；组头规划取组内第一条"整体规划"
  const groups = useMemo(() => {
    const result: { plan: string | null; planRound: number | null; rows: number[] }[] = [];
    let cur: (typeof result)[number] | null = null;
    for (const [round, msgs] of byRound) {
      const planMsg = msgs.find((m) => m.label === "整体规划");
      if (!cur || goalChangedRounds.has(round - 1)) {
        cur = { plan: planMsg?.content ?? null, planRound: planMsg ? round : null, rows: [] };
        result.push(cur);
      } else if (planMsg && cur.plan === null) {
        cur.plan = planMsg.content;
        cur.planRound = round;
      }
      cur.rows.push(round);
    }
    return result;
  }, [byRound, goalChangedRounds]);

  if (byRound.length === 0) {
    return (
      <div className="text-center py-16 text-starwhite/20 text-sm">
        等待推演开始...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* 列头 */}
      <div
        className={cn(
          GRID_COLS,
          "sticky top-0 z-10 glass-strong px-2 py-2 rounded-lg mb-3 border-b border-midnight-600/50"
        )}
      >
        <span className="text-[11px] font-mono text-starwhite/35 self-center">轮次</span>
        <span className="text-[11px] font-medium text-agent-coachLight flex items-center gap-1.5">
          <Brain size={12} /> B 教练 · 下一步
        </span>
        <span className="text-[11px] font-medium text-agent-playerLight flex items-center gap-1.5">
          <User size={12} /> A 执行者
        </span>
        <span className="text-[11px] font-medium text-agent-envLight flex items-center gap-1.5">
          <Globe size={12} /> C 环境
        </span>
      </div>

      {groups.map((group, gi) => (
        <section key={gi} className="border-l-2 border-agent-coach/30 pl-3 mb-5 space-y-2">
          {/* 阶段整体规划卡（组头） */}
          {group.plan && (
            <div className="rounded-xl border border-agent-coach/30 bg-agent-coach/10 p-3">
              <p className="text-[11px] text-agent-coachLight font-medium mb-1 flex items-center gap-1.5">
                <Compass size={12} />
                阶段整体规划 · 第 {group.planRound} 轮起
              </p>
              <p className="text-sm text-starwhite/80 leading-relaxed">{group.plan}</p>
            </div>
          )}

          {/* 轮行 */}
          {group.rows.map((round) => (
            <RoundRow
              key={round}
              round={round}
              msgs={byRound.find(([r]) => r === round)?.[1] ?? []}
              groupPlan={group.plan}
              groupPlanRound={group.planRound}
              age={rounds.find((r) => r.round === round)?.age ?? null}
              isCurrent={round === currentRound && !rounds.some((r) => r.round === round)}
              activeAgent={activeAgent}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function RoundRow({
  round,
  msgs,
  groupPlan,
  groupPlanRound,
  age,
  isCurrent,
  activeAgent,
}: {
  round: number;
  msgs: AgentMessage[];
  groupPlan: string | null;
  groupPlanRound: number | null;
  age: number | null;
  isCurrent: boolean;
  activeAgent: AgentRole | null;
}) {
  const nextMsg = msgs.find((m) => m.label === "下一步行动");
  const planMsg = msgs.find((m) => m.label === "整体规划");
  const actionMsg = msgs.find((m) => m.label === "执行行动");
  const resultMsg = msgs.find((m) => m.label === "执行记录");
  const feedbackMsg = msgs.find((m) => m.label === "环境反馈");
  // 与组头规划不同 → 规划微调（可展开看全文）
  const planTweaked = planMsg && planMsg.content !== groupPlan;

  return (
    <div
      className={cn(
        GRID_COLS,
        "items-stretch animate-message",
        isCurrent && "rounded-lg ring-1 ring-amber/30 p-1 -m-1"
      )}
    >
      {/* 轮次 */}
      <div className="flex flex-col items-start gap-1 pt-1">
        <span
          className={cn(
            "font-mono text-xs",
            isCurrent ? "text-amber" : "text-starwhite/35"
          )}
        >
          R{round}
        </span>
        {age !== null && <span className="text-[10px] text-starwhite/25 font-mono">{age}岁</span>}
      </div>

      {/* 教练列 */}
      <div className="space-y-1.5">
        {planTweaked && planMsg && (
          <PlanTweak content={planMsg.content} fromRound={groupPlanRound} />
        )}
        {nextMsg ? (
          <MsgCard label="下一步" content={nextMsg.content} color="#8b6db5" highlight={activeAgent === "coach"} />
        ) : (
          <EmptyCell active={activeAgent === "coach"} />
        )}
      </div>

      {/* 执行者列 */}
      <div className="space-y-1.5">
        {actionMsg ? (
          <MsgCard label="执行行动" content={actionMsg.content} color="#3d7a6e" highlight={activeAgent === "player"} />
        ) : (
          <EmptyCell active={activeAgent === "player"} />
        )}
        {resultMsg && (
          <MsgCard label="执行记录" content={resultMsg.content} color="#3d7a6e" highlight={activeAgent === "player"} />
        )}
      </div>

      {/* 环境列 */}
      <div className="space-y-1.5">
        {feedbackMsg ? (
          <MsgCard label="环境反馈" content={feedbackMsg.content} color="#c4663a" highlight={activeAgent === "env"} />
        ) : (
          <EmptyCell active={activeAgent === "env"} />
        )}
      </div>
    </div>
  );
}

/** 点击展开全文的消息卡（默认 3 行截断） */
function MsgCard({
  label,
  content,
  color,
  highlight,
}: {
  label: string;
  content: string;
  color: string;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "rounded-lg bg-midnight-800/60 p-2 border-l-2 transition-all",
        highlight && "ring-1 ring-amber/40"
      )}
      style={{ borderLeftColor: color }}
    >
      <p className="text-[10px] font-mono mb-1" style={{ color }}>
        {label}
      </p>
      <p
        className={cn(
          "text-xs text-starwhite/70 leading-relaxed whitespace-pre-wrap",
          !open && "line-clamp-3 cursor-pointer hover:text-starwhite/90",
          open && "cursor-pointer"
        )}
        onClick={() => setOpen(!open)}
        title={open ? "点击收起" : "点击展开全文"}
      >
        {content}
      </p>
    </div>
  );
}

/** 组内后续轮次的规划微调（默认折叠） */
function PlanTweak({ content, fromRound }: { content: string; fromRound: number | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-agent-coach/10 px-2 py-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] text-agent-coachLight hover:text-amber"
      >
        <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
        规划微调（相对第 {fromRound ?? "—"} 轮）
      </button>
      {open && (
        <p className="text-xs text-starwhite/60 leading-relaxed mt-1.5 whitespace-pre-wrap">
          {content}
        </p>
      )}
    </div>
  );
}

/** 空占位格 */
function EmptyCell({ active }: { active?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-midnight-600/40 h-10 flex items-center justify-center",
        active && "border-amber/40"
      )}
    >
      {active ? (
        <Loader2 size={13} className="animate-spin text-amber/60" />
      ) : (
        <span className="text-[10px] text-starwhite/15">—</span>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-starwhite/40">{label}</p>
      <p className="font-mono text-sm text-starwhite/80">{value}</p>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width="44" height="44" className="transform -rotate-90">
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="rgba(42,52,88,0.5)"
        strokeWidth="3"
      />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="#d4a574"
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

/**
 * 人生历程抽屉 - 实时展示已完成轮次的完整记录
 */
function RoundHistoryDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { rounds, finalReport, age, goalProgress, goal, config } = useSimStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新一轮完成时自动滚到底部
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, rounds.length]);

  return (
    <>
      {/* 遮罩 */}
      <div
        className={cn(
          "fixed inset-0 z-20 bg-midnight-950/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* 抽屉面板 */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-30 h-full w-full max-w-md glass-strong border-l border-midnight-600/50 flex flex-col transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* 抽屉头 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-midnight-600/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <History size={18} className="text-amber" />
            <h2 className="font-serif text-lg text-starwhite">人生历程</h2>
            <span className="font-mono text-xs text-starwhite/40">
              {rounds.length} 轮 · {age} 岁
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-starwhite/40 hover:text-starwhite transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 分阶段历程 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 min-h-0">
          {rounds.length === 0 ? (
            <div className="text-center py-10 text-starwhite/20 text-xs">
              等待第一轮推演完成...
            </div>
          ) : (
            <LifeStages
              rounds={rounds}
              startGoal={config?.situation.currentGoal ?? goal}
              startAge={config?.situation.age ?? 0}
              startProgress={0}
              finalReport={finalReport}
            />
          )}
        </div>

        {/* 底部概览 */}
        <div className="px-5 py-3 border-t border-midnight-600/50 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="text-starwhite/40">目标完成度</span>
            <span className="font-mono text-amber">{goalProgress}%</span>
          </div>
          <div className="mt-2 h-1.5 bg-midnight-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber rounded-full transition-all duration-1000"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
        </div>
      </aside>
    </>
  );
}

