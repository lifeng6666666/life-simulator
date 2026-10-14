/**
 * 推演广场 - 查看/导入他人分享的推演
 * 纯前端实现：推演内容编码在分享链接的 URL 中，无服务器存储
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Share2, Target, Cpu, Calendar, FolderOpen, ShieldCheck, Loader2 } from "lucide-react";
import LifeStages from "@/components/LifeStages";
import { formatAge } from "@/lib/stages";
import { decodeRun, sharedToRoundData, type SharedRun } from "@/lib/share";

type SharedState =
  | { status: "loading" }
  | { status: "ok"; run: SharedRun }
  | { status: "invalid" };

export default function Gallery() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const raw = params.get("r");
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [shared, setShared] = useState<SharedState | null>(null);

  useEffect(() => {
    if (!raw) {
      setShared(null);
      return;
    }
    setShared({ status: "loading" });
    let alive = true;
    decodeRun(raw)
      .then((run) => alive && setShared({ status: "ok", run }))
      .catch(() => alive && setShared({ status: "invalid" }));
    return () => {
      alive = false;
    };
  }, [raw]);

  const handleImport = useCallback(() => {
    setImportError(null);
    const code = importCode.trim();
    if (!code) return;
    const q = code.indexOf("?r=");
    if (q < 0) {
      setImportError("未识别的分享内容：请粘贴完整的分享链接");
      return;
    }
    navigate(`/gallery?r=${code.slice(q + 3)}`);
  }, [importCode, navigate]);

  return (
    <div className="relative min-h-screen">
      <div className="starfield" />
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-starwhite/50 hover:text-amber"
          >
            <ArrowLeft size={16} />
            返回首页
          </button>
          <div className="flex items-center gap-2 text-starwhite/40">
            <Share2 size={16} />
            <span className="text-sm">推演广场</span>
          </div>
        </div>

        {raw ? (
          shared?.status === "ok" ? (
            <SharedDetail run={shared.run} />
          ) : shared?.status === "loading" ? (
            <div className="glass rounded-2xl py-16 text-center">
              <Loader2 className="mx-auto mb-3 text-amber/60 animate-spin" size={28} />
              <p className="text-starwhite/40 text-sm">正在解码分享内容…</p>
            </div>
          ) : shared?.status === "invalid" ? (
            <div className="glass rounded-2xl py-16 text-center">
              <Share2 className="mx-auto mb-3 text-red-400/60" size={36} />
              <p className="text-starwhite/60 text-sm">分享链接无效或已损坏</p>
            </div>
          ) : null
        ) : (
          <ImportView
            importCode={importCode}
            importError={importError}
            onImportCode={setImportCode}
            onImport={handleImport}
          />
        )}

        <div className="h-20" />
      </div>
    </div>
  );
}

function ImportView({
  importCode,
  importError,
  onImportCode,
  onImport,
}: {
  importCode: string;
  importError: string | null;
  onImportCode: (v: string) => void;
  onImport: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-8">
        <h2 className="font-serif text-xl text-starwhite mb-2">导入一份推演</h2>
        <p className="text-xs text-starwhite/40 mb-5 leading-relaxed">
          在「历史推演」页点击分享图标，即可复制某次推演的专属链接；把它粘贴到这里，就能查看这场推演的完整历程。
        </p>
        <div className="flex gap-2">
          <input
            value={importCode}
            onChange={(e) => onImportCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onImport()}
            placeholder="粘贴分享链接…"
            spellCheck={false}
            className="flex-1 bg-midnight-950/60 border border-midnight-600 rounded-lg px-4 py-3 text-starwhite text-sm focus:outline-none focus:ring-1 focus:ring-amber/50 placeholder:text-starwhite/25"
          />
          <button
            onClick={onImport}
            className="flex items-center gap-2 px-5 py-3 rounded-lg bg-amber/15 border border-amber/40 text-amber text-sm hover:bg-amber/25 transition-colors"
          >
            <FolderOpen size={16} />
            查看
          </button>
        </div>
        {importError && <p className="text-red-400/80 text-xs mt-2">{importError}</p>}
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={18} className="text-amber/80 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-starwhite/40 leading-relaxed">
            <p className="text-starwhite/60 mb-1">隐私说明</p>
            <p>
              分享链接只包含推演内容（人生设定、各轮规划与结果、总结报告），
              <span className="text-amber/80">永远不包含你的 API Key</span>。
              你的 key 只在浏览器内存中用于直连模型服务商，不经过任何服务器，也不会被记录或公开。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SharedDetail({ run }: { run: SharedRun }) {
  return (
    <div>
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex items-start gap-2.5 mb-4">
          <Target size={18} className="text-amber mt-1 flex-shrink-0" />
          <div>
            <h1 className="font-serif text-xl text-starwhite leading-snug">{run.finalGoal}</h1>
            <p className="text-xs text-starwhite/40 mt-1.5 font-mono">
              {new Date(run.createdAt).toLocaleString("zh-CN")} · 来自分享 · {run.providerLabel} ·{" "}
              {run.modelsLabel}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <StatBox label="初始年龄" value={formatAge(run.situation.age)} />
          <StatBox label="最终年龄" value={formatAge(run.finalAge)} />
          <StatBox label="完成轮数" value={`${run.rounds.length}/${run.totalRounds}`} />
          <StatBox label="目标完成度" value={`${run.goalProgress}%`} highlight />
        </div>
        <div className="mt-4 pt-4 border-t border-midnight-600/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-starwhite/40">
          <span className="flex items-center gap-1.5">
            <Cpu size={11} /> 职业：{run.situation.occupation}
          </span>
          <span>初始资源：{run.situation.resources}</span>
          <span className="flex items-center gap-1.5">
            <Calendar size={11} /> {run.completed ? "完整推演" : "未完成推演"}
          </span>
        </div>
      </div>

      <LifeStages
        rounds={run.rounds.map(sharedToRoundData)}
        startGoal={run.situation.goal}
        startAge={run.situation.age}
        startProgress={0}
        finalReport={run.finalReport}
      />
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-midnight-800/60 py-3">
      <p className="text-[10px] text-starwhite/35 mb-0.5">{label}</p>
      <p className={highlight ? "font-mono text-amber text-lg" : "font-mono text-starwhite/80"}>{value}</p>
    </div>
  );
}
