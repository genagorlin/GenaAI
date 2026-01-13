import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface AuthStatus {
  authenticated: boolean;
  email: string | null;
  role: string | null;
  clientId: string | null;
}

export function useAuth() {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const { data: authStatus, isLoading: statusLoading } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      return res.json();
    },
    retry: false,
  });

  return {
    user,
    isLoading: userLoading || statusLoading,
    isAuthenticated: !!user || authStatus?.authenticated,
    role: authStatus?.role || null,
    clientId: authStatus?.clientId || null,
    isClient: authStatus?.role === "client",
    isCoach: authStatus?.role === "admin" || authStatus?.role === "user",
  };
}
