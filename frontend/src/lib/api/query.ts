"use client";

/**
 * A deliberately small query cache (stale-while-revalidate) built on
 * useSyncExternalStore. It covers what the app needs — dedupe, cached
 * navigation, invalidation after mutations, optimistic updates — without
 * pulling in a data-fetching library.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toApiError, type ApiError } from "./http";

export type QueryStatus = "loading" | "success" | "error";

export interface QueryEntry<T> {
  status: QueryStatus;
  data?: T;
  error?: ApiError;
  updatedAt: number;
  /** True while a background refetch runs for already-loaded data */
  refreshing: boolean;
}

type Fetcher<T> = () => Promise<T>;

const LOADING: QueryEntry<never> = Object.freeze({ status: "loading", updatedAt: 0, refreshing: false });

const entries = new Map<string, QueryEntry<unknown>>();
const fetchers = new Map<string, Fetcher<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const stale = new Set<string>();
const listeners = new Set<() => void>();

const STALE_AFTER_MS = 30_000;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set<T>(key: string, entry: QueryEntry<T>) {
  entries.set(key, entry as QueryEntry<unknown>);
  emit();
}

export function fetchQuery<T>(key: string, fetcher: Fetcher<T>): Promise<T> {
  fetchers.set(key, fetcher as Fetcher<unknown>);
  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const prev = entries.get(key) as QueryEntry<T> | undefined;
  set<T>(key, prev?.data !== undefined ? { ...prev, refreshing: true } : { ...LOADING });

  const p = fetcher()
    .then((data) => {
      stale.delete(key);
      set<T>(key, { status: "success", data, updatedAt: Date.now(), refreshing: false });
      return data;
    })
    .catch((err: unknown) => {
      const error = toApiError(err);
      set<T>(key, { status: prev?.data !== undefined ? "success" : "error", data: prev?.data, error, updatedAt: Date.now(), refreshing: false });
      throw error;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

function ensure<T>(key: string, fetcher: Fetcher<T>) {
  const e = entries.get(key);
  const isStale = !e || e.status === "error" || stale.has(key) || Date.now() - e.updatedAt > STALE_AFTER_MS;
  fetchers.set(key, fetcher as Fetcher<unknown>);
  if (isStale && !inflight.has(key)) fetchQuery(key, fetcher).catch(() => undefined);
}

/** Marks every query whose key starts with `prefix` stale and refetches it. */
export function invalidate(prefix: string) {
  for (const key of Array.from(entries.keys())) {
    if (!key.startsWith(prefix)) continue;
    stale.add(key);
    const f = fetchers.get(key);
    if (f) fetchQuery(key, f).catch(() => undefined);
  }
}

/** Optimistically rewrites cached data; returns a function that undoes it. */
export function setQueryData<T>(key: string, update: (prev: T | undefined) => T): () => void {
  const prev = entries.get(key) as QueryEntry<T> | undefined;
  set<T>(key, { status: "success", data: update(prev?.data), updatedAt: Date.now(), refreshing: false });
  return () => {
    if (prev) set(key, prev);
    else entries.delete(key);
    emit();
  };
}

export function useQuery<T>(key: string | null, fetcher: Fetcher<T>) {
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? ((entries.get(key) as QueryEntry<T> | undefined) ?? LOADING) : LOADING),
    () => LOADING as QueryEntry<T>
  );

  useEffect(() => {
    if (key) ensure(key, fetcher);
    // The fetcher is keyed by `key`; a changed closure with the same key is the same query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refetch = useCallback(() => {
    if (key) return fetchQuery(key, fetcher);
    return Promise.resolve(undefined as T);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: entry.data,
    error: entry.error,
    status: entry.status,
    isLoading: entry.status === "loading",
    isRefreshing: entry.refreshing,
    refetch,
  };
}
