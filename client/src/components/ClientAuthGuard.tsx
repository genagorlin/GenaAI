import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

interface AuthStatus {
  authenticated: boolean;
  authorized: boolean;
  email?: string;
  clientName?: string;
  reason?: string;
}

interface ClientAuthGuardProps {
  clientId: string;
  children: React.ReactNode;
}

export function ClientAuthGuard({ clientId, children }: ClientAuthGuardProps) {
  const [, setLocation] = useLocation();

  const { data: authStatus, isLoading, error } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/client-status", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/auth/client-status/${clientId}`);
      if (!res.ok) throw new Error("Failed to check auth status");
      return res.json();
    },
    retry: false,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!isLoading && authStatus && !authStatus.authenticated) {
      const currentPath = window.location.pathname;
      const returnTo = encodeURIComponent(currentPath);
      window.location.href = `/api/client/login?returnTo=${returnTo}`;
    }
  }, [isLoading, authStatus]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Verifying your access...</p>
        </div>
      </div>
    );
  }

  if (error || !authStatus) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-lg font-medium text-slate-900 mb-2">Connection Error</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Unable to verify your access. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!authStatus.authenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (!authStatus.authorized) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-lg font-medium text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {authStatus.reason === "client_not_found" 
              ? "This journal link is not valid. Please check with your coach for the correct link."
              : "This journal belongs to a different account. Please sign in with the correct email address."}
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                const currentPath = window.location.pathname;
                const returnTo = encodeURIComponent(currentPath);
                window.location.href = `/api/client/login?returnTo=${returnTo}`;
              }}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Sign in with different account
            </button>
            <button
              onClick={() => setLocation("/")}
              className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Go to homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
