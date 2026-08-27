import { trpc } from "@/lib/trpc";
import { useCallback } from "react";
import { useLocation } from "wouter";

/**
 * Single source of truth for who is signed in. `auth.me` returns null rather
 * than erroring when there's no session, so an anonymous visitor is a normal
 * state here, not a failure.
 */
export function useAuth() {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      utils.auth.me.setData(undefined, null);
      // Drop every cached query so the next account can't see stale data.
      await utils.invalidate();
      navigate("/");
    },
  });

  const logout = useCallback(
    () => logoutMutation.mutateAsync(),
    [logoutMutation]
  );

  return {
    user: meQuery.data ?? null,
    isAuthenticated: Boolean(meQuery.data),
    /** True only on the first load, so the UI doesn't flash on refetches. */
    isLoading: meQuery.isPending,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
