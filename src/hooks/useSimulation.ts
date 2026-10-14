/**
 * 推演控制 Hook（纯前端引擎版）
 * 浏览器直接调用 LLM 服务商 API，key 不经过任何服务器
 */

import { useRef, useCallback } from "react";
import { useSimStore, type SimConfig, type ResumePayload } from "@/store/simStore";
import { runSimulation } from "@/lib/engine";
import { buildHistoryRun, saveRun } from "@/lib/history";

export function useSimulation() {
  const abortRef = useRef<AbortController | null>(null);
  const { startSimulation, resumeSimulation, handleSSEEvent, reset } = useSimStore();

  /** 存档到本地历史记录（无论完整完成还是中断，只要跑过轮次就记录） */
  const saveArchive = useCallback((completed: boolean) => {
    const s = useSimStore.getState();
    if (s.config && s.rounds.length > 0) {
      saveRun(
        buildHistoryRun(s.config, {
          completed,
          rounds: s.rounds,
          finalAge: s.age,
          finalGoal: s.goal,
          goalProgress: s.goalProgress,
          finalReport: completed ? s.finalReport : null,
        })
      );
    }
  }, []);

  const begin = useCallback(
    async (config: SimConfig, resumeData?: ResumePayload) => {
      if (resumeData) {
        resumeSimulation(config, resumeData);
      } else {
        startSimulation(config);
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await runSimulation(
          config,
          resumeData ?? null,
          (event) => {
            handleSSEEvent(event);
          },
          controller.signal
        );

        // 引擎正常结束：收到 final_report 即完整完成，否则视为中途失败（已发出 error 事件）
        const s = useSimStore.getState();
        saveArchive(s.status === "completed");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : "推演失败";
        handleSSEEvent({ type: "error", message });
        saveArchive(false);
      } finally {
        abortRef.current = null;
      }
    },
    [startSimulation, resumeSimulation, handleSSEEvent, saveArchive]
  );

  /** 断点续推：用 store 中已完成的进度继续 */
  const resume = useCallback(async () => {
    const s = useSimStore.getState();
    if (!s.config) return;
    await begin(s.config, {
      startRound: s.rounds.length + 1,
      age: s.age,
      goal: s.goal,
      goalProgress: s.goalProgress,
      resources: s.resources,
      keyEvents: s.keyEvents,
      totalWeeks: s.totalWeeks,
      rounds: s.rounds,
    });
  }, [begin]);

  const abort = useCallback(() => {
    // 手动停止也记录已跑轮次
    saveArchive(false);
    abortRef.current?.abort();
    abortRef.current = null;
    reset();
  }, [reset, saveArchive]);

  return { begin, resume, abort };
}
