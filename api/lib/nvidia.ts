/**
 * LLM API 客户端封装（NVIDIA NIM / OpenRouter）
 * OpenAI 兼容格式调用免费模型
 */

export type LLMProvider = 'nvidia' | 'openrouter';

const PROVIDER_BASE_URL: Record<LLMProvider, string> = {
  nvidia: 'https://integrate.api.nvidia.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  rateLimitMs?: number;
  /** 429 时依次切换的备用模型（同 provider），每个模型最多尝试 2 次 */
  fallbackModels?: string[];
  /** 单次请求超时 ms，默认 120s */
  timeoutMs?: number;
  /** 重试回调，用于向前端推送重试状态 */
  onRetry?: (info: { attempt: number; maxRetries: number; delayMs: number; reason: string }) => void;
}

/**
 * 调用 OpenAI 兼容 chat completions API（NVIDIA NIM / OpenRouter）
 * 包含 429 限速退避重试逻辑
 */
export async function callLLM(
  apiKey: string,
  provider: LLMProvider,
  model: string,
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<string> {
  const { temperature = 0.8, maxTokens = 1024, rateLimitMs = 2000, fallbackModels = [], timeoutMs = 120000, onRetry } = options;
  const baseUrl = PROVIDER_BASE_URL[provider];

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (provider === 'openrouter') {
    // OpenRouter 建议附带来源标识
    headers['HTTP-Referer'] = 'http://localhost:5173';
    headers['X-Title'] = 'Life Simulator';
  }

  // 模型链：主模型 + 备用，429 时依次切换；每模型最多尝试 2 次，每次退避递增
  const chain = [model, ...fallbackModels];
  const TRIES_PER_MODEL = 2;
  const totalMax = chain.length * TRIES_PER_MODEL;
  let lastError: Error | null = null;
  let attempt = 0;

  for (let ci = 0; ci < chain.length; ci++) {
    const currentModel = chain[ci];

    for (let t = 0; t < TRIES_PER_MODEL; t++) {
      attempt++;

      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: currentModel,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        // 429 限速：优先使用 Retry-After 头，否则指数退避；尝试用尽则切换下一个模型
        if (res.status === 429) {
          lastError = new Error(`${provider} 429 限速（${currentModel}）`);
          const hasNextTry = t < TRIES_PER_MODEL - 1 || ci < chain.length - 1;
          if (hasNextTry) {
            const retryAfterHeader = Number(res.headers.get('retry-after') ?? 0);
            const delayMs = retryAfterHeader > 0
              ? retryAfterHeader * 1000
              : Math.min(2000 * Math.pow(1.8, attempt - 1) + Math.random() * 1000, 30000);
            const willSwitch = t === TRIES_PER_MODEL - 1;
            console.log(`[${provider}] ${currentModel} 429，${willSwitch ? `切换到 ${chain[ci + 1]}` : `重试 ${t + 2}/${TRIES_PER_MODEL}`}，等待 ${Math.round(delayMs)}ms`);
            onRetry?.({
              attempt,
              maxRetries: totalMax,
              delayMs,
              reason: willSwitch ? `限速 (429)，切换模型 → ${chain[ci + 1]}` : '请求被限速 (429)',
            });
            await sleep(delayMs);
            continue;
          }
          break;
        }

        // 4xx 客户端错误：401/400 等请求级错误直接失败；
        // 402/403 及"模型不可用"类错误（如 OpenRouter 免费模型需充值额度）视为模型级失败，切换下一个模型
        if (res.status >= 400 && res.status < 500) {
          const errorText = await res.text();
          const modelLevel =
            res.status === 402 ||
            res.status === 403 ||
            /only available|requires? credits|not available|no endpoints|quota/i.test(errorText);
          if (modelLevel && ci < chain.length - 1) {
            lastError = new Error(`${provider} 模型不可用 ${res.status}（${currentModel}）`);
            const delayMs = 1000 + Math.random() * 500;
            console.log(`[${provider}] ${currentModel} 不可用 (${res.status})，切换到 ${chain[ci + 1]}`);
            onRetry?.({
              attempt,
              maxRetries: totalMax,
              delayMs,
              reason: `模型不可用 (${res.status})，切换模型 → ${chain[ci + 1]}`,
            });
            await sleep(delayMs);
            break; // 跳出内层，进入下一个模型
          }
          throw new Error(`${provider} API ${res.status}: ${errorText.slice(0, 300)}`);
        }

        if (!res.ok) {
          // 5xx 服务端错误：同模型重试一次，之后切换
          lastError = new Error(`${provider} API ${res.status}: ${(await res.text()).slice(0, 300)}`);
          const hasNextTry = t < TRIES_PER_MODEL - 1 || ci < chain.length - 1;
          if (hasNextTry) {
            const delayMs = 2000 + Math.random() * 1000;
            const willSwitch = t === TRIES_PER_MODEL - 1;
            console.log(`[${provider}] ${currentModel} ${res.status}，${willSwitch ? `切换到 ${chain[ci + 1]}` : '重试'}`);
            onRetry?.({
              attempt,
              maxRetries: totalMax,
              delayMs,
              reason: willSwitch ? `服务端错误 (${res.status})，切换模型 → ${chain[ci + 1]}` : `服务端错误 (${res.status})`,
            });
            await sleep(delayMs);
            continue;
          }
          break;
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error(`${provider} API 返回空内容`);
        }

        if (currentModel !== model) {
          console.log(`[${provider}] 成功通过备用模型 ${currentModel} 完成调用`);
        }

        // 速率控制：成功后等待指定时间
        await sleep(rateLimitMs);

        return content;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isTimeout = lastError.name === 'TimeoutError' || /abort|timeout/i.test(lastError.message);
        // 4xx 主动 throw 的错误不重试
        const isClientError = /API (4\d\d):/.test(lastError.message);
        const hasNextTry = !isClientError && (t < TRIES_PER_MODEL - 1 || ci < chain.length - 1);

        if (!hasNextTry) {
          console.error(`[${provider}] 调用最终失败（已尝试 ${chain.join(' → ')}）:`, lastError.message);
          throw lastError;
        }

        const willSwitch = t === TRIES_PER_MODEL - 1;
        const delayMs = isTimeout ? 3000 : 2000 + Math.random() * 1000;
        console.log(`[${provider}] ${currentModel} ${isTimeout ? '请求超时' : '调用失败'}，${willSwitch ? `切换到 ${chain[ci + 1]}` : '重试'}`);
        onRetry?.({
          attempt,
          maxRetries: totalMax,
          delayMs,
          reason: willSwitch
            ? `${isTimeout ? '请求超时' : '网络异常'}，切换模型 → ${chain[ci + 1]}`
            : isTimeout ? '请求超时' : '网络或响应异常',
        });
        await sleep(delayMs);
      }
    }
  }

  throw lastError ?? new Error(`${provider} API 调用失败`);
}

/**
 * 从 LLM 响应中提取 JSON
 * 支持：纯 JSON、markdown 代码块包裹的 JSON、混合文本中的 JSON
 */
export function extractJSON<T = Record<string, unknown>>(text: string): T | null {
  // 尝试直接解析
  try {
    return JSON.parse(text) as T;
  } catch {
    // 继续
  }

  // 尝试从 ```json ... ``` 代码块提取
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // 继续
    }
  }

  // 尝试从 { 到 } 的范围提取
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      // 继续
    }
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
