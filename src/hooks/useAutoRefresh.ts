import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";

const DEFAULT_INTERVAL_MS = 300_000; // 5 minutes

interface UseAutoRefreshResult {
  lastRefresh: Date;
  refresh: () => void;
  isRefreshing: boolean;
}

export function useAutoRefresh(
  intervalMs: number = DEFAULT_INTERVAL_MS,
): UseAutoRefreshResult {
  const queryClient = useQueryClient();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingCount = useIsFetching();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries();
    setLastRefresh(new Date());
  }, [queryClient]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      refresh();
    }, intervalMs);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalMs, refresh]);

  return {
    lastRefresh,
    refresh,
    isRefreshing: fetchingCount > 0,
  };
}
