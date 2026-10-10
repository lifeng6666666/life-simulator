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
} from './prompts.js';

export interface ModelSpec {
  id: string;
  provider: LLMProvider;
}

export interface SimulateRequest {
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

export interface RoundState {
  age: number;
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
  age: number;
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
    goalProgress: number;
    keyEvents: string[];
  }[];
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
  const state: SimState = {
    age: req.situation.age,
    goal: req.situation.currentGoal,
    goalProgress: 0,
    resources: req.situation.resources,
    occupation: req.situation.occupation,
    keyEvents: [],
    rounds: [],
  };

  const { models, rateLimitMs } = req;
  const callOpts = { rateLimitMs, maxTokens: 1024, temperature: 0.85 };

  const keyFor = (provider: LLMProvider): string => {
    const key = provider === 'nvidia' ? req.apiKeys.nvidia : req.apiKeys.openrouter;
    if (!key) {
      throw new Error(provider === 'nvidia' ? '缺少 NVIDIA API Key' : '缺少 OpenRouter API Key');
    }
    return key;
  };

  const agentName = (spec: ModelSpec): string =>
    spec.provider === 'openrouter' ? 'openrouter' : 'nvidia';

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
    'z-ai/glm-5-3-flash',
    'deepseek-ai/deepseek-v4.1-flash',
    'meta/muse-glimmer-30b',
  ];
  const fallbacksFor = (spec: ModelSpec): string[] => {
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

  for (let round = 1; round <= req.rounds; round++) {
    sendSSE({ type: 'round_start', round });

    const historyText = buildHistoryText(state);

    // 1. B 教练生成规划
    const coachPlanResp = await callLLM(
      keyFor(models.coach.provider),
      models.coach.provider,
      models.coach.id,
      [
        { role: 'system', content: getCoachSystemPrompt() },
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

    const plan = extractJSON<{ overallPlan: string; nextStep: string }>(coachPlanResp);
    const overallPlan = plan?.overallPlan ?? coachPlanResp;
    const nextStep = plan?.nextStep ?? '继续推进当前目标';

    sendSSE({ type: 'coach_plan', round, overallPlan, nextStep });

    // 2. A 执行者执行行动
    const playerActionResp = await callLLM(
      keyFor(models.player.provider),
      models.player.provider,
      models.player.id,
      [
        { role: 'system', content: getPlayerSystemPrompt() },
        { role: 'user', content: buildPlayerActionUserPrompt(nextStep) },
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
        { role: 'system', content: getEnvironmentSystemPrompt() },
        {
          role: 'user',
          content: buildEnvironmentUserPrompt(action, {
            age: state.age,
            occupation: state.occupation,
            resources: state.resources,
            goal: state.goal,
          }),
        },
      ],
      { ...callOpts, onRetry: retryFor(models.environment), fallbackModels: fallbacksFor(models.environment) }
    );

    const feedbackData = extractJSON<{
      feedback: string;
      state?: { age: number; keyEvents: string[]; resources: string };
    }>(envFeedbackResp);
    const feedback = feedbackData?.feedback ?? envFeedbackResp;

    // 客观世界事实（年龄/事件/资源）以 C 的判定为权威；目标完成度由 A 自评
    const newAge = feedbackData?.state?.age ?? state.age + 1;
    const newKeyEvents = feedbackData?.state?.keyEvents ?? [];
    const newResources = feedbackData?.state?.resources || state.resources;

    sendSSE({ type: 'env_feedback', round, feedback });

    // 4. A 执行者记录结果（自评完成度 + 可能修改目标）
    const playerRecordResp = await callLLM(
      keyFor(models.player.provider),
      models.player.provider,
      models.player.id,
      [
        { role: 'system', content: getPlayerSystemPrompt() },
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
      { role: 'system', content: getCoachSystemPrompt() },
      { role: 'user', content: buildCoachSummaryUserPrompt(fullHistory) },
    ],
    { ...callOpts, maxTokens: 2048, onRetry: retryFor(models.coach), fallbackModels: fallbacksFor(models.coach) }
  );

  const summary = extractJSON<{ report: string }>(summaryResp);
  const report = summary?.report ?? summaryResp;

  sendSSE({ type: 'final_report', report });
}

/**
 * 从模拟状态构建历史摘要文本
 */
function buildHistoryText(state: SimState): string {
  if (state.rounds.length === 0) {
    return `【初始状态】年龄${state.age}岁，职业：${state.occupation}，目标：${state.goal}，资源：${state.resources}`;
  }

  const lines = state.rounds.map((r, i) => {
    return `--- 第${i + 1}轮（${r.age}岁）---
规划：${r.nextStep}
执行：${r.action}
环境反馈：${r.envFeedback}
结果：${r.result}
目标完成度：${r.goalProgress}%${r.keyEvents.length > 0 ? '\n关键事件：' + r.keyEvents.join('；') : ''}`;
  });

  return `【初始状态】年龄${state.age - state.rounds.length}岁，目标：${state.goal}
${lines.join('\n\n')}`;
}
