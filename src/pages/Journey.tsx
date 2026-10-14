/**
 * 人生历程页 - 以目标为轴分阶段展示
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, History } from "lucide-react";
import { useSimStore } from "@/store/simStore";
import LifeStages from "@/components/LifeStages";
import { formatAge } from "@/lib/stages";

export default function Journey() {
  const navigate = useNavigate();
  const { rounds, finalReport, age, goalProgress, goal, config } = useSimStore();

  useEffect(() => {
    if (rounds.length === 0) {
      navigate("/");
    }
  }, [rounds.length, navigate]);

  if (rounds.length === 0) {
    return null;
  }

  // 无 config（如刷新后）时用首轮耗时反推初始年龄
  const firstElapsed = rounds[0]?.elapsedWeeks ?? 13;
  const startAge =
    config?.situation.age ?? Math.max((rounds[0]?.age ?? age) - firstElapsed / 52, 1);
  const startGoal = config?.situation.currentGoal ?? goal;

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
            新的推演
          </button>
          <button
            onClick={() => navigate("/history")}
            className="flex items-center gap-2 text-sm text-starwhite/50 hover:text-amber"
          >
            <History size={16} />
            历史推演
          </button>
        </div>

        {/* 总览卡片 */}
        <div className="glass rounded-2xl p-8 mb-10 text-center animate-slide-up">
          <Compass className="mx-auto mb-3 text-amber" size={32} />
          <h1 className="font-serif text-4xl text-starwhite mb-2">人生历程</h1>
          <p className="text-starwhite/50 text-sm">
            从 {formatAge(startAge)} 到 {formatAge(age)} · {rounds.length} 轮 · 目标完成度{" "}
            {goalProgress}%
          </p>
        </div>

        {/* 分阶段历程 */}
        <LifeStages
          rounds={rounds}
          startGoal={startGoal}
          startAge={startAge}
          startProgress={0}
          finalReport={finalReport}
        />

        <div className="h-20" />
      </div>
    </div>
  );
}
