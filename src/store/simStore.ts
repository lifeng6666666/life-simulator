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
  goalProgress: number;
  keyEvents: string[];
}

export type ModelProvider = "nvidia" | "openrouter";

export interface ModelSpec {
  id: string;
  provider: ModelProvider;
}

export interface SimConfig {
  apiKeys: {
    nvidia?: string;
    openrouter?: string;
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
    currentGoal: string;
  };
  rounds: number;
  rateLimitMs: number;
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
  goal: string;
  goalProgress: number;
  keyEvents: string[];
  finalReport: string | null;
  error: string | null;
  activeAgent: AgentRole | null;
  retryInfo: RetryInfo | null;
  pendingGoalChanged: boolean;
  pendingNewGoal: string;

  startSimulation: (config: SimConfig) => void;
  handleSSEEvent: (event: SSEEventData) => void;
  reset: () => void;
}

interface SSEEventData {
  type: string;
  round?: number;
  overallPlan?: string;
  nextStep?: string;
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
  goal: "",
  goalProgress: 0,
  keyEvents: [],
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
              label: "下一步行动",
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
            goalProgress: event.state.goalProgress,
            keyEvents: event.state.keyEvents ?? [],
          };

          // 从 agentMessages 中提取当前轮的详细数据
          const roundMessages = state.agentMessages.filter((m) => m.round === roundNum);
          for (const msg of roundMessages) {
            if (msg.label === "整体规划") roundData.overallPlan = msg.content;
            if (msg.label === "下一步行动") roundData.nextStep = msg.content;
            if (msg.label === "执行行动") roundData.action = msg.content;
            if (msg.label === "环境反馈") roundData.envFeedback = msg.content;
            if (msg.label === "执行记录") roundData.result = msg.content;
          }

          set({
            rounds: [...state.rounds, roundData],
            age: event.state.age,
            goal: event.state.goal ?? state.goal,
            goalProgress: event.state.goalProgress,
            keyEvents: event.state.keyEvents ?? state.keyEvents,
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
      goal: "",
      goalProgress: 0,
      keyEvents: [],
      finalReport: null,
      error: null,
      activeAgent: null,
      retryInfo: null,
      pendingGoalChanged: false,
      pendingNewGoal: "",
    });
  },
}));
