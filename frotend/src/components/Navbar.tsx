import { useAuth } from "../lib/auth";

export type RoutePath =
  | "/"
  | "/login"
  | "/builder"
  | `/surveys/${string}/results`
  | `/s/${string}`;

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    onNavigate("/login");
  };

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => onNavigate(isAuthenticated ? "/" : "/login")}
          className="text-sm font-semibold tracking-tight text-neutral-900"
        >
          SurveyFlow
        </button>

        {isAuthenticated && (
          <nav className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => onNavigate("/")}
              className={
                currentPath === "/"
                  ? "font-medium text-neutral-900 underline underline-offset-4"
                  : "text-neutral-600 hover:text-neutral-900"
              }
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => onNavigate("/builder")}
              className={
                currentPath === "/builder"
                  ? "font-medium text-neutral-900 underline underline-offset-4"
                  : "text-neutral-600 hover:text-neutral-900"
              }
            >
              New Survey
            </button>
            <span className="hidden text-xs text-neutral-500 sm:inline">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Sign out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
