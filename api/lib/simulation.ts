/**
 * 人生模拟引擎
 * 串行调用 A/B/C 三个智能体，通过 SSE 推送结果
 */

import { callLLM, type LLMProvider, extractJSON } from './nvidia.js';
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
} from './prompts.js';

export interface ModelSpec {
  id: string;
  provider: LLMProvider;
}

export interface SimulateRequest {
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
    currentGoal: string;
  };
  rounds: number;
  rateLimitMs: number;
  /** 时间跨度档位：3years=节奏快（约3年） / 5years=按季度（约5年），默认 5years */
  timeSpan?: TimeSpan;
  /** 断点恢复：从中断处继续推演 */
  resume?: ResumeState;
}

export interface ResumeState {
  /** 从第几轮开始（已完成轮数 + 1） */
  startRound: number;
  age: number;
  goal: string;
  goalProgress: number;
  resources: string;
  keyEvents: string[];
  /** 已流逝的累计周数（保持时间连续性） */
  totalWeeks?: number;
  rounds: {
    overallPlan: string;
    nextStep: string;
    action: string;
    envFeedback: string;
    result: string;
    age: number;
    elapsedWeeks?: number;
    goalProgress: number;
    keyEvents: string[];
  }[];
}

export interface RoundState {
  age: number;
  /** 本轮实际消耗周数 */
  elapsedWeeks: number;
  /** 截至本轮的累计周数 */
  totalWeeks: number;
  goalProgress: number;
  keyEvents: string[];
  resources: string;
  goal: string;
}

export interface SSEEvent {
  type: string;
  round?: number;
  [key: string]: unknown;
}

interface SimState {
  /** 初始年龄（年龄 = startAge + totalWeeks/52） */
  startAge: number;
  /** 当前年龄（浮点，精确到周） */
  age: number;
  /** 已流逝累计周数 */
  totalWeeks: number;
  goal: string;
  goalProgress: number;
  resources: string;
  occupation: string;
  keyEvents: string[];
  rounds: {
    overallPlan: string;
    nextStep: string;
    action: string;
    envFeedback: string;
    result: string;
    age: number;
    elapsedWeeks?: number;
    goalProgress: number;
    keyEvents: string[];
  }[];
}

/** 周数取值钳制（非法时用默认值；下限随时间跨度档位变化） */
function clampWeeks(value: unknown, dflt: number, min: number): number {
  const n = typeof value === 'number' ? Math.round(value) : NaN;
  return Number.isFinite(n) ? Math.min(16, Math.max(min, n)) : dflt;
}

/**
 * 运行完整模拟
 * @param req 模拟请求
 * @param sendSSE 发送 SSE 事件的回调
 */
export async function runSimulation(
  req: SimulateRequest,
  sendSSE: (event: SSEEvent) => void
): Promise<void> {
  const resume = req.resume;
  const timeSpan: TimeSpan = req.timeSpan ?? '5years';
  // 时间轴：年龄由累计周数折算（52 周 = 1 岁）；断点续推时恢复累计周数
  const startAge = req.situation.age;
  const totalWeeks =
    resume?.totalWeeks ??
    resume?.rounds.reduce((sum, r) => sum + (r.elapsedWeeks ?? 13), 0) ??
    0;
  const state: SimState = {
    startAge,
    totalWeeks,
    age: Math.round((startAge + totalWeeks / 52) * 100) / 100,
    goal: resume?.goal ?? req.situation.currentGoal,
    goalProgress: resume?.goalProgress ?? 0,
    resources: resume?.resources || req.situation.resources,
    occupation: req.situation.occupation,
    keyEvents: resume?.keyEvents ?? [],
    rounds: resume?.rounds ?? [],
  };
  const startRound = resume?.startRound ?? 1;

  const { models, rateLimitMs } = req;
  const callOpts = { rateLimitMs, maxTokens: 2048, temperature: 0.85 };

  const keyFor = (provider: LLMProvider): string => {
    const key =
      provider === 'nvidia'
        ? req.apiKeys.nvidia
        : provider === 'openrouter'
          ? req.apiKeys.openrouter
          : req.apiKeys.modelscope;
    const name =
      provider === 'nvidia' ? 'NVIDIA' : provider === 'openrouter' ? 'OpenRouter' : 'ModelScope';
    if (!key) {
      throw new Error(`缺少 ${name} API Key`);
    }
    return key;
  };

  const agentName = (spec: ModelSpec): string => spec.provider;

  // 免费池 fallback 链：主模型被限速时自动切换同池其他模型
  const OPENROUTER_POOL = [
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'thinkingmachines/inkling-small:free',
    'google/gemma-4-26b-a4b-it:free',
    'google/gemma-4-31b-it:free',
    'thinkingmachines/inkling:free',
  ];
  const NVIDIA_POOL = [
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'z-ai/glm-5.3-flash',
    'deepseek-ai/deepseek-v4.1-flash',
    'meta/muse-glimmer-30b',
  ];
  const fallbacksFor = (spec: ModelSpec): string[] => {
    // 魔搭：固定三模型，不回退（429 仅同模型退避重试）
    if (spec.provider === 'modelscope') return [];
    const pool = spec.provider === 'openrouter' ? OPENROUTER_POOL : NVIDIA_POOL;
    return pool.filter((id) => id !== spec.id).slice(0, 3);
  };

  // 重试回调：向前端推送重试状态
  const retryFor = (spec: ModelSpec) => (info: { attempt: number; maxRetries: number; delayMs: number; reason: string }) =>
    sendSSE({
      type: 'llm_retry',
      agent: agentName(spec),
      model: spec.id,
      attempt: info.attempt,
      maxRetries: info.maxRetries,
      reason: info.reason,
      waitMs: Math.round(info.delayMs),
    } as SSEEvent);

  for (let round = startRound; round <= req.rounds; round++) {
    sendSSE({ type: 'round_start', round });

    const historyText = buildHistoryText(state);

    // 1. B 教练生成规划
    const coachPlanResp = await callLLM(
      keyFor(models.coach.provider),
      models.coach.provider,
      models.coach.id,
      [
        { role: 'system', content: getCoachSystemPrompt(timeSpan) },
        {
          role: 'user',
          content: buildCoachPlanUserPrompt({
            age: state.age,
            goal: state.goal,
            resources: state.resources,
            occupation: state.occupation,
            goalProgress: state.goalProgress,
            history: historyText,
          }),
        },
      ],
      { ...callOpts, onRetry: retryFor(models.coach), fallbackModels: fallbacksFor(models.coach) }
    );

    const plan = extractJSON<{ overallPlan: string; nextStep: string; estimatedWeeks?: number }>(coachPlanResp);
    const overallPlan = plan?.overallPlan ?? coachPlanResp;
    const nextStep = plan?.nextStep ?? '继续推进当前目标';
    const estimatedWeeks = clampWeeks(plan?.estimatedWeeks, timeSpan === '3years' ? 8 : 12, timeSpan === '3years' ? 2 : 4);

    sendSSE({ type: 'coach_plan', round, overallPlan, nextStep, estimatedWeeks });

    // 2. A 执行者执行行动
    const playerActionResp = await callLLM(
      keyFor(models.player.provider),
      models.player.provider,
      models.player.id,
      [
        { role: 'system', content: getPlayerSystemPrompt(timeSpan) },
        { role: 'user', content: buildPlayerActionUserPrompt(nextStep, estimatedWeeks) },
      ],
      { ...callOpts, onRetry: retryFor(models.player), fallbackModels: fallbacksFor(models.player) }
    );

    const actionData = extractJSON<{ action: string }>(playerActionResp);
    const action = actionData?.action ?? playerActionResp;

    sendSSE({ type: 'player_action', round, action });

    // 3. C 环境给出反馈并判定客观状态
    const envFeedbackResp = await callLLM(
      keyFor(models.environment.provider),
      models.environment.provider,
      models.environment.id,
      [
        { role: 'system', content: getEnvironmentSystemPrompt(timeSpan) },
        {
          role: 'user',
          content: buildEnvironmentUserPrompt(action, {
            age: state.age,
            occupation: state.occupation,
            resources: state.resources,
            goal: state.goal,
          }, estimatedWeeks),
        },
      ],
      { ...callOpts, onRetry: retryFor(models.environment), fallbackModels: fallbacksFor(models.environment) }
    );

    const feedbackData = extractJSON<{
      feedback: string;
      state?: { elapsedWeeks?: number; keyEvents: string[]; resources: string };
    }>(envFeedbackResp);
    const feedback = feedbackData?.feedback ?? envFeedbackResp;

    // 时间推进：环境判定实际耗时（周）；年龄 = 初始年龄 + 累计周数/52
    // 客观世界事实（耗时/事件/资源）以 C 的判定为权威；目标完成度由 A 自评
    const elapsedWeeks = clampWeeks(
      feedbackData?.state?.elapsedWeeks,
      estimatedWeeks,
      timeSpan === '3years' ? 2 : 4
    );
    state.totalWeeks += elapsedWeeks;
    const newAge = Math.round((state.startAge + state.totalWeeks / 52) * 100) / 100;
    const newKeyEvents = feedbackData?.state?.keyEvents ?? [];
    const newResources = feedbackData?.state?.resources || state.resources;

    sendSSE({ type: 'env_feedback', round, feedback });

    // 4. A 执行者记录结果（自评完成度 + 可能修改目标）
    const playerRecordResp = await callLLM(
      keyFor(models.player.provider),
      models.player.provider,
      models.player.id,
      [
        { role: 'system', content: getPlayerSystemPrompt(timeSpan) },
        {
          role: 'user',
          content: buildPlayerRecordUserPrompt(feedback, {
            age: newAge,
            goal: state.goal,
            goalProgress: state.goalProgress,
          }),
        },
      ],
      { ...callOpts, onRetry: retryFor(models.player), fallbackModels: fallbacksFor(models.player) }
    );

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
    state.resources = newResources;
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

    sendSSE({
      type: 'player_record',
      round,
      result,
      goalChanged,
      newGoal,
    });

    const roundState: RoundState = {
      age: newAge,
      elapsedWeeks,
      totalWeeks: state.totalWeeks,
      goalProgress: newProgress,
      keyEvents: newKeyEvents,
      resources: state.resources,
      goal: state.goal,
    };

    sendSSE({ type: 'round_end', round, state: roundState });
  }

  // 5. B 教练生成人生总结
  const fullHistory = buildHistoryText(state);
  const summaryResp = await callLLM(
    keyFor(models.coach.provider),
    models.coach.provider,
    models.coach.id,
    [
      { role: 'system', content: getCoachSystemPrompt(timeSpan) },
      { role: 'user', content: buildCoachSummaryUserPrompt(fullHistory) },
    ],
    { ...callOpts, onRetry: retryFor(models.coach), fallbackModels: fallbacksFor(models.coach) }
  );

  const summary = extractJSON<Record<string, string>>(summaryResp);
  const report = summary?.report || summary?.['人生总结报告'] || summaryResp;

  sendSSE({ type: 'final_report', report });
}

/**
 * 从模拟状态构建历史摘要文本
 */
function buildHistoryText(state: SimState): string {
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
