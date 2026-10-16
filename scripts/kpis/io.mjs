import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// Errors carry only a safe, fixed code: never a value, body, or credential.
export class ContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ContractError';
    this.code = code;
  }
}

export class TransportError extends Error {
  constructor(kind) {
    super(kind);
    this.name = 'TransportError';
    this.kind = kind;
    this.code = kind.toUpperCase();
  }
}

function isTimeout(error, signal) {
  return (
    (signal.aborted && signal.reason?.name === 'TimeoutError') || error?.name === 'TimeoutError'
  );
}

// One HTTP exchange with a finite timeout covering headers and body. Transport failures never
// expose their message; callers only see `timeout` or `connection_error`.
export async function request(fetchImplementation, url, init, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    const response = await fetchImplementation(url, { ...init, signal });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text };
  } catch (error) {
    throw new TransportError(isTimeout(error, signal) ? 'timeout' : 'connection_error');
  }
}

export function parseJson(text, code) {
  try {
    return JSON.parse(text);
  } catch {
    throw new ContractError(code);
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeGithubOutputs(outputs, outputPath) {
  if (!outputPath) return;
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`);
  await appendFile(outputPath, lines.join(''), 'utf8');
}

export async function appendStepSummary(lines, summaryPath) {
  if (!summaryPath) return;
  await appendFile(summaryPath, `${lines.join('\n')}\n\n`, 'utf8');
}

export function isDirectRun(moduleUrl) {
  return process.argv[1] !== undefined && moduleUrl === pathToFileURL(process.argv[1]).href;
}

// Runs a CLI entry point and maps any escaped error to a safe annotation and exit code 1.
export async function runCli(main) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(`::error::KPI step failed: ${error?.code ?? 'UNEXPECTED_ERROR'}`);
    process.exitCode = 1;
  }
}
