/**
 * 配置页 - 输入现状、目标、API Key、模型选择
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket, Eye, EyeOff, ChevronDown } from "lucide-react";
import { AVAILABLE_MODELS, PROVIDER_DEFAULTS, DEFAULT_MODELS } from "@/lib/models";
import type { ModelProvider } from "@/store/simStore";
import { useSimulation } from "@/hooks/useSimulation";
import { cn } from "@/lib/utils";

const PROVIDER_OPTIONS: { value: ModelProvider; label: string; hint: string }[] = [
  { value: "nvidia", label: "NVIDIA NIM", hint: "build.nvidia.com 免费额度" },
  { value: "openrouter", label: "OpenRouter 免费池", hint: "openrouter.ai 免费模型 $0/1M" },
];

export default function Setup() {
  const navigate = useNavigate();
  const { begin } = useSimulation();

  const [provider, setProvider] = useState<ModelProvider>("nvidia");
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [orKey, setOrKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [age, setAge] = useState(25);
  const [occupation, setOccupation] = useState("");
  const [resources, setResources] = useState("");
  const [goal, setGoal] = useState("");
  const [rounds, setRounds] = useState(10);
  const [rateLimitMs, setRateLimitMs] = useState(2000);
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const activeKey = provider === "nvidia" ? nvidiaKey : orKey;
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
        currentGoal: goal.trim(),
      },
      rounds,
      rateLimitMs,
    });
    navigate("/simulate");
  };

  return (
    <div className="relative min-h-screen">
      <div className="starfield" />
      <div className="relative z-10 flex items-center justify-center min-h-screen px-6 py-12">
        <div className="w-full max-w-3xl">
          {/* 标题区 */}
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
                {provider === "nvidia" ? "NVIDIA API Key" : "OpenRouter API Key"}
                <span className="text-amber/80 ml-1">*</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={activeKey}
                  onChange={(e) =>
                    provider === "nvidia" ? setNvidiaKey(e.target.value) : setOrKey(e.target.value)
                  }
                  placeholder={provider === "nvidia" ? "nvapi-xxxx..." : "sk-or-v1-xxxx..."}
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
                      min={5}
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full bg-midnight-950/60 border rounded-lg px-3 py-2.5 text-starwhite text-sm",
          "focus:outline-none focus:ring-1",
          colorMap[color]
        )}
      >
        {AVAILABLE_MODELS.filter((m) => m.provider === provider).map((m) => (
          <option key={m.id} value={m.id} className="bg-midnight-900">
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
