import { useCallback, useEffect, useRef, useState } from "react";

const emptyActivity = Object.freeze({
  dailyUploads: {
    days: []
  },
  history: {
    hasNext: false,
    hasPrevious: false,
    items: [],
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1
  }
});

export function useActivityLog(apiClient, enabled) {
  const [activity, setActivity] = useState(emptyActivity);
  const [error, setError] = useState();
  const [loading, setLoading] = useState(enabled);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const activeRequest = useRef();

  const load = useCallback(
    async (requestedPage, background = false) => {
      if (!enabled) {
        setActivity(emptyActivity);
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      activeRequest.current?.abort();
      activeRequest.current = controller;
      setError(undefined);
      setLoading(!background);
      setRefreshing(background);

      try {
        const result = await apiClient.listActivity({
          days: 14,
          page: requestedPage,
          pageSize: 10,
          signal: controller.signal
        });

        for (const warning of result.fallbackWarnings || []) {
          const status = warning.status ? ` (HTTP ${warning.status})` : "";
          console.warn(
            `[Dashboard activity] ${warning.provider} history fallback: ${warning.code}${status}`
          );
        }

        setActivity(result);
        setPage(result.history?.page || 1);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      } finally {
        if (activeRequest.current === controller) {
          activeRequest.current = undefined;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [apiClient, enabled]
  );

  useEffect(() => {
    load(page);
    return () => activeRequest.current?.abort();
  }, [load, page]);

  return {
    activity,
    error,
    loading,
    page,
    refreshing,
    refresh: () => load(page, true),
    setPage
  };
}
