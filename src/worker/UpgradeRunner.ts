import { MonsterUpgrades, UpgradeFinderOptions } from '@/lib/UpgradeFinder';
import { WORKER_JSON_REPLACER, WORKER_JSON_REVIVER } from '@/utils';

export type UpgradeWorkerMessage =
  { type: 'progress', done: number, total: number } |
  { type: 'result', result: MonsterUpgrades } |
  { type: 'error', error: string };

export interface UpgradeRun {
  promise: Promise<MonsterUpgrades[]>;
  cancel: () => void;
}

/**
 * Finds upgrades against each monster, each in its own worker, a few at a time in parallel. They don't share the main
 * calc worker, so a long search never delays the normal DPS updates.
 */
export const runUpgradeFinder = (tasks: UpgradeFinderOptions[], onProgress: (fraction: number) => void): UpgradeRun => {
  const workers = new Set<Worker>();
  const progress = tasks.map(() => 0);
  let cancelled = false;
  const report = () => onProgress(progress.reduce((a, b) => a + b, 0) / Math.max(tasks.length, 1));

  const runOne = (i: number) => new Promise<MonsterUpgrades>((resolve, reject) => {
    const worker = new Worker(new URL('./upgradeWorker.ts', import.meta.url));
    workers.add(worker);
    const finish = () => {
      worker.terminate();
      workers.delete(worker);
    };
    worker.onmessage = (evt: MessageEvent<string>) => {
      const msg = JSON.parse(evt.data, WORKER_JSON_REVIVER) as UpgradeWorkerMessage;
      if (msg.type === 'progress') {
        progress[i] = msg.total > 0 ? msg.done / msg.total : 0;
        report();
        return;
      }
      finish();
      progress[i] = 1;
      report();
      if (msg.type === 'result') resolve(msg.result);
      else reject(new Error(msg.error));
    };
    worker.onerror = (ev: ErrorEvent) => {
      finish();
      reject(new Error(ev.message));
    };
    worker.postMessage(JSON.stringify(tasks[i], WORKER_JSON_REPLACER));
  });

  const concurrency = Math.max(1, Math.min(tasks.length, (navigator.hardwareConcurrency || 4) - 1, 6));
  const promise = new Promise<MonsterUpgrades[]>((resolve, reject) => {
    const results: MonsterUpgrades[] = new Array(tasks.length);
    let next = 0;
    let finished = 0;
    if (tasks.length === 0) resolve([]);
    const startNext = () => {
      if (cancelled || next >= tasks.length) return;
      const i = next;
      next += 1;
      runOne(i).then((r) => {
        results[i] = r;
        finished += 1;
        if (finished === tasks.length) resolve(results);
        else startNext();
      }).catch((e) => {
        cancelled = true;
        workers.forEach((w) => w.terminate());
        reject(e);
      });
    };
    for (let i = 0; i < concurrency; i++) startNext();
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      workers.forEach((w) => w.terminate());
      workers.clear();
    },
  };
};
