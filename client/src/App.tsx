import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/NotFound";
import SignIn from "@/pages/SignIn";
import { lazy, Suspense, type ComponentType } from "react";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

/**
 * Everything behind sign-in is split out of the initial bundle.
 *
 * The landing page and sign-in stay eager because they are the first paint for
 * someone who has never been here, and a spinner in that moment costs more
 * than the bytes save. The editor in particular pulls in the markdown renderer
 * and sanitiser, which nobody should download to read a privacy policy.
 */
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Discover = lazy(() => import("@/pages/Discover"));
const Editor = lazy(() => import("@/pages/Editor"));
const Ideas = lazy(() => import("@/pages/Ideas"));
const Privacy = lazy(() =>
  import("@/pages/Legal").then(module => ({ default: module.Privacy }))
);
const Terms = lazy(() =>
  import("@/pages/Legal").then(module => ({ default: module.Terms }))
);
const PublicShelf = lazy(() => import("@/pages/PublicShelf"));
const Search = lazy(() => import("@/pages/Search"));
const Settings = lazy(() => import("@/pages/Settings"));
const Shipped = lazy(() => import("@/pages/Shipped"));
const Thoughts = lazy(() => import("@/pages/Thoughts"));
const Trash = lazy(() => import("@/pages/Trash"));

/** Deliberately blank: a flash of spinner on a fast chunk is worse than none. */
function RouteFallback() {
  return <div className="min-h-screen" />;
}

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
          <Suspense fallback={<RouteFallback />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
