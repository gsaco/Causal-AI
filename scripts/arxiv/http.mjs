import { setTimeout as sleepTimer } from "node:timers/promises";

let lastRequestAt = 0;
let queue = Promise.resolve();

export function sleep(ms) {
  return sleepTimer(ms);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function throttledFetch(
  url,
  {
    minIntervalMs = 3200,
    retries = 2,
    timeoutMs = 15000,
    retryDelayMs = 1200,
    ...options
  } = {}
) {
  queue = queue.then(async () => {
    const now = Date.now();
    const waitFor = Math.max(0, minIntervalMs - (now - lastRequestAt));
    if (waitFor > 0) {
      await sleep(waitFor);
    }
    lastRequestAt = Date.now();

    let attempt = 0;
    while (true) {
      try {
        const response = await fetchWithTimeout(url, options, timeoutMs);
        if (!response.ok && response.status >= 500 && attempt < retries) {
          const backoff = retryDelayMs * 2 ** attempt;
          attempt += 1;
          await sleep(backoff);
          continue;
        }
        return response;
      } catch (error) {
        if (attempt >= retries) throw error;
        const backoff = retryDelayMs * 2 ** attempt;
        attempt += 1;
        await sleep(backoff);
      }
    }
  });

  return queue;
}
