import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import RegisterPage from "@/pages/RegisterPage";
import CoachPage from "@/pages/CoachPage";
import AdminPage from "@/pages/AdminPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import ChatPage from "@/pages/ChatPage";
import InboxPage from "@/pages/InboxPage";
import ExercisePage from "@/pages/ExercisePage";
import ContactGenaPage from "@/pages/ContactGenaPage";
import ClientAccessDenied from "@/pages/ClientAccessDenied";

// Component to handle client redirect at root
function ClientHome() {
  const { clientId, isClient, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If user is a client with a clientId, redirect to their inbox
  if (isClient && clientId) {
    return <Redirect to={`/inbox/${clientId}`} />;
  }

  // Otherwise show coach dashboard
  return <CoachPage />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/register" component={RegisterPage} />
      <Route path="/contact/:clientId" component={ContactGenaPage} />
      <Route path="/exercise/:clientId/:sessionId" component={ExercisePage} />
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
          <Route path="/" component={ClientHome} />
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
