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
  assertModuleAccess,
  canAccessModule,
  clearStaffToken,
  fetchStaffSession,
  getStaffToken,
  staffLogin,
  type ApiModule,
  type SessionAdmin,
} from '../api/staff-client';

type StaffAuthState = {
  ready: boolean;
  authed: boolean;
  admin: SessionAdmin | null;
  modules: ApiModule[];
  can: (module: string, mode?: 'read' | 'write') => boolean;
  canWrite: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
};

export function createStaffAuth(requiredModule: string, requireWrite = false) {
  const StaffAuthContext = createContext<StaffAuthState | null>(null);

  function StaffAuthProvider({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState(false);
    const [authed, setAuthed] = useState(false);
    const [admin, setAdmin] = useState<SessionAdmin | null>(null);
    const [modules, setModules] = useState<ApiModule[]>([]);

    const refresh = useCallback(async () => {
      const token = await getStaffToken();
      if (!token) {
        setAuthed(false);
        setAdmin(null);
        setModules([]);
        setReady(true);
        return;
      }
      try {
        const session = await fetchStaffSession();
        assertModuleAccess(session.modules, requiredModule, requireWrite ? 'write' : 'read');
        setAdmin(session.admin);
        setModules(session.modules);
        setAuthed(true);
      } catch {
        await clearStaffToken();
        setAuthed(false);
        setAdmin(null);
        setModules([]);
      } finally {
        setReady(true);
      }
    }, []);

    useEffect(() => {
      setReady(false);
      void refresh();
    }, [refresh]);

    const login = useCallback(
      async (email: string, password: string) => {
        await staffLogin(email, password);
        const session = await fetchStaffSession();
        assertModuleAccess(session.modules, requiredModule, requireWrite ? 'write' : 'read');
        setAdmin(session.admin);
        setModules(session.modules);
        setAuthed(true);
        setReady(true);
      },
      []
    );

    const logout = useCallback(async () => {
      await clearStaffToken();
      setAuthed(false);
      setAdmin(null);
      setModules([]);
    }, []);

    const value = useMemo<StaffAuthState>(
      () => ({
        ready,
        authed,
        admin,
        modules,
        can: (module, mode = 'read') => canAccessModule(modules, module, mode),
        canWrite: canAccessModule(modules, requiredModule, 'write'),
        logout,
        refresh,
        login,
      }),
      [ready, authed, admin, modules, logout, refresh, login]
    );

    return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
  }

  function useStaffAuth(): StaffAuthState {
    const ctx = useContext(StaffAuthContext);
    if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider');
    return ctx;
  }

  return { StaffAuthProvider, useStaffAuth };
}
