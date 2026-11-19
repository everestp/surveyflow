import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, getToken, setToken } from "./api";

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: string;
  email: string;
  role?: UserRole;
  createdAt?: string;
}

export type AdminUser = AuthUser;

interface AuthResponse {
  accessToken: string;
  user?: AuthUser;
}

interface MeResponse {
  user?: AuthUser;
  id?: string;
  email?: string;
  role?: UserRole;
  createdAt?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(data: MeResponse | null | undefined): AuthUser | null {
  if (!data) return null;
  if (data.user && data.user.id) return data.user;
  if (data.id && data.email) {
    return {
      id: data.id,
      email: data.email,
      role: data.role,
      createdAt: data.createdAt,
    };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(getToken()));

  const applyToken = useCallback((nextToken: string | null) => {
    setToken(nextToken);
    setTokenState(nextToken);
    if (!nextToken) {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = getToken();
    if (!currentToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<MeResponse>("/auth/me");
      const normalized = normalizeUser(data);
      if (!normalized) {
        applyToken(null);
        return;
      }
      setUser(normalized);
    } catch {
      applyToken(null);
    } finally {
      setLoading(false);
    }
  }, [applyToken]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onUnauthorized = () => {
      applyToken(null);
    };
    window.addEventListener("surveyflow:unauthorized", onUnauthorized);
    return () => {
      window.removeEventListener("surveyflow:unauthorized", onUnauthorized);
    };
  }, [applyToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      if (!data?.accessToken) {
        throw new Error("Missing accessToken in login response");
      }
      applyToken(data.accessToken);
      if (data.user) {
        setUser(data.user);
      } else {
        await refreshUser();
      }
    },
    [applyToken, refreshUser],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      if (!data?.accessToken) {
        throw new Error("Missing accessToken in register response");
      }
      applyToken(data.accessToken);
      if (data.user) {
        setUser(data.user);
      } else {
        await refreshUser();
      }
    },
    [applyToken, refreshUser],
  );

  const logout = useCallback(() => {
    applyToken(null);
  }, [applyToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(token),
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
