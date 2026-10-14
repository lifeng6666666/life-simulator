/**
 * 配置页 - 输入现状、目标、API Key、模型选择
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket, Eye, EyeOff, ChevronDown, History, Share2 } from "lucide-react";
import { AVAILABLE_MODELS, PROVIDER_DEFAULTS, DEFAULT_MODELS } from "@/lib/models";
import type { ModelProvider, TimeSpan } from "@/store/simStore";
import { useSimulation } from "@/hooks/useSimulation";
import { cn } from "@/lib/utils";

const PROVIDER_OPTIONS: { value: ModelProvider; label: string; hint: string }[] = [
  { value: "nvidia", label: "NVIDIA NIM", hint: "build.nvidia.com 免费额度" },
  { value: "openrouter", label: "OpenRouter 免费池", hint: "openrouter.ai 免费模型 $0/1M" },
  { value: "modelscope", label: "魔搭 ModelScope", hint: "modelscope.cn Flash 模型低消耗" },
];

/** 时间跨度档位选项 */
const TIME_SPAN_OPTIONS: { value: TimeSpan; label: string; hint: string }[] = [
  {
    value: "3years",
    label: "节奏快 · 约3年",
    hint: "每轮 2-16 周：小行动 2-6 周，大节点 8-16 周（一个季度以内）",
  },
  {
    value: "5years",
    label: "按季度 · 约5年",
    hint: "每轮约一个季度（12 周左右），每个阶段稳扎稳打",
  },
];

/** 表单预填默认值：从本地 .env.local 读取（不提交到 Git），缺失则为空需手动填写 */
const DEFAULTS = {
  nvidiaKey: (import.meta.env.VITE_NVIDIA_KEY as string | undefined) ?? "",
  orKey: (import.meta.env.VITE_OPENROUTER_KEY as string | undefined) ?? "",
  msKey: (import.meta.env.VITE_MODELSCOPE_KEY as string | undefined) ?? "",
  age: 25,
  occupation: "程序员",
  resources: "存款5万",
  traits: "拖延，但关键时刻靠得住",
  goal: "赢取白富美",
};

export default function Setup() {
  const navigate = useNavigate();
  const { begin } = useSimulation();

  const [provider, setProvider] = useState<ModelProvider>("openrouter");
  const [nvidiaKey, setNvidiaKey] = useState(DEFAULTS.nvidiaKey);
  const [orKey, setOrKey] = useState(DEFAULTS.orKey);
  const [msKey, setMsKey] = useState(DEFAULTS.msKey);
  const [showKey, setShowKey] = useState(false);
  const [age, setAge] = useState(DEFAULTS.age);
  const [occupation, setOccupation] = useState(DEFAULTS.occupation);
  const [resources, setResources] = useState(DEFAULTS.resources);
  const [traits, setTraits] = useState(DEFAULTS.traits);
  const [goal, setGoal] = useState(DEFAULTS.goal);
  const [rounds, setRounds] = useState(10);
  const [timeSpan, setTimeSpan] = useState<TimeSpan>("5years");
  const [rateLimitMs, setRateLimitMs] = useState(2000);
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const activeKey = provider === "nvidia" ? nvidiaKey : provider === "modelscope" ? msKey : orKey;
  const canStart = goal.trim() && activeKey.trim();

  const handleProviderChange = (p: ModelProvider) => {
    setProvider(p);
    setModels(PROVIDER_DEFAULTS[p]);
  };

  const handleStart = () => {
    if (!canStart) return;
    begin({
      apiKeys: {
        nvidia: nvidiaKey.trim() || undefined,
        openrouter: orKey.trim() || undefined,
        modelscope: msKey.trim() || undefined,
      },
      models: {
        coach: { id: models.coach, provider },
        player: { id: models.player, provider },
        environment: { id: models.environment, provider },
      },
      situation: {
        age,
        occupation: occupation || "未填写",
        resources: resources || "无",
        traits: traits.trim(),
        currentGoal: goal.trim(),
      },
      rounds,
      rateLimitMs,
      timeSpan,
    });
    navigate("/simulate");
  };

  return (
    <div className="relative min-h-screen">
      <div className="starfield" />
      <div className="relative z-10 flex items-center justify-center min-h-screen px-6 py-12">
        <div className="w-full max-w-3xl">
          {/* 标题区 */}
          {/* 历史入口 */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => navigate("/history")}
              className="flex items-center gap-1.5 text-sm text-starwhite/40 hover:text-amber transition-colors"
            >
              <History size={15} />
              历史推演
            </button>
          </div>

          <div className="text-center mb-10 animate-slide-up">
            <p className="font-mono text-xs tracking-[0.4em] text-amber/60 uppercase mb-3">
              Life Simulator
            </p>
            <h1 className="font-serif text-5xl md:text-6xl font-light text-starwhite mb-4">
              人生<span className="text-amber italic">推演</span>仪
            </h1>
            <p className="text-starwhite/50 text-sm max-w-xl mx-auto leading-relaxed">
              三个大模型分别扮演执行者、教练与现实环境，在循环推演中模拟人生轨迹
            </p>
          </div>

          {/* 配置卡片 */}
          <div className="glass rounded-2xl p-8 space-y-7 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            {/* 模型服务 */}
            <div>
              <label className="block text-sm text-starwhite/70 mb-2 font-medium">
                模型服务
                <span className="text-amber/80 ml-1">*</span>
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as ModelProvider)}
                className="input-glow w-full bg-midnight-950/60 border border-midnight-600 rounded-lg px-4 py-3 text-starwhite text-sm"
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value} className="bg-midnight-900">
                    {p.label} — {p.hint}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm text-starwhite/70 mb-2 font-medium">
                {provider === "nvidia"
                  ? "NVIDIA API Key"
                  : provider === "modelscope"
                    ? "ModelScope 令牌 (Token)"
                    : "OpenRouter API Key"}
                <span className="text-amber/80 ml-1">*</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={activeKey}
                  onChange={(e) => {
                    if (provider === "nvidia") setNvidiaKey(e.target.value);
                    else if (provider === "modelscope") setMsKey(e.target.value);
                    else setOrKey(e.target.value);
                  }}
                  placeholder={
                    provider === "nvidia"
                      ? "nvapi-xxxx..."
                      : provider === "modelscope"
                        ? "ms-xxxx-xxxx..."
                        : "sk-or-v1-xxxx..."
                  }
                  className="input-glow w-full bg-midnight-950/60 border border-midnight-600 rounded-lg px-4 py-3 pr-12 text-starwhite text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-starwhite/40 hover:text-amber"
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-starwhite/40 mt-1.5">
                {provider === "nvidia" ? (
                  <>
                    从{" "}
                    <a
                      href="https://build.nvidia.com/models"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber/70 hover:text-amber underline"
                    >
                      build.nvidia.com
                    </a>{" "}
                    获取免费 API Key
                  </>
                ) : provider === "modelscope" ? (
                  <>
                    从{" "}
                    <a
                      href="https://modelscope.cn/my/myaccesstoken"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber/70 hover:text-amber underline"
                    >
                      modelscope.cn 访问令牌
                    </a>{" "}
                    获取（Flash 模型消耗量小）
                  </>
                ) : (
                  <>
                    从{" "}
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber/70 hover:text-amber underline"
                    >
                      openrouter.ai/keys
                    </a>{" "}
                    获取（免费模型 $0/1M tokens）
                  </>
                )}
              </p>
            </div>

            {/* 模型选择 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ModelSelector
                label="B 教练"
                color="coach"
                provider={provider}
                value={models.coach}
                onChange={(v) => setModels({ ...models, coach: v })}
              />
              <ModelSelector
                label="A 执行者"
                color="player"
                provider={provider}
                value={models.player}
                onChange={(v) => setModels({ ...models, player: v })}
              />
              <ModelSelector
                label="C 环境"
                color="env"
                provider={provider}
                value={models.environment}
                onChange={(v) => setModels({ ...models, environment: v })}
              />
            </div>

            {/* 现状输入 */}
            <div className="border-t border-midnight-600/50 pt-6 space-y-5">
              <h2 className="font-serif text-xl text-starwhite/90">人生现状</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-starwhite/60 mb-1.5">年龄</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    min={10}
                    max={80}
                    className="input-glow w-full bg-midnight-950/60 border border-midnight-600 rounded-lg px-4 py-2.5 text-starwhite text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-starwhite/60 mb-1.5">职业</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="如：程序员、学生、自由职业"
                    className="input-glow w-full bg-midnight-950/60 border border-midnight-600 rounded-lg px-4 py-2.5 text-starwhite text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-starwhite/60 mb-1.5">
                  资源状况
                  <span className="text-starwhite/30 ml-1 text-xs">（资金、技能、人脉等）</span>
                </label>
                <textarea
                  value={resources}
                  onChange={(e) => setResources(e.target.value)}
                  rows={2}
                  placeholder="如：存款5万，会编程，有几个朋友但缺乏行业人脉"
                  className="input-glow w-full bg-midnight-950/60 border border-midnight-600 rounded-lg px-4 py-2.5 text-starwhite text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-starwhite/60 mb-1.5">
                  性格与特质
                  <span className="text-starwhite/30 ml-1 text-xs">（影响执行难度与现实反应，可留空）</span>
                </label>
                <input
                  type="text"
                  value={traits}
                  onChange={(e) => setTraits(e.target.value)}
                  placeholder="如：拖延、社恐 / 自律、外向、漂亮"
                  className="input-glow w-full bg-midnight-950/60 border border-midnight-600 rounded-lg px-4 py-2.5 text-starwhite text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-starwhite/60 mb-1.5">
                  人生目标
                  <span className="text-amber/80 ml-1">*</span>
                </label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={3}
                  placeholder="如：30岁前实现财务自由，创办一家有影响力的科技公司"
                  className="input-glow w-full bg-midnight-950/60 border border-midnight-600 rounded-lg px-4 py-2.5 text-starwhite text-sm resize-none"
                />
              </div>
            </div>

            {/* 时间跨度 */}
            <div className="border-t border-midnight-600/50 pt-6">
              <h2 className="font-serif text-xl text-starwhite/90">时间跨度</h2>
              <p className="text-xs text-starwhite/40 mt-1 mb-3">
                每轮推演代表多长时间，决定总跨度（10 轮 ≈ 1.5 年 / 2.5 年）
              </p>
              <div className="grid grid-cols-2 gap-3">
                {TIME_SPAN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTimeSpan(opt.value)}
                    className={cn(
                      "text-left rounded-xl border px-4 py-3 transition-all",
                      timeSpan === opt.value
                        ? "border-amber bg-amber/10"
                        : "border-midnight-600 hover:border-midnight-500"
                    )}
                  >
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        timeSpan === opt.value ? "text-amber" : "text-starwhite/80"
                      )}
                    >
                      {opt.label}
                    </span>
                    <span className="block text-xs text-starwhite/40 mt-1 leading-relaxed">
                      {opt.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 高级设置 */}
            <div className="border-t border-midnight-600/50 pt-5">
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="flex items-center gap-2 text-sm text-starwhite/60 hover:text-amber"
              >
                <ChevronDown
                  size={16}
                  className={cn("transition-transform", advancedOpen && "rotate-180")}
                />
                高级设置
              </button>

              {advancedOpen && (
                <div className="mt-4 space-y-5 animate-slide-up">
                  <div>
                    <label className="flex items-center justify-between text-sm text-starwhite/60 mb-2">
                      <span>模拟轮次</span>
                      <span className="font-mono text-amber">{rounds} 轮</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={rounds}
                      onChange={(e) => setRounds(Number(e.target.value))}
                      className="w-full accent-amber"
                    />
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-sm text-starwhite/60 mb-2">
                      <span>请求间隔（避免限速）</span>
                      <span className="font-mono text-amber">{rateLimitMs} ms</span>
                    </label>
                    <input
                      type="range"
                      min={500}
                      max={5000}
                      step={500}
                      value={rateLimitMs}
                      onChange={(e) => setRateLimitMs(Number(e.target.value))}
                      className="w-full accent-amber"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 开始按钮 */}
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={cn(
                "w-full flex items-center justify-center gap-3 py-4 rounded-xl font-medium text-base transition-all",
                canStart
                  ? "bg-amber text-midnight-950 hover:bg-amber-light hover:shadow-[0_0_30px_rgba(212,165,116,0.3)]"
                  : "bg-midnight-700 text-starwhite/30 cursor-not-allowed"
              )}
            >
              <Rocket size={20} />
              开始推演
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelSelector({
  label,
  color,
  provider,
  value,
  onChange,
}: {
  label: string;
  color: "coach" | "player" | "env";
  provider: ModelProvider;
  value: string;
  onChange: (v: string) => void;
}) {
  const colorMap = {
    coach: "border-agent-coach/40 focus-within:border-agent-coach",
    player: "border-agent-player/40 focus-within:border-agent-player",
    env: "border-agent-env/40 focus-within:border-agent-env",
  };

  return (
    <div>
      <label className={cn("block text-sm mb-1.5", `text-agent-${color}Light`)}>
        {label}
      </label>
      <input
        list={`model-options-${color}`}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder="选择或输入模型 ID"
        spellCheck={false}
        className={cn(
          "w-full bg-midnight-950/60 border rounded-lg px-3 py-2.5 text-starwhite text-sm font-mono",
          "focus:outline-none focus:ring-1 placeholder:text-starwhite/25",
          colorMap[color]
        )}
      />
      <datalist id={`model-options-${color}`}>
        {AVAILABLE_MODELS.filter((m) => m.provider === provider).map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}
