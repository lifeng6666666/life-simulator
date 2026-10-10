/**
 * 模拟运行页 - 三列智能体对话流 + 状态面板
 */

import { useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, User, Globe, Square, Sparkles, Loader2 } from "lucide-react";
import { useSimStore, type AgentRole, type AgentMessage } from "@/store/simStore";
import { useSimulation } from "@/hooks/useSimulation";
import { cn } from "@/lib/utils";

const AGENT_CONFIG: Record<AgentRole, {
  name: string;
  role: string;
  icon: typeof Brain;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}> = {
  coach: {
    name: "教练",
    role: "B 规划者",
    icon: Brain,
    color: "agent-coach",
    bgClass: "bg-agent-coach/10",
    borderClass: "border-agent-coach/30",
    textClass: "text-agent-coachLight",
  },
  player: {
    name: "执行者",
    role: "A 扮演你",
    icon: User,
    color: "agent-player",
    bgClass: "bg-agent-player/10",
    borderClass: "border-agent-player/30",
    textClass: "text-agent-playerLight",
  },
  env: {
    name: "现实环境",
    role: "C 模拟世界",
    icon: Globe,
    color: "agent-env",
    bgClass: "bg-agent-env/10",
    borderClass: "border-agent-env/30",
    textClass: "text-agent-envLight",
  },
};

export default function Simulate() {
  const navigate = useNavigate();
  const { abort } = useSimulation();
  const {
    status,
    currentRound,
    totalRounds,
    agentMessages,
    age,
    goal,
    goalProgress,
    keyEvents,
    error,
    activeAgent,
    retryInfo,
  } = useSimStore();

  const coachMessages = useMemo(
    () => agentMessages.filter((m) => m.role === "coach"),
    [agentMessages]
  );
  const playerMessages = useMemo(
    () => agentMessages.filter((m) => m.role === "player"),
    [agentMessages]
  );
  const envMessages = useMemo(
    () => agentMessages.filter((m) => m.role === "env"),
    [agentMessages]
  );

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

      {/* 错误提示 */}
      {isError && (
        <div className="relative z-10 mx-auto mt-8 max-w-2xl w-full px-6">
          <div className="glass border border-agent-env/40 rounded-xl p-6 text-center">
            <p className="text-agent-envLight text-sm mb-2">推演中断</p>
            <p className="text-starwhite/60 text-xs font-mono">{error}</p>
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

      {/* 三列对话流 */}
      {!isError && (
        <main className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 overflow-hidden">
          <AgentColumn
            role="coach"
            messages={coachMessages}
            isActive={activeAgent === "coach"}
          />
          <AgentColumn
            role="player"
            messages={playerMessages}
            isActive={activeAgent === "player"}
          />
          <AgentColumn
            role="env"
            messages={envMessages}
            isActive={activeAgent === "env"}
          />
        </main>
      )}

      {/* 底部状态面板 */}
      {!isError && (
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
      )}
    </div>
  );
}

function AgentColumn({
  role,
  messages,
  isActive,
}: {
  role: AgentRole;
  messages: AgentMessage[];
  isActive: boolean;
}) {
  const config = AGENT_CONFIG[role];
  const Icon = config.icon;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      className={cn(
        "glass rounded-xl flex flex-col overflow-hidden transition-all",
        isActive && "ring-1",
        isActive && `ring-${config.color}/40`
      )}
    >
      {/* 列头 */}
      <div className={cn("flex items-center gap-3 px-4 py-3 border-b", config.borderClass)}>
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            config.bgClass,
            isActive && "animate-pulse-glow"
          )}
        >
          <Icon size={18} className={config.textClass} />
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", config.textClass)}>{config.name}</p>
          <p className="text-xs text-starwhite/30 font-mono">{config.role}</p>
        </div>
        {isActive && (
          <Loader2 size={16} className={cn("ml-auto animate-spin", config.textClass)} />
        )}
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 text-starwhite/20 text-xs">
            等待数据...
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={`${msg.round}-${i}`}
            className="animate-message glass rounded-lg p-3 border-l-2"
            style={{
              borderLeftColor:
                config.color === "agent-coach"
                  ? "#8b6db5"
                  : config.color === "agent-player"
                    ? "#3d7a6e"
                    : "#c4663a",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono text-starwhite/30">{msg.label}</span>
              <span className="text-xs text-starwhite/20">R{msg.round}</span>
            </div>
            <p className="text-sm text-starwhite/75 leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
        ))}
      </div>
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
