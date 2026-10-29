/* eslint-disable no-restricted-globals */
import { findUpgrades, UpgradeFinderOptions } from '@/lib/UpgradeFinder';
import { WORKER_JSON_REPLACER, WORKER_JSON_REVIVER } from '@/utils';
import { UpgradeWorkerMessage } from '@/worker/UpgradeRunner';

/**
 * Finds the upgrades against one monster off the main thread. The worker is terminated afterwards (or to cancel),
 * so it handles a single request.
 */
self.onmessage = (evt: MessageEvent<string>) => {
  const send = (msg: UpgradeWorkerMessage) => self.postMessage(JSON.stringify(msg, WORKER_JSON_REPLACER));
  const opts = JSON.parse(evt.data, WORKER_JSON_REVIVER) as UpgradeFinderOptions;

  let lastProgress = 0;
  try {
    const result = findUpgrades(opts, (done, total) => {
      const now = self.performance.now();
      if (now - lastProgress > 100) {
        lastProgress = now;
        send({ type: 'progress', done, total });
      }
    });
    send({ type: 'result', result });
  } catch (e) {
    console.error(e);
    send({ type: 'error', error: e instanceof Error ? e.message : String(e) });
  }
};
