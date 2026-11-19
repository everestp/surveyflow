import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, getToken, setToken } from "./api";

export interface AdminUser {
  id: string;
  email: string;
  createdAt?: string;
}

interface AuthResponse {
  accessToken: string;
  user?: AdminUser;
}

interface MeResponse {
  user?: AdminUser;
  id?: string;
  email?: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(data: MeResponse | null | undefined): AdminUser | null {
  if (!data) return null;
  if (data.user && data.user.id) return data.user;
  if (data.id && data.email) {
    return { id: data.id, email: data.email };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<AdminUser | null>(null);
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
      setUser(normalizeUser(data));
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
