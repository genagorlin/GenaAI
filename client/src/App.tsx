import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import CoachPage from "@/pages/CoachPage";
import AdminPage from "@/pages/AdminPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import ChatPage from "@/pages/ChatPage";
import InboxPage from "@/pages/InboxPage";
import ClientAccessDenied from "@/pages/ClientAccessDenied";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/chat/:clientId/:threadId" component={ChatPage} />
      <Route path="/chat/:clientId" component={InboxPage} />
      <Route path="/inbox/:clientId" component={InboxPage} />
      <Route path="/unauthorized" component={UnauthorizedPage} />
      <Route path="/client-access-denied" component={ClientAccessDenied} />
      {isLoading ? (
        <Route path="/">
          {() => (
            <div className="flex min-h-screen items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
          )}
        </Route>
      ) : !isAuthenticated ? (
        <Route path="/" component={LandingPage} />
      ) : (
        <>
          <Route path="/" component={CoachPage} />
          <Route path="/admin" component={AdminPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
