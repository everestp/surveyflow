import { useCallback, useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import { AuthProvider, useAuth } from "./lib/auth";
import { Builder } from "./pages/Builder";
import { Dashboard } from "./pages/Dashboard";
import { Feed } from "./pages/Feed";
import { Login } from "./pages/Login";
import { SurveyResults } from "./pages/SurveyResults";
import { TakeSurvey } from "./pages/TakeSurvey";

function parsePublicSurveyId(pathname: string): string | null {
  const match = pathname.match(/^\/s\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function parseResultsSurveyId(pathname: string): string | null {
  const match = pathname.match(/^\/surveys\/([^/]+)\/results\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function AppShell() {
  const { user, isAuthenticated, loading } = useAuth();
  const [path, setPath] = useState<string>(
    () => window.location.pathname || "/",
  );

  const navigate = useCallback((nextPath: string) => {
    if (nextPath !== window.location.pathname) {
      window.history.pushState({}, "", nextPath);
    }
    setPath(nextPath);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname || "/");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Redirect already-authenticated users away from /login.
  useEffect(() => {
    if (!loading && isAuthenticated && path === "/login") {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate, path]);

  const publicSurveyId = parsePublicSurveyId(path);
  const resultsSurveyId = parseResultsSurveyId(path);

  const requiresAuth =
    path === "/dashboard" || path === "/builder" || Boolean(resultsSurveyId);

  // Flip this to `user?.role !== "admin"` if Builder or Results should be admin-only.
  const requiresAdmin = false;
  const isAuthorized = !requiresAdmin || user?.role === "admin";

  if (requiresAuth && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-xs text-neutral-500">
        Loading...
      </div>
    );
  }

  if (path === "/login" || (requiresAuth && !isAuthenticated)) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <Navbar currentPath="/login" onNavigate={navigate} />
        <main>
          <Login onSuccess={() => navigate("/dashboard")} />
        </main>
      </div>
    );
  }

  if (requiresAuth && !isAuthorized) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <Navbar currentPath={path} onNavigate={navigate} />
        <main className="mx-auto mt-12 max-w-md rounded border border-neutral-200 bg-white p-6 text-center">
          <h1 className="text-base font-semibold text-neutral-900">
            Admin access required
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            Your account ({user?.role ?? "user"}) does not have permission to
            view this page.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-4 rounded bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Back to Feed
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Navbar currentPath={path} onNavigate={navigate} />
      <main>
        {publicSurveyId ? (
          <TakeSurvey surveyId={publicSurveyId} onNavigate={navigate} />
        ) : path === "/dashboard" ? (
          <Dashboard onNavigate={navigate} />
        ) : path === "/builder" ? (
          <Builder onNavigate={navigate} />
        ) : resultsSurveyId ? (
          <SurveyResults surveyId={resultsSurveyId} onNavigate={navigate} />
        ) : (
          <Feed onNavigate={navigate} />
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
