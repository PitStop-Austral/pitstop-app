import { ContractError } from './contracts.mjs';

const MIN_RANGE_MS = 1000;

export function parseRepository(value) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(value ?? '')) {
    throw new ContractError('INVALID_REPOSITORY');
  }

  const [owner, repo] = value.split('/');
  return { owner, repo, repository: value };
}

// One authenticated GET against the repository's REST API. Transport failures and non-2xx
// responses become GITHUB_REQUEST_FAILED; 404/410 become `missingCode` when one is given.
export function createGitHubRequest({ fetchImplementation, repository, token, timeoutMs }) {
  const { owner, repo } = parseRepository(repository);

  return async function request(path, query = {}, missingCode = null, { binary = false } = {}) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }

    const init = {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    };
    if (timeoutMs !== undefined) init.signal = AbortSignal.timeout(timeoutMs);

    let response;
    try {
      response = await fetchImplementation(url, init);
    } catch {
      throw new ContractError('GITHUB_REQUEST_FAILED');
    }

    if (missingCode && (response.status === 404 || response.status === 410)) {
      throw new ContractError(missingCode);
    }
    if (!response.ok) {
      throw new ContractError('GITHUB_REQUEST_FAILED');
    }

    try {
      return binary ? Buffer.from(await response.arrayBuffer()) : await response.json();
    } catch {
      throw new ContractError('GITHUB_INVALID_RESPONSE');
    }
  };
}

// Lists every workflow run created in [startMs, endMs). GitHub caps a filtered listing at 1000
// results, so a range that reaches the cap is split in halves.
export async function listWorkflowRunRange(listPage, startMs, endMs) {
  const start = new Date(startMs).toISOString();
  const end = new Date(endMs - 1).toISOString();
  const firstPage = await listPage(start, end, 1);

  if (!Number.isInteger(firstPage.total_count) || !Array.isArray(firstPage.workflow_runs)) {
    throw new ContractError('GITHUB_INVALID_RESPONSE');
  }

  if (firstPage.total_count >= 1000) {
    if (endMs - startMs <= MIN_RANGE_MS) {
      throw new ContractError('WINDOW_TRUNCATED');
    }

    const middle = startMs + Math.floor((endMs - startMs) / 2);
    const left = await listWorkflowRunRange(listPage, startMs, middle);
    const right = await listWorkflowRunRange(listPage, middle, endMs);
    return [...left, ...right];
  }

  const runs = [...firstPage.workflow_runs];
  for (let page = 2; runs.length < firstPage.total_count; page += 1) {
    const response = await listPage(start, end, page);
    if (!Array.isArray(response.workflow_runs) || response.workflow_runs.length === 0) {
      throw new ContractError('GITHUB_INVALID_RESPONSE');
    }
    runs.push(...response.workflow_runs);
  }

  return runs;
}
