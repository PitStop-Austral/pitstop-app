#!/usr/bin/env node

import { ContractError, ENVS } from './contracts.mjs';
import { assertClosedDay, closedDay, parseDate } from './dates.mjs';
import { isDirectRun, runCli, writeGithubOutputs } from './io.mjs';

const MODES = ['collect', 'recover'];
const RUN_ID = /^\d{1,20}$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function parseEnv(value) {
  if (!ENVS.includes(value)) throw new ContractError('INVALID_ENV');
  return value;
}

// Resolves the run context before any GitHub Environment is selected. Precedence for the env:
// manual input, then the repository variable KPI_SCHEDULE_ENV, then dev. Schedules always collect.
export function resolveContext({ eventName, inputs = {}, scheduleEnv, now }) {
  const pick = (value) => (typeof value === 'string' ? value.trim() : '');
  const isSchedule = eventName === 'schedule';
  const env = parseEnv(pick(isSchedule ? '' : inputs.environment) || pick(scheduleEnv) || 'dev');
  const mode = isSchedule ? 'collect' : pick(inputs.mode) || 'collect';

  if (!MODES.includes(mode)) throw new ContractError('INVALID_MODE');

  const inputDate = isSchedule ? '' : pick(inputs.date);

  if (mode === 'collect') {
    return { env, mode, date: inputDate ? assertClosedDay(inputDate, now) : closedDay(now) };
  }

  if (!inputDate) throw new ContractError('RECOVER_DATE_REQUIRED');
  const date = parseDate(inputDate);
  const sourceRunId = pick(inputs.source_run_id);
  const name = pick(inputs.artifact_name);

  if (!sourceRunId) throw new ContractError('RECOVER_SOURCE_RUN_REQUIRED');
  if (!RUN_ID.test(sourceRunId)) throw new ContractError('INVALID_SOURCE_RUN_ID');
  if (!name) throw new ContractError('RECOVER_ARTIFACT_REQUIRED');
  // The artifact name embeds env and date, so a recovery can never switch the batch's context.
  if (!new RegExp(`^kpi-batch-${env}-${date}-\\d+-\\d+$`).test(name)) {
    throw new ContractError('ARTIFACT_CONTEXT_MISMATCH');
  }

  return { env, mode, date, sourceRunId, artifactName: name };
}

// Origins only: https, or http for a local test server. Trailing slashes are dropped.
export function validateBaseUrl(value, name) {
  const trimmed = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
  let url;

  try {
    url = new URL(trimmed);
  } catch {
    throw new ContractError(`INVALID_${name}`);
  }

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    throw new ContractError(`INVALID_${name}`);
  }

  return trimmed;
}

export function requireSecret(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new ContractError(`MISSING_${name}`);
  return value;
}

if (isDirectRun(import.meta.url)) {
  await runCli(async () => {
    const context = resolveContext({
      eventName: process.env.GITHUB_EVENT_NAME,
      inputs: {
        environment: process.env.KPI_INPUT_ENVIRONMENT,
        mode: process.env.KPI_INPUT_MODE,
        date: process.env.KPI_INPUT_DATE,
        source_run_id: process.env.KPI_INPUT_SOURCE_RUN_ID,
        artifact_name: process.env.KPI_INPUT_ARTIFACT_NAME,
      },
      scheduleEnv: process.env.KPI_SCHEDULE_ENV,
      now: new Date(),
    });

    await writeGithubOutputs(
      {
        env: context.env,
        mode: context.mode,
        date: context.date,
        source_run_id: context.sourceRunId ?? '',
        artifact_name: context.artifactName ?? '',
      },
      process.env.GITHUB_OUTPUT,
    );
    console.log(`KPI context: env=${context.env} mode=${context.mode} date=${context.date}`);
    return 0;
  });
}
