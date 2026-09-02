import axios from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig<D = any, P = any> {
    skipAuth?: boolean;
    skipUnauthorizedHandler?: boolean;
  }
}

export type ApiError = {
  status: number;
  message: string;
  code?: string;
};

type UnauthorizedHandler = () => void | Promise<void>;

type ApiErrorResponse = {
  message?: unknown;
  code?: unknown;
};

type CreateApiClientOptions = {
  baseURL: string;
  getIdToken: () => Promise<string | undefined>;
  unauthorizedHandler: UnauthorizedHandler;
};

const NETWORK_ERROR_MESSAGE = 'No pudimos conectarnos con el servidor';
const GENERIC_ERROR_MESSAGE = 'No pudimos completar la solicitud';

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return typeof value === 'object' && value !== null;
}

function normalizeMessage(message: unknown): string {
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }

  if (Array.isArray(message)) {
    const messages = message.filter((item): item is string => typeof item === 'string');

    if (messages.length > 0) {
      return messages.join(', ');
    }
  }

  return GENERIC_ERROR_MESSAGE;
}

function normalizeApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error) || !error.response) {
    return {
      status: 0,
      message: NETWORK_ERROR_MESSAGE,
    };
  }

  const data: unknown = error.response.data;
  const responseData = isApiErrorResponse(data) ? data : undefined;
  const code = typeof responseData?.code === 'string' ? responseData.code : undefined;

  return {
    status: error.response.status,
    message: normalizeMessage(responseData?.message),
    ...(code ? { code } : {}),
  };
}

export function createApiClient(options: CreateApiClientOptions) {
  let unauthorizedHandler = options.unauthorizedHandler;
  const apiClient = axios.create({
    baseURL: options.baseURL,
    headers: { 'Content-Type': 'application/json' },
  });

  apiClient.interceptors.request.use(async (config) => {
    if (config.skipAuth) {
      return config;
    }

    const idToken = await options.getIdToken();

    if (idToken) {
      config.headers.set('Authorization', `Bearer ${idToken}`);
    }

    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const apiError = normalizeApiError(error);
      const isPublicRequest = axios.isAxiosError(error) && error.config?.skipAuth === true;
      const handlesUnauthorizedLocally =
        axios.isAxiosError(error) && error.config?.skipUnauthorizedHandler === true;

      if (apiError.status === 401 && !isPublicRequest && !handlesUnauthorizedLocally) {
        try {
          await unauthorizedHandler();
        } catch {
          // Keep the original API error as the value exposed to the caller.
        }
      }

      return Promise.reject(apiError);
    },
  );

  return {
    apiClient,
    setUnauthorizedHandler(handler: UnauthorizedHandler): void {
      unauthorizedHandler = handler;
    },
  };
}
