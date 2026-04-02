import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  MutationFunction,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
  QueryKey,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType, BodyType } from "./custom-fetch";

export interface ServiceInterval {
  id: number;
  carId: number;
  name: string;
  intervalType: string;
  intervalValue: number | null;
  targetMonths: string | null;
  lastServiceReading: number | null;
  lastServiceDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateServiceInterval {
  name: string;
  intervalType: string;
  intervalValue?: number | null;
  targetMonths?: string | null;
  lastServiceReading?: number | null;
  lastServiceDate?: string | null;
  notes?: string | null;
}

export interface MarkServiceDone {
  lastServiceReading?: number | null;
  lastServiceDate: string;
}

const listServiceIntervals = (carId: number, options?: RequestInit) =>
  customFetch<ServiceInterval[]>(`/api/cars/${carId}/service-intervals`, { ...options });

const createServiceInterval = (carId: number, data: CreateServiceInterval, options?: RequestInit) =>
  customFetch<ServiceInterval>(`/api/cars/${carId}/service-intervals`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });

const updateServiceInterval = (carId: number, intervalId: number, data: CreateServiceInterval, options?: RequestInit) =>
  customFetch<ServiceInterval>(`/api/cars/${carId}/service-intervals/${intervalId}`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });

const markServiceDone = (carId: number, intervalId: number, data: MarkServiceDone, options?: RequestInit) =>
  customFetch<ServiceInterval>(`/api/cars/${carId}/service-intervals/${intervalId}/done`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });

const deleteServiceInterval = (carId: number, intervalId: number, options?: RequestInit) =>
  customFetch<void>(`/api/cars/${carId}/service-intervals/${intervalId}`, {
    ...options,
    method: "DELETE",
  });

export function useListServiceIntervals<
  TData = Awaited<ReturnType<typeof listServiceIntervals>>,
  TError = ErrorType<unknown>,
>(
  carId: number,
  options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listServiceIntervals>>, TError, TData>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = [`/api/cars/${carId}/service-intervals`];
  const query = useQuery({
    queryKey,
    queryFn: () => listServiceIntervals(carId, options?.request as RequestInit),
    ...options?.query,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const useCreateServiceInterval = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof createServiceInterval>>,
    TError,
    { carId: number; data: BodyType<CreateServiceInterval> },
    TContext
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof createServiceInterval>>,
  TError,
  { carId: number; data: BodyType<CreateServiceInterval> },
  TContext
> => {
  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof createServiceInterval>>,
    { carId: number; data: BodyType<CreateServiceInterval> }
  > = ({ carId, data }) => createServiceInterval(carId, data);
  return useMutation({ mutationFn, mutationKey: ["createServiceInterval"], ...options?.mutation });
};

export const useUpdateServiceInterval = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updateServiceInterval>>,
    TError,
    { carId: number; intervalId: number; data: BodyType<CreateServiceInterval> },
    TContext
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof updateServiceInterval>>,
  TError,
  { carId: number; intervalId: number; data: BodyType<CreateServiceInterval> },
  TContext
> => {
  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof updateServiceInterval>>,
    { carId: number; intervalId: number; data: BodyType<CreateServiceInterval> }
  > = ({ carId, intervalId, data }) => updateServiceInterval(carId, intervalId, data);
  return useMutation({ mutationFn, mutationKey: ["updateServiceInterval"], ...options?.mutation });
};

export const useMarkServiceDone = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof markServiceDone>>,
    TError,
    { carId: number; intervalId: number; data: BodyType<MarkServiceDone> },
    TContext
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof markServiceDone>>,
  TError,
  { carId: number; intervalId: number; data: BodyType<MarkServiceDone> },
  TContext
> => {
  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof markServiceDone>>,
    { carId: number; intervalId: number; data: BodyType<MarkServiceDone> }
  > = ({ carId, intervalId, data }) => markServiceDone(carId, intervalId, data);
  return useMutation({ mutationFn, mutationKey: ["markServiceDone"], ...options?.mutation });
};

export const useDeleteServiceInterval = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof deleteServiceInterval>>,
    TError,
    { carId: number; intervalId: number },
    TContext
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof deleteServiceInterval>>,
  TError,
  { carId: number; intervalId: number },
  TContext
> => {
  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof deleteServiceInterval>>,
    { carId: number; intervalId: number }
  > = ({ carId, intervalId }) => deleteServiceInterval(carId, intervalId);
  return useMutation({ mutationFn, mutationKey: ["deleteServiceInterval"], ...options?.mutation });
};
