/**
 * 推演分享：把一次推演压缩编码为分享码（可拼成链接）
 * 纯前端实现：gzip 压缩 + base64url，无任何服务器参与
 * 注意：分享内容只有推演文本，永远不包含 API Key
 */

import type { HistoryRun } from '@/lib/history';
import type { RoundData } from '@/store/simStore';

/** 分享的精简轮次（截断长文本以控制链接长度） */
interface CompactRound {
  round: number;
  age: number;
  elapsedWeeks?: number;
  goalProgress: number;
  nextStep?: string;
  result?: string;
  keyEvents?: string[];
}

export interface SharedRun {
  situation: { age: number; occupation: string; resources: string; goal: string };
  timeSpan?: string;
  totalRounds: number;
  providerLabel: string;
  modelsLabel: string;
  createdAt: number;
  completed: boolean;
  finalAge: number;
  finalGoal: string;
  goalProgress: number;
  finalReport: string | null;
  rounds: CompactRound[];
}

const cap = (v: string | undefined | null, max: number): string | undefined => {
  if (typeof v !== 'string' || !v) return undefined;
  return v.slice(0, max);
};

function toCompact(run: HistoryRun): SharedRun {
  return {
    situation: run.situation,
    totalRounds: run.totalRounds,
    providerLabel: run.providerLabel,
    modelsLabel: run.modelsLabel,
    createdAt: run.createdAt,
    completed: run.completed,
    finalAge: run.finalAge,
    finalGoal: run.finalGoal,
    goalProgress: run.goalProgress,
    finalReport: cap(run.finalReport, 400) ?? null,
    rounds: run.rounds.map((r) => ({
      round: r.round,
      age: r.age,
      elapsedWeeks: r.elapsedWeeks,
      goalProgress: r.goalProgress,
      nextStep: cap(r.nextStep, 80),
      result: cap(r.result, 110),
      keyEvents: (r.keyEvents ?? []).slice(0, 3),
    })),
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(code: string): Uint8Array {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** gzip 压缩（浏览器原生，旧浏览器回退不压缩） */
async function gzip(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return data;
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  // gzip 魔数 1f 8b
  if (data[0] === 0x1f && data[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }
  return data;
}

/** 编码为分享码 */
export async function encodeRun(run: HistoryRun): Promise<string> {
  const json = JSON.stringify(toCompact(run));
  const raw = new TextEncoder().encode(json);
  const packed = await gzip(raw);
  return bytesToBase64Url(packed);
}

/** 解码分享码；失败抛出错误 */
export async function decodeRun(code: string): Promise<SharedRun> {
  const clean = code.trim();
  const q = clean.indexOf('?r=');
  const body = q >= 0 ? clean.slice(q + 3) : clean;
  const bytes = await gunzip(base64UrlToBytes(body));
  const run = JSON.parse(new TextDecoder().decode(bytes)) as SharedRun;
  if (!run || !Array.isArray(run.rounds) || !run.situation?.goal) {
    throw new Error('分享码格式无效');
  }
  return run;
}

/** 生成分享链接（hash 路由，静态托管可直接打开） */
export async function buildShareLink(run: HistoryRun): Promise<string> {
  const code = await encodeRun(run);
  return `${location.origin}${location.pathname}#/gallery?r=${code}`;
}

/** SharedRun → 供 LifeStages 展示的 RoundData 形状 */
export function sharedToRoundData(r: CompactRound): RoundData {
  return {
    round: r.round,
    overallPlan: '',
    nextStep: r.nextStep ?? '',
    action: '',
    envFeedback: '',
    result: r.result ?? '',
    goalChanged: false,
    newGoal: '',
    age: r.age,
    elapsedWeeks: r.elapsedWeeks,
    goalProgress: r.goalProgress,
    keyEvents: r.keyEvents ?? [],
  };
}
