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
  verifyStaffOtp,
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
  login: (phone: string, password: string, email?: string) => Promise<void>;
  loginWithOtp: (phone: string, code: string) => Promise<void>;
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
      async (phone: string, password: string, email?: string) => {
        await staffLogin(phone, password, email);
        const session = await fetchStaffSession();
        assertModuleAccess(session.modules, requiredModule, requireWrite ? 'write' : 'read');
        setAdmin(session.admin);
        setModules(session.modules);
        setAuthed(true);
        setReady(true);
      },
      []
    );

    const loginWithOtp = useCallback(
      async (phone: string, code: string) => {
        await verifyStaffOtp(phone, code);
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
        loginWithOtp,
      }),
      [ready, authed, admin, modules, logout, refresh, login, loginWithOtp]
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
