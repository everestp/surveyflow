import { useCallback, useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import { AuthProvider, useAuth } from "./lib/auth";
import { Builder } from "./pages/Builder";
import { Dashboard } from "./pages/Dashboard";
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
  const { isAuthenticated, loading } = useAuth();
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

  const publicSurveyId = parsePublicSurveyId(path);
  if (publicSurveyId) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <Navbar currentPath={path} onNavigate={navigate} />
        <main>
          <TakeSurvey surveyId={publicSurveyId} />
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-xs text-neutral-500">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || path === "/login") {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <Navbar currentPath="/login" onNavigate={navigate} />
        <main>
          <Login onSuccess={() => navigate("/")} />
        </main>
      </div>
    );
  }

  const resultsSurveyId = parseResultsSurveyId(path);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Navbar currentPath={path} onNavigate={navigate} />
      <main>
        {path === "/builder" ? (
          <Builder onNavigate={navigate} />
        ) : resultsSurveyId ? (
          <SurveyResults surveyId={resultsSurveyId} onNavigate={navigate} />
        ) : (
          <Dashboard onNavigate={navigate} />
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
