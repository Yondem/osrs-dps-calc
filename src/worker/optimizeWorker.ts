/* eslint-disable no-restricted-globals */
import { optimize, OptimizeOptions } from '@/lib/Optimizer';
import { WORKER_JSON_REPLACER, WORKER_JSON_REVIVER } from '@/utils';
import { OptimizeWorkerMessage } from '@/worker/OptimizeRunner';

/**
 * Runs one best setup search off the main thread, so the page stays responsive. The worker is terminated
 * afterwards (or to cancel), so it handles a single request.
 */
self.onmessage = (evt: MessageEvent<string>) => {
  const send = (msg: OptimizeWorkerMessage) => self.postMessage(JSON.stringify(msg, WORKER_JSON_REPLACER));
  const opts = JSON.parse(evt.data, WORKER_JSON_REVIVER) as OptimizeOptions;

  let lastProgress = 0;
  try {
    const results = optimize(opts, (done, total) => {
      const now = self.performance.now();
      if (now - lastProgress > 100) {
        lastProgress = now;
        send({ type: 'progress', done, total });
      }
    });
    send({ type: 'result', results });
  } catch (e) {
    console.error(e);
    send({ type: 'error', error: e instanceof Error ? e.message : String(e) });
  }
};
