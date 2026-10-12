/**
 * 可用模型列表（NVIDIA NIM + OpenRouter 免费池）
 */

export type ModelProvider = "nvidia" | "openrouter";

export interface ModelInfo {
  id: string;
  label: string;
  description: string;
  provider: ModelProvider;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  // NVIDIA NIM
  {
    id: "deepseek-ai/deepseek-v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    description: "552B MoE 推理强，适合战略规划与复杂分析",
    provider: "nvidia",
  },
  {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    label: "Nemotron 3.5 Lightning 30B",
    description: "30B 快速响应，适合执行推演与高频调用",
    provider: "nvidia",
  },
  {
    id: "z-ai/glm-5-3-flash",
    label: "GLM-5.3 Flash",
    description: "320B 多模态 MoE，适合环境模拟与角色扮演",
    provider: "nvidia",
  },
  {
    id: "z-ai/glm-5.3",
    label: "GLM-5.3",
    description: "753B 文本 MoE，推理与工具调用能力强",
    provider: "nvidia",
  },
  {
    id: "moonshotai/kimi-k3",
    label: "Kimi K3",
    description: "2.8T 超大 MoE，长程推理与 agentic 任务",
    provider: "nvidia",
  },
  {
    id: "meta/muse-glimmer-30b",
    label: "Muse Glimmer 30B",
    description: "Meta 多模态推理模型，原生工具调用",
    provider: "nvidia",
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    label: "Nemotron 3 Ultra 550B",
    description: "550B 超大 MoE，1M 上下文，适合长程规划",
    provider: "nvidia",
  },

  // OpenRouter 免费模型（$0/M tokens）
  {
    id: "thinkingmachines/inkling:free",
    label: "Inkling 975B (OR)",
    description: "Thinking Machines 多模态 MoE，1M 上下文，通用推理",
    provider: "openrouter",
  },
  {
    id: "thinkingmachines/inkling-small:free",
    label: "Inkling Small (OR)",
    description: "Inkling 轻量版，低延迟多模态",
    provider: "openrouter",
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron 3 Ultra (OR)",
    description: "550B 混合 MoE，1M 上下文，多步推理与规划",
    provider: "openrouter",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 3 Super (OR)",
    description: "120B MoE 仅激活 12B，多智能体应用优化",
    provider: "openrouter",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    label: "Nemotron 3.5 Lightning (OR)",
    description: "1M 上下文快速响应模型",
    provider: "openrouter",
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    label: "Nemotron 3 Nano Omni (OR)",
    description: "30B-A3B 多模态，支持推理模式",
    provider: "openrouter",
  },
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B (OR)",
    description: "Google 稠密 30.7B 多模态，140+ 语言",
    provider: "openrouter",
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    label: "Gemma 4 26B A4B (OR)",
    description: "MoE 仅激活 3.8B，近 31B 质量，原生函数调用",
    provider: "openrouter",
  },
];

export const MODEL_MAP: Record<string, ModelInfo> = Object.fromEntries(
  AVAILABLE_MODELS.map((m) => [m.id, m])
);

export const DEFAULT_MODELS = {
  coach: "deepseek-ai/deepseek-v4.1-flash",
  player: "nvidia/nemotron-3.5-lightning-30b-a3b",
  environment: "z-ai/glm-5.3-flash",
};

/** 模型按 provider 分组，供 optgroup 渲染 */
export const MODEL_GROUPS: { label: string; provider: ModelProvider; models: ModelInfo[] }[] = [
  {
    label: "NVIDIA NIM",
    provider: "nvidia",
    models: AVAILABLE_MODELS.filter((m) => m.provider === "nvidia"),
  },
  {
    label: "OpenRouter 免费池",
    provider: "openrouter",
    models: AVAILABLE_MODELS.filter((m) => m.provider === "openrouter"),
  },
];

/** 每个服务商的默认三角色模型 */
export const PROVIDER_DEFAULTS: Record<
  ModelProvider,
  { coach: string; player: string; environment: string }
> = {
  nvidia: {
    coach: "deepseek-ai/deepseek-v4.1-flash",
    player: "nvidia/nemotron-3.5-lightning-30b-a3b",
    environment: "z-ai/glm-5.3-flash",
  },
  openrouter: {
    coach: "nvidia/nemotron-3.5-lightning:free",
    player: "thinkingmachines/inkling-small:free",
    environment: "google/gemma-4-26b-a4b-it:free",
  },
};
