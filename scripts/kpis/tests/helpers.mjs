import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CONTEXT = { date: '2026-10-21', env: 'dev' };
export const PUBLICATION_ID = '41425050-6e16-4fe7-8c80-fd2ff9dbed05';

export async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

export function tempDir() {
  return mkdtemp(join(tmpdir(), 'pitstop-kpis-'));
}

export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

// Replays responses in order; an Error entry is thrown as a transport failure.
export function sequenceFetch(responses, requests = []) {
  const fetchImplementation = async (url, options) => {
    requests.push({ url: url.toString(), options });
    const response = responses.shift();

    if (response === undefined) throw new Error('unexpected request');
    if (response instanceof Error) throw response;
    return typeof response === 'function' ? response(options) : response;
  };
  fetchImplementation.requests = requests;
  return fetchImplementation;
}

// Never resolves until the request's timeout signal aborts it.
export function hangingFetch(_url, { signal }) {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  });
}

// A clock that advances only when `sleep` is awaited.
export function fakeTime(start = '2026-10-22T04:00:00.000Z') {
  let current = Date.parse(start);
  const sleeps = [];
  return {
    sleeps,
    now: () => new Date(current),
    sleep: async (ms) => {
      sleeps.push(ms);
      current += ms;
    },
  };
}
