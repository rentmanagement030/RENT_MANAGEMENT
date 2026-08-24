import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
        return failureCount < 1;
      },
      // 1. Instant loading: keep data fresh in memory for 30 seconds so page navigation is 0ms instant
      staleTime: 30_000,
      gcTime: 10 * 60_000, // 10 minutes cache retention
      // 2. Disable aggressive global polling to conserve bandwidth, CPU, and battery
      refetchInterval: false,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true, // Auto-refresh when user returns to window/tab
      refetchOnReconnect: true,
      // 3. Keep previous data during refetches so screens never flash blank skeletons
      placeholderData: (previousData: any) => previousData,
    },
    mutations: {
      retry: false,
    },
  },
});
