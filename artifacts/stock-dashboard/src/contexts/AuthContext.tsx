import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  plan: "free" | "pro" | "premium";
  joinedAt: string;
  lastLogin: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; message?: string; devResetUrl?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => void;
  allUsers: () => User[];
  deleteUser: (id: number) => void;
  updateUserPlan: (id: number, plan: "free" | "pro" | "premium") => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function api<T>(path: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: T | { error: string } }> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({ error: "Unexpected server response." }));
  return { ok: res.ok, status: res.status, data };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  const refreshUsers = useCallback(async (currentUser: User | null) => {
    if (currentUser?.role !== "admin") {
      setUsers([]);
      return;
    }
    const res = await api<User[]>("/admin/users");
    if (res.ok) setUsers(res.data as User[]);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await api<{ user: User }>("/auth/me");
      if (res.ok) {
        const me = (res.data as { user: User }).user;
        setUser(me);
        await refreshUsers(me);
      }
      setIsLoading(false);
    })();
  }, [refreshUsers]);

  const login = async (email: string, password: string) => {
    const res = await api<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { success: false, error: (res.data as { error: string }).error };
    const me = (res.data as { user: User }).user;
    setUser(me);
    await refreshUsers(me);
    return { success: true };
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) return { success: false, error: (res.data as { error: string }).error };
    const me = (res.data as { user: User }).user;
    setUser(me);
    return { success: true };
  };

  const requestPasswordReset = async (email: string) => {
    const res = await api<{ message: string; devResetUrl?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return { success: false, error: (res.data as { error: string }).error };
    const data = res.data as { message: string; devResetUrl?: string };
    return { success: true, message: data.message, devResetUrl: data.devResetUrl };
  };

  const resetPassword = async (token: string, password: string) => {
    const res = await api<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) return { success: false, error: (res.data as { error: string }).error };
    return { success: true, message: (res.data as { message: string }).message };
  };

  const logout = () => {
    setUser(null);
    setUsers([]);
    void api("/auth/logout", { method: "POST" });
  };

  const allUsers = (): User[] => users;

  const deleteUser = (id: number) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    void api(`/admin/users/${id}`, { method: "DELETE" });
  };

  const updateUserPlan = (id: number, plan: "free" | "pro" | "premium") => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, plan } : u)));
    void api(`/admin/users/${id}/plan`, { method: "POST", body: JSON.stringify({ plan }) });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, requestPasswordReset, resetPassword, logout, allUsers, deleteUser, updateUserPlan }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
