/**
 * SSE 模拟连接 Hook
 */

import { useRef, useCallback } from "react";
import { useSimStore, type SimConfig, type ResumePayload } from "@/store/simStore";
import { buildHistoryRun, saveRun } from "@/lib/history";

export function useSimulation() {
  const abortRef = useRef<AbortController | null>(null);
  const { startSimulation, resumeSimulation, handleSSEEvent, reset } = useSimStore();

  /** 存档到历史记录（无论完整完成还是中断，只要跑过轮次就记录） */
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
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          handleSSEEvent({ type: "error", message: `请求失败 ${res.status}: ${errText}` });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          handleSSEEvent({ type: "error", message: "无法读取响应流" });
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (!trimmed.startsWith("data:")) continue;

            const jsonStr = trimmed.slice(5).trim();
            try {
              const event = JSON.parse(jsonStr);
              handleSSEEvent(event);
              // 完成 → 完整存档；中断 → 未完成存档（跑过的轮次都记录）
              if (event.type === "final_report") saveArchive(true);
              else if (event.type === "error") saveArchive(false);
            } catch {
              // 跳过非 JSON 行
            }
          }
        }
        // 流提前结束且未收到完成/错误事件（连接断开、后端崩溃）：标记中断，避免卡在"进行中"
        const s = useSimStore.getState();
        if (s.status === "running") {
          handleSSEEvent({ type: "error", message: "连接中断，推演未完成，可从断点继续" });
          saveArchive(false);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : "连接失败";
        handleSSEEvent({ type: "error", message });
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
