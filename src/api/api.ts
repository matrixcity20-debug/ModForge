import {
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';

import type {
  ErrorResponse,
  HealthStatus,
  ModRequest,
  ModRequestInput,
  ModStats,
} from './api.schemas';

import { customFetch } from './custom-fetch';
import type { ErrorType, BodyType } from './custom-fetch';

type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];

const withQueryKey = <T extends object, K>(query: T, queryKey: K): T & { queryKey: K } => {
  const result = { queryKey } as T & { queryKey: K };
  for (const key of Object.keys(query)) {
    if (key === 'queryKey') continue;
    Object.defineProperty(result, key, {
      enumerable: true,
      configurable: true,
      get: () => (query as Record<string, unknown>)[key],
    });
  }
  return result;
};

// ─── List Mods ───────────────────────────────────────────────────────────────
export const getListModRequestsUrl = () => `/api/mods`;

export const listModRequests = async (options?: RequestInit): Promise<ModRequest[]> =>
  customFetch<ModRequest[]>(getListModRequestsUrl(), { ...options, method: 'GET' });

export const getListModRequestsQueryKey = () => [`/api/mods`] as const;

export const getListModRequestsQueryOptions = <
  TData = Awaited<ReturnType<typeof listModRequests>>,
  TError = ErrorType<unknown>,
>(
  options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listModRequests>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
  },
) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getListModRequestsQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof listModRequests>>> = ({ signal }) =>
    listModRequests({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof listModRequests>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useListModRequests<
  TData = Awaited<ReturnType<typeof listModRequests>>,
  TError = ErrorType<unknown>,
>(
  options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listModRequests>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getListModRequestsQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return withQueryKey(query, queryOptions.queryKey);
}

// ─── Create Mod ───────────────────────────────────────────────────────────────
export const getCreateModRequestUrl = () => `/api/mods`;

export const createModRequest = async (
  modRequestInput: ModRequestInput,
  options?: RequestInit,
): Promise<ModRequest> =>
  customFetch<ModRequest>(getCreateModRequestUrl(), {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(modRequestInput),
  });

export const getCreateModRequestMutationOptions = <
  TError = ErrorType<ErrorResponse>,
  TContext = unknown,
>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createModRequest>>,
      TError,
      { data: BodyType<ModRequestInput> },
      TContext
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseMutationOptions<
  Awaited<ReturnType<typeof createModRequest>>,
  TError,
  { data: BodyType<ModRequestInput> },
  TContext
> => {
  const mutationKey = ['createModRequest'];
  const { mutation: mutationOptions, request: requestOptions } = options
    ? options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey
      ? options
      : { ...options, mutation: { ...options.mutation, mutationKey } }
    : { mutation: { mutationKey }, request: undefined };

  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof createModRequest>>,
    { data: BodyType<ModRequestInput> }
  > = (props) => createModRequest(props.data, requestOptions);

  return { mutationFn, ...mutationOptions };
};

export const useCreateModRequest = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createModRequest>>,
      TError,
      { data: BodyType<ModRequestInput> },
      TContext
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof createModRequest>>,
  TError,
  { data: BodyType<ModRequestInput> },
  TContext
> => useMutation(getCreateModRequestMutationOptions(options));

// ─── Get Mod ──────────────────────────────────────────────────────────────────
export const getGetModRequestUrl = (id: number) => `/api/mods/${id}`;

export const getModRequest = async (id: number, options?: RequestInit): Promise<ModRequest> =>
  customFetch<ModRequest>(getGetModRequestUrl(id), { ...options, method: 'GET' });

export const getGetModRequestQueryKey = (id: number) => [`/api/mods/${id}`] as const;

export const getGetModRequestQueryOptions = <
  TData = Awaited<ReturnType<typeof getModRequest>>,
  TError = ErrorType<ErrorResponse>,
>(
  id: number,
  options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getModRequest>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
  },
) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetModRequestQueryKey(id);
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getModRequest>>> = ({ signal }) =>
    getModRequest(id, { signal, ...requestOptions });
  return {
    queryKey,
    queryFn,
    enabled: id !== null && id !== undefined,
    ...queryOptions,
  } as UseQueryOptions<Awaited<ReturnType<typeof getModRequest>>, TError, TData> & {
    queryKey: QueryKey;
  };
};

export function useGetModRequest<
  TData = Awaited<ReturnType<typeof getModRequest>>,
  TError = ErrorType<ErrorResponse>,
>(
  id: number,
  options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getModRequest>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getGetModRequestQueryOptions(id, options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return withQueryKey(query, queryOptions.queryKey);
}

// ─── Delete Mod ───────────────────────────────────────────────────────────────
export const getDeleteModRequestUrl = (id: number) => `/api/mods/${id}`;

export const deleteModRequest = async (id: number, options?: RequestInit): Promise<void> =>
  customFetch<void>(getDeleteModRequestUrl(id), { ...options, method: 'DELETE' });

export const getDeleteModRequestMutationOptions = <
  TError = ErrorType<ErrorResponse>,
  TContext = unknown,
>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof deleteModRequest>>,
      TError,
      { id: number },
      TContext
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseMutationOptions<
  Awaited<ReturnType<typeof deleteModRequest>>,
  TError,
  { id: number },
  TContext
> => {
  const mutationKey = ['deleteModRequest'];
  const { mutation: mutationOptions, request: requestOptions } = options
    ? options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey
      ? options
      : { ...options, mutation: { ...options.mutation, mutationKey } }
    : { mutation: { mutationKey }, request: undefined };

  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof deleteModRequest>>,
    { id: number }
  > = (props) => deleteModRequest(props.id, requestOptions);

  return { mutationFn, ...mutationOptions };
};

export const useDeleteModRequest = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof deleteModRequest>>,
      TError,
      { id: number },
      TContext
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof deleteModRequest>>,
  TError,
  { id: number },
  TContext
> => useMutation(getDeleteModRequestMutationOptions(options));

// ─── Mod Stats ────────────────────────────────────────────────────────────────
export const getGetModStatsUrl = () => `/api/mods/stats`;

export const getModStats = async (options?: RequestInit): Promise<ModStats> =>
  customFetch<ModStats>(getGetModStatsUrl(), { ...options, method: 'GET' });

export const getGetModStatsQueryKey = () => [`/api/mods/stats`] as const;

export const getGetModStatsQueryOptions = <
  TData = Awaited<ReturnType<typeof getModStats>>,
  TError = ErrorType<unknown>,
>(
  options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getModStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
  },
) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetModStatsQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getModStats>>> = ({ signal }) =>
    getModStats({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getModStats>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetModStats<
  TData = Awaited<ReturnType<typeof getModStats>>,
  TError = ErrorType<unknown>,
>(
  options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getModStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getGetModStatsQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return withQueryKey(query, queryOptions.queryKey);
}

// ─── Health Check ─────────────────────────────────────────────────────────────
export const getHealthCheckUrl = () => `/api/healthz`;

export const healthCheck = async (options?: RequestInit): Promise<HealthStatus> =>
  customFetch<HealthStatus>(getHealthCheckUrl(), { ...options, method: 'GET' });

export const getHealthCheckQueryKey = () => [`/api/healthz`] as const;
