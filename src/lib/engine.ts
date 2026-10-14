/**
 * 人生推演引擎（浏览器端）
 * 三个智能体循环：B 教练规划 → A 执行者行动 → C 环境反馈 → A 记录
 * 纯前端运行：LLM 调用从浏览器直连服务商，key 不经过任何服务器
 */

import { callLLM, extractJSON, type LLMProvider } from './llm';
import {
  getCoachSystemPrompt,
  getPlayerSystemPrompt,
  getEnvironmentSystemPrompt,
  buildCoachPlanUserPrompt,
  buildPlayerActionUserPrompt,
  buildEnvironmentUserPrompt,
  buildPlayerRecordUserPrompt,
  buildCoachSummaryUserPrompt,
  formatAgeCN,
  type TimeSpan,
} from './prompts';
import type { ResumePayload, SimConfig } from '@/store/simStore';

type AgentName = 'coach' | 'player' | 'environment';

/** 引擎事件（与 store 的 SSEEventData 结构对齐） */
export type SimEvent =
  | { type: 'coach_plan'; round: number; overallPlan: string; nextStep: string; estimatedWeeks?: number }
  | { type: 'player_action'; round: number; action: string }
  | { type: 'env_feedback'; round: number; feedback: string }
  | { type: 'player_record'; round: number; result: string; goalChanged: boolean; newGoal: string }
  | {
      type: 'round_end';
      round: number;
      state: {
        age: number;
        elapsedWeeks: number;
        totalWeeks: number;
        goalProgress: number;
        keyEvents: string[];
        resources: string;
        goal: string;
      };
    }
  | { type: 'llm_retry'; agent: string; model: string; attempt: number; maxRetries: number; reason: string; waitMs: number }
  | { type: 'final_report'; report: string }
  | { type: 'error'; message: string };

interface EngineRound {
  overallPlan: string;
  nextStep: string;
  action: string;
  envFeedback: string;
  result: string;
  age: number;
  elapsedWeeks?: number;
  goalProgress: number;
  keyEvents: string[];
}

interface EngineState {
  startAge: number;
  age: number;
  totalWeeks: number;
  goal: string;
  goalProgress: number;
  resources: string;
  occupation: string;
  traits: string;
  keyEvents: string[];
  rounds: EngineRound[];
}

/** 周数取值钳制（非法时用默认值；下限随时间跨度档位变化） */
function clampWeeks(value: unknown, dflt: number, min: number): number {
  const n = typeof value === 'number' ? Math.round(value) : NaN;
  return Number.isFinite(n) ? Math.min(16, Math.max(min, n)) : dflt;
}

/**
 * 运行完整推演。正常走完发出 final_report；可恢复的失败发出 error 后结束；
 * 用户中断时抛出 AbortError。
 */
export async function runSimulation(
  config: SimConfig,
  resume: ResumePayload | null,
  onEvent: (event: SimEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const { apiKeys, models } = config;
  const timeSpan: TimeSpan = config.timeSpan ?? '5years';
  const minWeeks = timeSpan === '3years' ? 2 : 4;
  const dfltWeeks = timeSpan === '3years' ? 8 : 12;
  const callOpts = { rateLimitMs: config.rateLimitMs, signal };

  /** 以指定智能体的模型发起一次调用（带重试事件） */
  const agentCall = async (agent: AgentName, messages: { role: 'system' | 'user'; content: string }[]) => {
    const spec = models[agent];
    const key = apiKeys[spec.provider as keyof typeof apiKeys];
    if (!key) throw new Error(`未填写 ${spec.provider} 的 API Key，请返回配置页填写`);
    return callLLM(key, spec.provider as LLMProvider, spec.id, messages, {
      ...callOpts,
      onRetry: (info) =>
        onEvent({
          type: 'llm_retry',
          agent,
          model: spec.id,
          attempt: info.attempt,
          maxRetries: info.maxRetries,
          reason: info.reason,
          waitMs: info.delayMs,
        }),
    });
  };

  // 时间轴：年龄由累计周数折算（52 周 = 1 岁）；断点续推时恢复累计周数
  const startAge = config.situation.age;
  const totalWeeks =
    resume?.totalWeeks ?? resume?.rounds.reduce((sum, r) => sum + (r.elapsedWeeks ?? 13), 0) ?? 0;
  const state: EngineState = {
    startAge,
    totalWeeks,
    age: Math.round((startAge + totalWeeks / 52) * 100) / 100,
    goal: resume?.goal ?? config.situation.currentGoal,
    goalProgress: resume?.goalProgress ?? 0,
    resources: resume?.resources || config.situation.resources,
    occupation: config.situation.occupation,
    traits: config.situation.traits ?? '',
    keyEvents: resume?.keyEvents ?? [],
    rounds: resume?.rounds ?? [],
  };
  const startRound = resume?.startRound ?? 1;

  const historyText = (): string => buildHistoryText(state);

  try {
    for (let round = startRound; round <= config.rounds; round++) {
      // 1. B 教练生成规划
      const coachPlanResp = await agentCall('coach', [
        { role: 'system', content: getCoachSystemPrompt(timeSpan) },
        {
          role: 'user',
          content: buildCoachPlanUserPrompt({
            age: state.age,
            goal: state.goal,
            resources: state.resources,
            occupation: state.occupation,
            traits: state.traits,
            goalProgress: state.goalProgress,
            history: historyText(),
          }),
        },
      ]);

      const plan = extractJSON<{ overallPlan: string; nextStep: string; estimatedWeeks?: number }>(coachPlanResp);
      const overallPlan = plan?.overallPlan ?? coachPlanResp;
      const nextStep = plan?.nextStep ?? '继续推进当前目标';
      const estimatedWeeks = clampWeeks(plan?.estimatedWeeks, dfltWeeks, minWeeks);

      onEvent({ type: 'coach_plan', round, overallPlan, nextStep, estimatedWeeks });

      // 2. A 执行者执行行动
      const playerActionResp = await agentCall('player', [
        { role: 'system', content: getPlayerSystemPrompt(timeSpan) },
        { role: 'user', content: buildPlayerActionUserPrompt(nextStep, estimatedWeeks, state.traits) },
      ]);
      const action = extractJSON<{ action: string }>(playerActionResp)?.action ?? playerActionResp;

      onEvent({ type: 'player_action', round, action });

      // 3. C 环境反馈 + 时间推进
      const envFeedbackResp = await agentCall('environment', [
        { role: 'system', content: getEnvironmentSystemPrompt(timeSpan) },
        {
          role: 'user',
          content: buildEnvironmentUserPrompt(
            action,
            { age: state.age, occupation: state.occupation, resources: state.resources, goal: state.goal, traits: state.traits },
            estimatedWeeks
          ),
        },
      ]);
      const feedbackData = extractJSON<{
        feedback: string;
        state?: { elapsedWeeks?: number; keyEvents: string[]; resources: string };
      }>(envFeedbackResp);
      const feedback = feedbackData?.feedback ?? envFeedbackResp;

      // 客观世界事实（耗时/事件/资源）以 C 的判定为权威；年龄 = 初始年龄 + 累计周数/52
      const elapsedWeeks = clampWeeks(feedbackData?.state?.elapsedWeeks, estimatedWeeks, minWeeks);
      state.totalWeeks += elapsedWeeks;
      const newAge = Math.round((state.startAge + state.totalWeeks / 52) * 100) / 100;
      const newKeyEvents = feedbackData?.state?.keyEvents ?? [];
      state.resources = feedbackData?.state?.resources || state.resources;

      onEvent({ type: 'env_feedback', round, feedback });

      // 4. A 执行者记录结果、自评完成度、判断是否改目标
      const playerRecordResp = await agentCall('player', [
        { role: 'system', content: getPlayerSystemPrompt(timeSpan) },
        {
          role: 'user',
          content: buildPlayerRecordUserPrompt(feedback, {
            age: newAge,
            goal: state.goal,
            goalProgress: state.goalProgress,
          }),
        },
      ]);
      const record = extractJSON<{
        result: string;
        goalProgress?: number;
        goalChanged: boolean;
        newGoal: string;
      }>(playerRecordResp);

      const result = record?.result ?? playerRecordResp;
      const newProgress = typeof record?.goalProgress === 'number' ? record.goalProgress : state.goalProgress;
      const goalChanged = record?.goalChanged ?? false;
      const newGoal = goalChanged && record?.newGoal ? record.newGoal : state.goal;

      // 更新状态
      state.goal = newGoal;
      state.age = newAge;
      state.goalProgress = newProgress;
      state.keyEvents = [...state.keyEvents, ...newKeyEvents];
      state.rounds.push({
        overallPlan,
        nextStep,
        action,
        envFeedback: feedback,
        result,
        age: newAge,
        elapsedWeeks,
        goalProgress: newProgress,
        keyEvents: newKeyEvents,
      });

      onEvent({ type: 'player_record', round, result, goalChanged, newGoal });

      onEvent({
        type: 'round_end',
        round,
        state: {
          age: newAge,
          elapsedWeeks,
          totalWeeks: state.totalWeeks,
          goalProgress: newProgress,
          keyEvents: newKeyEvents,
          resources: state.resources,
          goal: state.goal,
        },
      });
    }

    // 5. B 教练生成人生总结
    const summaryResp = await agentCall('coach', [
      { role: 'system', content: getCoachSystemPrompt(timeSpan) },
      { role: 'user', content: buildCoachSummaryUserPrompt(historyText()) },
    ]);
    const summary = extractJSON<Record<string, string>>(summaryResp);
    const report = summary?.report || summary?.['人生总结报告'] || summaryResp;

    onEvent({ type: 'final_report', report });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    onEvent({ type: 'error', message: err instanceof Error ? err.message : '推演失败' });
  }
}

/** 从引擎状态构建历史摘要文本（供教练规划与总结使用） */
function buildHistoryText(state: EngineState): string {
  if (state.rounds.length === 0) {
    return `【初始状态】年龄${formatAgeCN(state.startAge)}，职业：${state.occupation}，目标：${state.goal}，资源：${state.resources}`;
  }

  const lines = state.rounds.map((r, i) => {
    return `--- 第${i + 1}轮（${formatAgeCN(r.age)}，历时约${r.elapsedWeeks ?? '?'}周）---
规划：${r.nextStep}
执行：${r.action}
环境反馈：${r.envFeedback}
结果：${r.result}
目标完成度：${r.goalProgress}%${r.keyEvents.length > 0 ? '\n关键事件：' + r.keyEvents.join('；') : ''}`;
  });

  return `【初始状态】年龄${formatAgeCN(state.startAge)}，目标：${state.goal}
${lines.join('\n\n')}`;
}
