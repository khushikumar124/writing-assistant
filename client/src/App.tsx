import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import Discover from "@/pages/Discover";
import Editor from "@/pages/Editor";
import Ideas from "@/pages/Ideas";
import Landing from "@/pages/Landing";
import { Privacy, Terms } from "@/pages/Legal";
import NotFound from "@/pages/NotFound";
import PublicShelf from "@/pages/PublicShelf";
import Search from "@/pages/Search";
import Settings from "@/pages/Settings";
import Shipped from "@/pages/Shipped";
import SignIn from "@/pages/SignIn";
import Thoughts from "@/pages/Thoughts";
import Trash from "@/pages/Trash";
import type { ComponentType } from "react";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

/** Gates a route on an active session, bouncing anonymous visitors to sign-in. */
function Protected({ component: Component }: { component: ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div
          className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return isAuthenticated ? <Component /> : <Redirect to="/signin" />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {isLoading ? null : isAuthenticated ? <Dashboard /> : <Landing />}
      </Route>

      {/* Public: no session needed. */}
      <Route path="/signin" component={SignIn} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      {/* A regex, not "/@:username": wouter's path parser treats the leading
          "@" as part of the literal segment and never matches the param. */}
      <Route
        path={/^\/@(?<username>[A-Za-z0-9_-]+)$/}
        component={PublicShelf}
      />

      <Route path="/ideas" component={() => <Protected component={Ideas} />} />
      <Route
        path="/ideas/:id"
        component={() => <Protected component={Editor} />}
      />
      <Route
        path="/thoughts"
        component={() => <Protected component={Thoughts} />}
      />
      <Route
        path="/discover"
        component={() => <Protected component={Discover} />}
      />
      <Route
        path="/shipped"
        component={() => <Protected component={Shipped} />}
      />
      <Route
        path="/search"
        component={() => <Protected component={Search} />}
      />
      <Route
        path="/settings"
        component={() => <Protected component={Settings} />}
      />
      <Route path="/trash" component={() => <Protected component={Trash} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster position="bottom-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
