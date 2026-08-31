/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';

import { createApiClient, type ApiError } from './api-client-core.ts';

const successAdapter: AxiosAdapter = async (config) => ({
  config,
  data: {
    authorization: config.headers.get('Authorization'),
  },
  headers: new AxiosHeaders(),
  status: 200,
  statusText: 'OK',
});

function errorAdapter(status: number, data?: unknown): AxiosAdapter {
  return async (config) => {
    const response: AxiosResponse = {
      config,
      data,
      headers: new AxiosHeaders(),
      status,
      statusText: 'Error',
    };

    throw new AxiosError(
      'Request failed',
      AxiosError.ERR_BAD_RESPONSE,
      config,
      undefined,
      response,
    );
  };
}

function createTestClient(
  getIdToken: () => Promise<string | undefined> = async () => undefined,
  unauthorizedHandler: () => void | Promise<void> = () => undefined,
) {
  return createApiClient({
    baseURL: 'http://localhost:3001',
    getIdToken,
    unauthorizedHandler,
  });
}

async function expectApiError(request: Promise<unknown>, expected: ApiError): Promise<void> {
  await assert.rejects(request, (error: unknown) => {
    assert.deepStrictEqual(error, expected);
    return true;
  });
}

test('adds the current Firebase token to authenticated requests', async () => {
  const { apiClient } = createTestClient(async () => 'firebase-token');

  const response = await apiClient.get('/me', { adapter: successAdapter });

  assert.strictEqual(response.data.authorization, 'Bearer firebase-token');
});

test('does not get or add a token when skipAuth is true', async () => {
  let tokenRequests = 0;
  const { apiClient } = createTestClient(async () => {
    tokenRequests += 1;
    return 'firebase-token';
  });

  const response = await apiClient.get('/public', { adapter: successAdapter, skipAuth: true });

  assert.strictEqual(tokenRequests, 0);
  assert.strictEqual(response.data.authorization, undefined);
});

test('does not add an Authorization header without an authenticated user', async () => {
  const { apiClient } = createTestClient();

  const response = await apiClient.get('/public', { adapter: successAdapter });

  assert.strictEqual(response.data.authorization, undefined);
});

test('normalizes string messages and response codes', async () => {
  const { apiClient } = createTestClient();

  await expectApiError(
    apiClient.get('/failure', {
      adapter: errorAdapter(400, { message: 'Invalid request', code: 'INVALID' }),
    }),
    {
      status: 400,
      message: 'Invalid request',
      code: 'INVALID',
    },
  );
});

test('joins array messages', async () => {
  const { apiClient } = createTestClient();

  await expectApiError(
    apiClient.get('/failure', {
      adapter: errorAdapter(422, { message: ['First', 'Second'] }),
    }),
    {
      status: 422,
      message: 'First, Second',
    },
  );
});

test('uses a generic message when the response has no message', async () => {
  const { apiClient } = createTestClient();

  await expectApiError(apiClient.get('/failure', { adapter: errorAdapter(500, {}) }), {
    status: 500,
    message: 'No pudimos completar la solicitud',
  });
});

test('normalizes errors without a response as network errors', async () => {
  const { apiClient } = createTestClient();
  const adapter: AxiosAdapter = async (config) => {
    throw new AxiosError('Network error', AxiosError.ERR_NETWORK, config);
  };

  await expectApiError(apiClient.get('/failure', { adapter }), {
    status: 0,
    message: 'No pudimos conectarnos con el servidor',
  });
});

test('awaits the unauthorized handler and preserves the API error if it fails', async () => {
  let handlerFinished = false;
  const { apiClient, setUnauthorizedHandler } = createTestClient();

  setUnauthorizedHandler(async () => {
    await Promise.resolve();
    handlerFinished = true;
    throw new Error('Sign out failed');
  });

  await expectApiError(
    apiClient.get('/private', { adapter: errorAdapter(401, { message: 'Unauthorized' }) }),
    {
      status: 401,
      message: 'Unauthorized',
    },
  );
  assert.strictEqual(handlerFinished, true);
});
