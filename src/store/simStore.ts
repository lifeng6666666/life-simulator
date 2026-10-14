/**
 * 模拟状态管理 - Zustand
 */

import { create } from "zustand";

export type AgentRole = "coach" | "player" | "env";

export interface AgentMessage {
  round: number;
  role: AgentRole;
  label: string;
  content: string;
}

export interface RoundData {
  round: number;
  overallPlan: string;
  nextStep: string;
  action: string;
  envFeedback: string;
  result: string;
  goalChanged: boolean;
  newGoal: string;
  age: number;
  elapsedWeeks?: number;
  goalProgress: number;
  keyEvents: string[];
}

export type ModelProvider = "nvidia" | "openrouter" | "modelscope";

export interface ModelSpec {
  id: string;
  provider: ModelProvider;
}

/** 时间跨度档位：3years=节奏快（约3年） / 5years=按季度（约5年） */
export type TimeSpan = "3years" | "5years";

export interface SimConfig {
  apiKeys: {
    nvidia?: string;
    openrouter?: string;
    modelscope?: string;
  };
  models: {
    coach: ModelSpec;
    player: ModelSpec;
    environment: ModelSpec;
  };
  situation: {
    age: number;
    occupation: string;
    resources: string;
    /** 性格与特质（如：拖延、社恐 / 自律、外向、漂亮），影响执行难度与环境反应 */
    traits: string;
    currentGoal: string;
  };
  rounds: number;
  rateLimitMs: number;
  /** 每轮代表的时间长度档位，决定 20 轮总跨度 */
  timeSpan: TimeSpan;
}

export interface RetryInfo {
  agent: string;
  model: string;
  attempt: number;
  maxRetries: number;
  reason: string;
  waitMs: number;
}

interface SimState {
  status: "idle" | "running" | "completed" | "error";
  config: SimConfig | null;
  currentRound: number;
  totalRounds: number;
  agentMessages: AgentMessage[];
  rounds: RoundData[];
  age: number;
  /** 已流逝累计周数 */
  totalWeeks: number;
  goal: string;
  goalProgress: number;
  keyEvents: string[];
  resources: string;
  finalReport: string | null;
  error: string | null;
  activeAgent: AgentRole | null;
  retryInfo: RetryInfo | null;
  pendingGoalChanged: boolean;
  pendingNewGoal: string;

  startSimulation: (config: SimConfig) => void;
  resumeSimulation: (config: SimConfig, resume: ResumePayload) => void;
  handleSSEEvent: (event: SSEEventData) => void;
  reset: () => void;
}

/** 断点恢复负载：从 store 当前状态构建 */
export interface ResumePayload {
  startRound: number;
  age: number;
  goal: string;
  goalProgress: number;
  resources: string;
  keyEvents: string[];
  totalWeeks: number;
  rounds: RoundData[];
}

export interface SSEEventData {
  type: string;
  round?: number;
  overallPlan?: string;
  nextStep?: string;
  estimatedWeeks?: number;
  action?: string;
  feedback?: string;
  result?: string;
  goalChanged?: boolean;
  newGoal?: string;
  // llm_retry 事件字段
  agent?: string;
  model?: string;
  attempt?: number;
  maxRetries?: number;
  reason?: string;
  waitMs?: number;
  state?: {
    age: number;
    elapsedWeeks?: number;
    totalWeeks?: number;
    goalProgress: number;
    keyEvents: string[];
    resources: string;
    goal: string;
  };
  report?: string;
  message?: string;
}

export const useSimStore = create<SimState>((set, get) => ({
  status: "idle",
  config: null,
  currentRound: 0,
  totalRounds: 0,
  agentMessages: [],
  rounds: [],
  age: 0,
  totalWeeks: 0,
  goal: "",
  goalProgress: 0,
  keyEvents: [],
  resources: "",
  finalReport: null,
  error: null,
  activeAgent: null,
  retryInfo: null,
  pendingGoalChanged: false,
  pendingNewGoal: "",

  startSimulation: (config: SimConfig) => {
    set({
      status: "running",
      config,
      currentRound: 0,
      totalRounds: config.rounds,
      agentMessages: [],
      rounds: [],
      age: config.situation.age,
      goal: config.situation.currentGoal,
      goalProgress: 0,
      keyEvents: [],
      resources: config.situation.resources,
      finalReport: null,
      error: null,
      activeAgent: null,
      retryInfo: null,
      pendingGoalChanged: false,
      pendingNewGoal: "",
    });
  },

  resumeSimulation: (config: SimConfig, resume: ResumePayload) => {
    set({
      status: "running",
      config,
      currentRound: resume.startRound - 1,
      totalRounds: config.rounds,
      // 丢弃未完成轮次的半截消息，保留已完成轮次
      agentMessages: get().agentMessages.filter((m) => m.round < resume.startRound),
      rounds: resume.rounds,
      age: resume.age,
      totalWeeks: resume.totalWeeks,
      goal: resume.goal,
      goalProgress: resume.goalProgress,
      keyEvents: resume.keyEvents,
      resources: resume.resources || config.situation.resources,
      finalReport: null,
      error: null,
      activeAgent: null,
      retryInfo: null,
      pendingGoalChanged: false,
      pendingNewGoal: "",
    });
  },

  handleSSEEvent: (event: SSEEventData) => {
    const state = get();

    switch (event.type) {
      case "llm_retry":
        set({
          retryInfo: {
            agent: event.agent ?? "未知",
            model: event.model ?? "",
            attempt: event.attempt ?? 0,
            maxRetries: event.maxRetries ?? 0,
            reason: event.reason ?? "未知原因",
            waitMs: event.waitMs ?? 0,
          },
        });
        break;

      case "round_start":
        set({ retryInfo: null, currentRound: event.round ?? state.currentRound + 1 });
        break;

      case "coach_plan":
        set({
          activeAgent: "coach",
          retryInfo: null,
          agentMessages: [
            ...state.agentMessages,
            {
              round: event.round!,
              role: "coach",
              label: "整体规划",
              content: event.overallPlan ?? "",
            },
            {
              round: event.round!,
              role: "coach",
              label: event.estimatedWeeks ? `下一步行动 · 约${event.estimatedWeeks}周` : "下一步行动",
              content: event.nextStep ?? "",
            },
          ],
        });
        break;

      case "player_action":
        set({
          activeAgent: "player",
          retryInfo: null,
          agentMessages: [
            ...state.agentMessages,
            {
              round: event.round!,
              role: "player",
              label: "执行行动",
              content: event.action ?? "",
            },
          ],
        });
        break;

      case "env_feedback":
        set({
          activeAgent: "env",
          retryInfo: null,
          agentMessages: [
            ...state.agentMessages,
            {
              round: event.round!,
              role: "env",
              label: "环境反馈",
              content: event.feedback ?? "",
            },
          ],
        });
        break;

      case "player_record":
        set({
          activeAgent: "player",
          retryInfo: null,
          pendingGoalChanged: event.goalChanged ?? false,
          pendingNewGoal: event.newGoal ?? "",
          agentMessages: [
            ...state.agentMessages,
            {
              round: event.round!,
              role: "player",
              label: "执行记录",
              content: event.result ?? "",
            },
          ],
        });
        break;

      case "round_end":
        if (event.state) {
          const roundNum = event.round ?? state.currentRound;
          const roundData: RoundData = {
            round: roundNum,
            overallPlan: "",
            nextStep: "",
            action: "",
            envFeedback: "",
            result: "",
            goalChanged: state.pendingGoalChanged,
            newGoal: state.pendingNewGoal,
            age: event.state.age,
            elapsedWeeks: event.state.elapsedWeeks,
            goalProgress: event.state.goalProgress,
            keyEvents: event.state.keyEvents ?? [],
          };

          // 从 agentMessages 中提取当前轮的详细数据
          const roundMessages = state.agentMessages.filter((m) => m.round === roundNum);
          for (const msg of roundMessages) {
            if (msg.label === "整体规划") roundData.overallPlan = msg.content;
            if (msg.label.startsWith("下一步行动")) roundData.nextStep = msg.content;
            if (msg.label === "执行行动") roundData.action = msg.content;
            if (msg.label === "环境反馈") roundData.envFeedback = msg.content;
            if (msg.label === "执行记录") roundData.result = msg.content;
          }

          set({
            rounds: [...state.rounds, roundData],
            age: event.state.age,
            totalWeeks: event.state.totalWeeks ?? state.totalWeeks + (event.state.elapsedWeeks ?? 0),
            goal: event.state.goal ?? state.goal,
            goalProgress: event.state.goalProgress,
            keyEvents: event.state.keyEvents ?? state.keyEvents,
            resources: event.state.resources || state.resources,
            activeAgent: null,
            retryInfo: null,
            pendingGoalChanged: false,
            pendingNewGoal: "",
          });
        }
        break;

      case "final_report":
        set({
          status: "completed",
          finalReport: event.report ?? "",
          activeAgent: null,
          retryInfo: null,
        });
        break;

      case "error":
        set({
          status: "error",
          error: event.message ?? "未知错误",
          activeAgent: null,
          retryInfo: null,
        });
        break;
    }
  },

  reset: () => {
    set({
      status: "idle",
      config: null,
      currentRound: 0,
      totalRounds: 0,
      agentMessages: [],
      rounds: [],
      age: 0,
      totalWeeks: 0,
      goal: "",
      goalProgress: 0,
      keyEvents: [],
      resources: "",
      finalReport: null,
      error: null,
      activeAgent: null,
      retryInfo: null,
      pendingGoalChanged: false,
      pendingNewGoal: "",
    });
  },
}));
