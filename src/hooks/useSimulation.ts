/**
 * SSE 模拟连接 Hook
 */

import { useRef, useCallback } from "react";
import { useSimStore, type SimConfig } from "@/store/simStore";

export function useSimulation() {
  const abortRef = useRef<AbortController | null>(null);
  const { startSimulation, handleSSEEvent, reset } = useSimStore();

  const begin = useCallback(
    async (config: SimConfig) => {
      startSimulation(config);

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
            } catch {
              // 跳过非 JSON 行
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : "连接失败";
        handleSSEEvent({ type: "error", message });
      }
    },
    [startSimulation, handleSSEEvent]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    reset();
  }, [reset]);

  return { begin, abort };
}
