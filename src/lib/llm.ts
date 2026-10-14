/**
 * 浏览器端 LLM 客户端：直连 OpenAI 兼容接口（OpenRouter / ModelScope / NVIDIA）
 * - key 只存在于浏览器内存，不经过任何中间服务器
 * - 内置 429/网络错误退避重试
 */

export type LLMProvider = 'nvidia' | 'openrouter' | 'modelscope';

const PROVIDER_BASE_URL: Record<LLMProvider, string> = {
  nvidia: 'https://integrate.api.nvidia.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  modelscope: 'https://api-inference.modelscope.cn/v1',
};

/** 是否支持浏览器直连（CORS 已验证） */
export const BROWSER_FRIENDLY: Record<LLMProvider, boolean> = {
  nvidia: false,
  openrouter: true,
  modelscope: true,
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  rateLimitMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onRetry?: (info: { attempt: number; maxRetries: number; delayMs: number; reason: string }) => void;
}

const MAX_RETRIES = 2;
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

/**
 * 调用 OpenAI 兼容 chat completions API，返回首个 choice 的文本
 */
export async function callLLM(
  apiKey: string,
  provider: LLMProvider,
  model: string,
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<string> {
  const { temperature = 0.8, maxTokens = 1024, rateLimitMs = 2000, timeoutMs = 120000, signal, onRetry } = options;

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (rateLimitMs > 0) await sleep(rateLimitMs, signal);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = location.origin;
    headers['X-Title'] = 'Life Simulator';
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const res = await fetch(`${PROVIDER_BASE_URL[provider]}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
        signal: signal ?? AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
        if (attempt <= MAX_RETRIES) {
          const delayMs = attempt * 4000;
          onRetry?.({ attempt, maxRetries: MAX_RETRIES, delayMs, reason: `HTTP ${res.status}，退避重试` });
          await sleep(delayMs, signal);
          continue;
        }
        throw new Error(`模型请求失败（HTTP ${res.status}，已重试 ${MAX_RETRIES} 次）`);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`模型请求失败（HTTP ${res.status}）：${text.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('模型返回内容为空');
      }
      return content;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // 浏览器直连被 CORS 拦截时 fetch 抛 TypeError
      if (err instanceof TypeError) {
        const hint = BROWSER_FRIENDLY[provider]
          ? '网络连接失败，请检查网络'
          : '浏览器直连被该服务商的 CORS 策略拦截，请改用 OpenRouter 或 ModelScope 服务商';
        throw new Error(`${hint}（${provider}）`);
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt > MAX_RETRIES) throw lastError;
      // 非限速错误也会走一次重试（网络抖动）
      const delayMs = attempt * 4000;
      onRetry?.({ attempt, maxRetries: MAX_RETRIES, delayMs, reason: lastError.message.slice(0, 80) });
      await sleep(delayMs, signal);
    }
  }

  throw lastError ?? new Error('模型请求失败');
}

/** 从模型回复中提取 JSON 对象（容忍 markdown 代码块、前后杂质） */
export function extractJSON<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 从第一个 { 到最后一个 } 再试
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
