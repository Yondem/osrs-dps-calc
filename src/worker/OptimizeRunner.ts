import { OptimizeOptions, OptimizeResult } from '@/lib/Optimizer';
import { WORKER_JSON_REPLACER, WORKER_JSON_REVIVER } from '@/utils';

export type OptimizeWorkerMessage =
  { type: 'progress', done: number, total: number } |
  { type: 'result', results: OptimizeResult[] } |
  { type: 'error', error: string };

export interface OptimizeRun {
  promise: Promise<OptimizeResult[]>;
  cancel: () => void;
}

/**
 * Starts a best setup search in a dedicated worker. It doesn't share the main calc worker, so a long search never
 * delays the normal DPS updates.
 */
export const runOptimizer = (opts: OptimizeOptions, onProgress: (fraction: number) => void): OptimizeRun => {
  const worker = new Worker(new URL('./optimizeWorker.ts', import.meta.url));
  let settled = false;

  const promise = new Promise<OptimizeResult[]>((resolve, reject) => {
    worker.onmessage = (evt: MessageEvent<string>) => {
      const msg = JSON.parse(evt.data, WORKER_JSON_REVIVER) as OptimizeWorkerMessage;
      if (msg.type === 'progress') {
        onProgress(msg.total > 0 ? msg.done / msg.total : 0);
        return;
      }
      settled = true;
      worker.terminate();
      if (msg.type === 'result') resolve(msg.results);
      else reject(new Error(msg.error));
    };
    worker.onerror = (ev: ErrorEvent) => {
      settled = true;
      worker.terminate();
      reject(new Error(ev.message));
    };
  });

  worker.postMessage(JSON.stringify(opts, WORKER_JSON_REPLACER));

  return {
    promise,
    cancel: () => {
      if (!settled) worker.terminate();
    },
  };
};
