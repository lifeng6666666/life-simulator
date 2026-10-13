/**
 * 以目标为轴，把轮次记录切分成人生阶段
 * 每当执行者调整目标（goalChanged），即开启新阶段
 */

import type { RoundData } from "@/store/simStore";

export interface LifeStage {
  /** 本阶段的目标（首轮无 goalChanged 前的目标） */
  goal: string;
  rounds: RoundData[];
  /** 阶段起始/结束年龄（起始取上一轮结束年龄，首轮取初始年龄） */
  startAge: number;
  endAge: number;
  /** 阶段起始/结束的目标完成度 */
  startProgress: number;
  endProgress: number;
  /** 阶段路线图（阶段第一轮的整体规划） */
  plan: string;
  /** 阶段内关键事件（按轮聚合） */
  keyEvents: string[];
}

export function deriveStages(
  rounds: RoundData[],
  startGoal: string,
  startAge: number,
  startProgress: number
): LifeStage[] {
  const stages: LifeStage[] = [];
  let cur: LifeStage | null = null;
  let pendingGoal = startGoal;
  let prevAge = startAge;
  let prevProgress = startProgress;

  for (const r of rounds) {
    if (!cur) {
      cur = {
        goal: pendingGoal,
        rounds: [],
        startAge: prevAge,
        endAge: r.age,
        startProgress: prevProgress,
        endProgress: r.goalProgress,
        plan: r.overallPlan,
        keyEvents: [],
      };
      stages.push(cur);
    }
    cur.rounds.push(r);
    cur.endAge = r.age;
    cur.endProgress = r.goalProgress;
    cur.keyEvents.push(...r.keyEvents);

    prevAge = r.age;
    prevProgress = r.goalProgress;
    if (r.goalChanged) {
      cur = null;
      if (r.newGoal) pendingGoal = r.newGoal;
    }
  }
  return stages;
}
