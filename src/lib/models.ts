/**
 * 可用模型列表（OpenRouter 免费池 + 魔搭 Flash，均支持浏览器直连）
 */

export type ModelProvider = "openrouter" | "modelscope";

export interface ModelInfo {
  id: string;
  label: string;
  description: string;
  provider: ModelProvider;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
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

  // 魔搭 ModelScope Flash 模型（实测可用，低消耗；其余模型因 429/400/推理消耗大已剔除）
  {
    id: "stepfun-ai/Step-3.7-Flash",
    label: "Step 3.7 Flash (MS)",
    description: "阶跃星辰 Flash，推理强，适合战略规划",
    provider: "modelscope",
  },
  {
    id: "Qwen/Qwen3.8-Flash-Next",
    label: "Qwen3.8 Flash Next (MS)",
    description: "通义千问最新 Flash，适合执行推演",
    provider: "modelscope",
  },
  {
    id: "stepfun-ai/Step-3.5-Flash",
    label: "Step 3.5 Flash (MS)",
    description: "阶跃星辰 Flash，适合环境模拟与角色扮演",
    provider: "modelscope",
  },
];

export const MODEL_MAP: Record<string, ModelInfo> = Object.fromEntries(
  AVAILABLE_MODELS.map((m) => [m.id, m])
);

/** 默认三角色模型（OpenRouter 免费池） */
export const DEFAULT_MODELS = {
  coach: "nvidia/nemotron-3.5-lightning:free",
  player: "thinkingmachines/inkling-small:free",
  environment: "google/gemma-4-26b-a4b-it:free",
};

/** 模型按 provider 分组，供 optgroup 渲染 */
export const MODEL_GROUPS: { label: string; provider: ModelProvider; models: ModelInfo[] }[] = [
  {
    label: "OpenRouter 免费池",
    provider: "openrouter",
    models: AVAILABLE_MODELS.filter((m) => m.provider === "openrouter"),
  },
  {
    label: "魔搭 Flash",
    provider: "modelscope",
    models: AVAILABLE_MODELS.filter((m) => m.provider === "modelscope"),
  },
];

/** 每个服务商的默认三角色模型 */
export const PROVIDER_DEFAULTS: Record<
  ModelProvider,
  { coach: string; player: string; environment: string }
> = {
  openrouter: {
    coach: "nvidia/nemotron-3.5-lightning:free",
    player: "thinkingmachines/inkling-small:free",
    environment: "google/gemma-4-26b-a4b-it:free",
  },
  modelscope: {
    coach: "stepfun-ai/Step-3.7-Flash",
    player: "Qwen/Qwen3.8-Flash-Next",
    environment: "stepfun-ai/Step-3.5-Flash",
  },
};
