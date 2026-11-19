import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

interface LoginProps {
  onSuccess: () => void;
}

export function Login({ onSuccess }: LoginProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === "login") {
        await login(normalizedEmail, password);
      } else {
        await register(normalizedEmail, password);
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Authentication failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-sm rounded border border-neutral-200 bg-white p-6">
      <div className="mb-5 flex border-b border-neutral-200 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`flex-1 pb-2.5 font-medium ${
            mode === "login"
              ? "border-b-2 border-neutral-900 text-neutral-900"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setError(null);
          }}
          className={`flex-1 pb-2.5 font-medium ${
            mode === "register"
              ? "border-b-2 border-neutral-900 text-neutral-900"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Register
        </button>
      </div>

      <h1 className="text-base font-semibold text-neutral-900">
        {mode === "login" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-1 text-xs text-neutral-500">
        {mode === "login"
          ? "Sign in with your account to continue."
          : "Register a new account. The first registered account receives admin access."}
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded border border-neutral-900 bg-neutral-100 px-3 py-2 text-xs text-neutral-900"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="auth-email"
            className="block text-xs font-medium text-neutral-700"
          >
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="block text-xs font-medium text-neutral-700"
          >
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            required
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {submitting
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
