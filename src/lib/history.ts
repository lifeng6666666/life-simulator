/**
 * 历史推演存档 - localStorage 持久化
 */

import type { RoundData, SimConfig } from "@/store/simStore";

export interface HistoryRun {
  id: string;
  createdAt: number;
  /** 是否完整跑完（含人生总结）；中断/手动停止的存档为 false */
  completed: boolean;
  /** 初始人生设定 */
  situation: {
    age: number;
    occupation: string;
    resources: string;
    goal: string;
  };
  /** 计划轮数 */
  totalRounds: number;
  /** 服务商与模型简述 */
  providerLabel: string;
  modelsLabel: string;
  rounds: RoundData[];
  finalAge: number;
  finalGoal: string;
  goalProgress: number;
  finalReport: string | null;
}

const KEY = "lifesim-history-v1";
const MAX_RUNS = 20;

const PROVIDER_NAMES: Record<string, string> = {
  nvidia: "NVIDIA NIM",
  openrouter: "OpenRouter",
  modelscope: "魔搭 ModelScope",
};

export function providerLabelOf(config: SimConfig): string {
  return PROVIDER_NAMES[config.models.coach.provider] ?? config.models.coach.provider;
}

function shortModel(id: string): string {
  const tail = id.split("/").pop() ?? id;
  return tail.replace(":free", "").slice(0, 22);
}

export function modelsLabelOf(config: SimConfig): string {
  const { coach, player, environment } = config.models;
  return `${shortModel(coach.id)} / ${shortModel(player.id)} / ${shortModel(environment.id)}`;
}

/** 从当前配置构建存档元信息（供 useSimulation 存档时调用） */
export function buildHistoryRun(
  config: SimConfig,
  data: {
    completed: boolean;
    rounds: RoundData[];
    finalAge: number;
    finalGoal: string;
    goalProgress: number;
    finalReport: string | null;
  }
): HistoryRun {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    situation: {
      age: config.situation.age,
      occupation: config.situation.occupation,
      resources: config.situation.resources,
      goal: config.situation.currentGoal,
    },
    totalRounds: config.rounds,
    providerLabel: providerLabelOf(config),
    modelsLabel: modelsLabelOf(config),
    ...data,
  };
}

export function listRuns(): HistoryRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const runs = JSON.parse(raw) as HistoryRun[];
    return Array.isArray(runs) ? runs : [];
  } catch {
    return [];
  }
}

export function getRun(id: string): HistoryRun | undefined {
  return listRuns().find((r) => r.id === id);
}

export function saveRun(run: HistoryRun): void {
  try {
    const runs = [run, ...listRuns().filter((r) => r.id !== run.id)].slice(0, MAX_RUNS);
    localStorage.setItem(KEY, JSON.stringify(runs));
  } catch {
    // 存储满等异常，静默忽略
  }
}

export function deleteRun(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listRuns().filter((r) => r.id !== id)));
  } catch {
    // 忽略
  }
}
