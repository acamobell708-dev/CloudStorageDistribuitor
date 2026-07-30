import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createStorageInsights, providerDefinitions } from "./storageInsights.mjs";

function createInitialState() {
  return {
    error: undefined,
    insights: createStorageInsights(),
    loading: true,
    refreshedAt: undefined,
    refreshing: false
  };
}

export function useStorageInsights(apiClient, enabled) {
  const [state, setState] = useState(createInitialState);
  const activeRequest = useRef();
  const requestSequence = useRef(0);

  const refresh = useCallback(
    async ({ background = false } = {}) => {
      if (!enabled) {
        setState({
          ...createInitialState(),
          loading: false
        });
        return undefined;
      }

      const sequence = ++requestSequence.current;
      const abortController = new AbortController();

      activeRequest.current?.abort();
      activeRequest.current = abortController;

      setState((current) => ({
        ...current,
        error: undefined,
        loading: !background,
        refreshing: background
      }));

      try {
        const providers = await apiClient.listProviders({
          signal: abortController.signal
        });
        const providerMap = new Map(
          providers.map((provider) => [provider.key, provider])
        );
        const records = await Promise.all(
          providerDefinitions.map(async (definition) => {
            const provider = providerMap.get(definition.key);
            const listingConfigured =
              provider?.listingConfigured ?? provider?.configured;

            if (!provider || !listingConfigured) {
              return {
                capacityBytes: provider?.storageCapacityBytes,
                capacitySource: provider?.storageCapacitySource,
                detail: provider?.connectionError,
                files: [],
                key: definition.key,
                reportedUsedBytes: provider?.storageUsedBytes,
                status: "not-configured"
              };
            }

            try {
              const listing = await apiClient.listFiles(
                definition.key,
                {
                  signal: abortController.signal
                }
              );

              return {
                capacityBytes: provider.storageCapacityBytes,
                capacitySource: provider.storageCapacitySource,
                files: listing.files || [],
                key: definition.key,
                reportedUsedBytes: provider.storageUsedBytes,
                refreshedAt: listing.refreshedAt,
                status: "loaded"
              };
            } catch (error) {
              if (error.name === "AbortError") {
                throw error;
              }

              return {
                capacityBytes: provider.storageCapacityBytes,
                capacitySource: provider.storageCapacitySource,
                detail: error.message,
                files: [],
                key: definition.key,
                reportedUsedBytes: provider.storageUsedBytes,
                status: "error"
              };
            }
          })
        );

        if (sequence !== requestSequence.current) {
          return undefined;
        }

        const errors = records.filter(
          (record) => record.status === "error"
        );
        const refreshedAt =
          records
            .map((record) => record.refreshedAt)
            .filter(Boolean)
            .sort()
            .pop() || new Date().toISOString();

        setState({
          error:
            errors.length > 0
              ? `${errors.length} provider${
                  errors.length === 1 ? "" : "s"
                } could not be refreshed.`
              : undefined,
          insights: createStorageInsights(records),
          loading: false,
          refreshedAt,
          refreshing: false
        });

        return records;
      } catch (error) {
        if (
          error.name === "AbortError" ||
          sequence !== requestSequence.current
        ) {
          return undefined;
        }

        setState((current) => ({
          ...current,
          error: error.message,
          loading: false,
          refreshing: false
        }));
        return undefined;
      } finally {
        if (activeRequest.current === abortController) {
          activeRequest.current = undefined;
        }
      }
    },
    [apiClient, enabled]
  );

  useEffect(() => {
    refresh();

    return () => {
      activeRequest.current?.abort();
      requestSequence.current += 1;
    };
  }, [refresh]);

  return useMemo(
    () => ({
      ...state,
      refresh: () => refresh({ background: true })
    }),
    [refresh, state]
  );
}
