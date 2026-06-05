import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  canAccess,
  clearToken,
  fetchSession,
  getToken,
  type ApiModule,
  type SessionAdmin,
} from '@/lib/api';

type AuthState = {
  ready: boolean;
  authed: boolean;
  admin: SessionAdmin | null;
  modules: ApiModule[];
  canApprove: boolean;
  canSelfApprove: boolean;
  can: (module: string, mode?: 'read' | 'write') => boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [admin, setAdmin] = useState<SessionAdmin | null>(null);
  const [modules, setModules] = useState<ApiModule[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [canSelfApprove, setCanSelfApprove] = useState(false);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setAuthed(false);
      setAdmin(null);
      setModules([]);
      setCanApprove(false);
      setCanSelfApprove(false);
      return;
    }
    try {
      const session = await fetchSession();
      setAuthed(true);
      setAdmin(session.admin);
      setModules(session.modules);
      setCanApprove(session.canApproveRecommendations);
      setCanSelfApprove(session.canSelfApproveRecommendations);
    } catch {
      await clearToken();
      setAuthed(false);
      setAdmin(null);
      setModules([]);
      setCanApprove(false);
      setCanSelfApprove(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const logout = useCallback(async () => {
    await clearToken();
    setAuthed(false);
    setAdmin(null);
    setModules([]);
    setCanApprove(false);
    setCanSelfApprove(false);
  }, []);

  const canFn = useCallback(
    (module: string, mode: 'read' | 'write' = 'read') => canAccess(modules, module, mode),
    [modules]
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      authed,
      admin,
      modules,
      canApprove,
      canSelfApprove,
      can: canFn,
      logout,
      refresh,
    }),
    [ready, authed, admin, modules, canApprove, canSelfApprove, canFn, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
