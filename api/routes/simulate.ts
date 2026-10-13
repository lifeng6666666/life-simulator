/**
 * 模拟路由 - SSE 推送模拟过程
 */

import { Router, type Request, type Response } from 'express';
import { runSimulation, type SimulateRequest, type SSEEvent } from '../lib/simulation.js';

const router = Router();

/**
 * POST /api/simulate
 * 启动模拟，通过 SSE 推送每轮结果
 */
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as Partial<SimulateRequest>;

  // 参数校验
  if (!body.models || !body.models.coach || !body.models.player || !body.models.environment) {
    res.status(400).json({ error: '缺少模型配置' });
    return;
  }

  // 根据所选模型涉及的 provider 校验对应 API Key
  const specs = [body.models.coach, body.models.player, body.models.environment];
  const needsNvidia = specs.some((m) => m.provider === 'nvidia');
  const needsOpenRouter = specs.some((m) => m.provider === 'openrouter');

  if (needsNvidia && !body.apiKeys?.nvidia) {
    res.status(400).json({ error: '所选模型包含 NVIDIA 模型，缺少 NVIDIA API Key' });
    return;
  }
  if (needsOpenRouter && !body.apiKeys?.openrouter) {
    res.status(400).json({ error: '所选模型包含 OpenRouter 模型，缺少 OpenRouter API Key' });
    return;
  }

  if (!body.situation || !body.situation.currentGoal) {
    res.status(400).json({ error: '缺少人生目标' });
    return;
  }

  const rounds = Math.min(Math.max(body.rounds ?? 10, 1), 30);
  const rateLimitMs = Math.min(Math.max(body.rateLimitMs ?? 2000, 500), 10000);

  const simReq: SimulateRequest = {
    apiKeys: {
      nvidia: body.apiKeys?.nvidia,
      openrouter: body.apiKeys?.openrouter,
      modelscope: body.apiKeys?.modelscope,
    },
    models: body.models,
    situation: {
      age: body.situation.age ?? 25,
      occupation: body.situation.occupation ?? '未知',
      resources: body.situation.resources ?? '无',
      currentGoal: body.situation.currentGoal,
    },
    rounds,
    rateLimitMs,
    resume: body.resume,
  };

  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // 心跳保活
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // 发送 SSE 事件
  const sendSSE = (event: SSEEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await runSimulation(simReq, sendSSE);
  } catch (err) {
    const message = err instanceof Error ? err.message : '模拟过程中发生未知错误';
    sendSSE({ type: 'error', message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
