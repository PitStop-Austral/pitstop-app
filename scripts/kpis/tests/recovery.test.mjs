import assert from 'node:assert/strict';
import { readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { prepareBatch, writeBatch } from '../prepare-batch.mjs';
import { KPI_WORKFLOW_PATH, checkSourceRun, validateRecoveredBatch } from '../recover-batch.mjs';
import { CONTEXT, PUBLICATION_ID, fixture, jsonResponse, tempDir } from './helpers.mjs';

const REPOSITORY = 'PitStop-Austral/pitstop-app';
const ARTIFACT = 'kpi-batch-dev-2026-10-21-555-1';
const run = {
  id: 555,
  path: KPI_WORKFLOW_PATH,
  conclusion: 'failure',
  repository: { full_name: REPOSITORY },
};

// Routes GitHub REST paths to canned responses and records every request.
function githubFetch(routes) {
  const requests = [];
  const fetchImplementation = async (url, options) => {
    const { pathname, search } = new URL(url);
    requests.push({ path: pathname + search, options });
    const route = routes[pathname + search] ?? routes[pathname];
    return route ? jsonResponse(route) : jsonResponse({ message: 'Not Found' }, 404);
  };
  fetchImplementation.requests = requests;
  return fetchImplementation;
}

const artifactsPath = (page) =>
  `/repos/${REPOSITORY}/actions/runs/555/artifacts?per_page=100&page=${page}`;
const runPath = `/repos/${REPOSITORY}/actions/runs/555`;
const otherArtifacts = (count) =>
  Array.from({ length: count }, (_, i) => ({ id: i, name: `kpi-sources-${i}`, expired: false }));

const check = (fetchImplementation) =>
  checkSourceRun({
    repository: REPOSITORY,
    runId: '555',
    artifactName: ARTIFACT,
    token: 'gh-token',
    fetchImplementation,
  });

test('accepts the named artifact of a failed KPI run', async () => {
  const fetchImplementation = githubFetch({
    [runPath]: run,
    [artifactsPath(1)]: { artifacts: [{ id: 77, name: ARTIFACT, expired: false }] },
  });

  assert.deepEqual(await check(fetchImplementation), { artifactId: 77, runId: '555' });
  assert.equal(fetchImplementation.requests[0].options.headers.authorization, 'Bearer gh-token');
});

test('paginates the run artifacts and never looks at other runs', async () => {
  const fetchImplementation = githubFetch({
    [runPath]: run,
    [artifactsPath(1)]: { artifacts: otherArtifacts(100) },
    [artifactsPath(2)]: { artifacts: [{ id: 78, name: ARTIFACT, expired: false }] },
  });

  assert.equal((await check(fetchImplementation)).artifactId, 78);
  assert.ok(fetchImplementation.requests.every(({ path }) => path.startsWith(runPath)));
});

test('rejects missing, expired, foreign-workflow, or foreign-repository sources', async () => {
  const cases = [
    [{}, 'SOURCE_RUN_NOT_FOUND'],
    [{ [runPath]: { ...run, path: '.github/workflows/ci.yml' } }, 'SOURCE_RUN_WRONG_WORKFLOW'],
    [
      { [runPath]: { ...run, repository: { full_name: 'someone/fork' } } },
      'SOURCE_RUN_WRONG_REPOSITORY',
    ],
    [
      { [runPath]: run, [artifactsPath(1)]: { artifacts: otherArtifacts(3) } },
      'ARTIFACT_NOT_FOUND',
    ],
    [
      {
        [runPath]: run,
        [artifactsPath(1)]: { artifacts: otherArtifacts(100) },
        [artifactsPath(2)]: { artifacts: [] },
      },
      'ARTIFACT_NOT_FOUND',
    ],
    // Past the 14-day retention the batch is gone; it is never rebuilt by recalculating.
    [
      {
        [runPath]: run,
        [artifactsPath(1)]: { artifacts: [{ id: 77, name: ARTIFACT, expired: true }] },
      },
      'ARTIFACT_EXPIRED',
    ],
  ];

  for (const [routes, code] of cases) {
    await assert.rejects(check(githubFetch(routes)), { code });
  }
});

async function savedBatch(t) {
  const dir = await tempDir();
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'api.json'), JSON.stringify(await fixture('api.json')));
  const batch = await prepareBatch({
    fragmentsDir: dir,
    enabled: { api: true },
    ...CONTEXT,
    publicationId: PUBLICATION_ID,
  });
  const batchDir = join(dir, 'downloaded');
  await writeBatch(batchDir, batch);
  return { batchDir, payloadText: batch.payloadText };
}

test('validates the downloaded batch unchanged and records its origin', async (t) => {
  const { batchDir, payloadText } = await savedBatch(t);
  const recovered = await validateRecoveredBatch({
    dir: batchDir,
    ...CONTEXT,
    sourceRunId: '555',
    artifactName: ARTIFACT,
  });

  assert.equal(recovered.payloadBytes.toString('utf8'), payloadText);
  assert.equal(recovered.manifest.publicationId, PUBLICATION_ID);
  assert.deepEqual(JSON.parse(await readFile(join(batchDir, 'recovery.json'), 'utf8')), {
    sourceRunId: '555',
    artifactName: ARTIFACT,
  });
});

test('rejects a recovered batch for another date, env, a tampered payload, or a missing file', async (t) => {
  const recover = (dir, overrides = {}) =>
    validateRecoveredBatch({
      dir,
      ...CONTEXT,
      sourceRunId: '555',
      artifactName: ARTIFACT,
      ...overrides,
    });

  const { batchDir } = await savedBatch(t);
  await assert.rejects(recover(batchDir, { env: 'prod' }), { code: 'ENV_MISMATCH' });
  await assert.rejects(recover(batchDir, { date: '2026-10-20' }), { code: 'DATE_MISMATCH' });

  const manifestPath = join(batchDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, publicationId: '00000000-0000-4000-8000-000000000000' }),
  );
  await assert.rejects(recover(batchDir), { code: 'PUBLICATION_ID_MISMATCH' });

  await writeFile(manifestPath, JSON.stringify({ ...manifest, payloadSha256: '0'.repeat(64) }));
  await assert.rejects(recover(batchDir), { code: 'PAYLOAD_HASH_MISMATCH' });

  await unlink(join(batchDir, 'payload.json'));
  await assert.rejects(recover(batchDir), { code: 'PAYLOAD_MISSING' });
});
