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
  clearFarmerToken,
  fetchFarmerMe,
  getFarmerToken,
  isFarmerAuthError,
  isFarmerTokenExpired,
  type FarmerProfile,
} from '@morbeez/shared';

type FarmerAuthState = {
  ready: boolean;
  authed: boolean;
  farmer: FarmerProfile | null;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const FarmerAuthContext = createContext<FarmerAuthState | null>(null);

export function FarmerAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);

  const refresh = useCallback(async () => {
    const token = await getFarmerToken();
    if (!token) {
      setAuthed(false);
      setFarmer(null);
      setReady(true);
      return;
    }
    if (isFarmerTokenExpired(token)) {
      await clearFarmerToken();
      setAuthed(false);
      setFarmer(null);
      setReady(true);
      return;
    }
    try {
      const profile = await fetchFarmerMe();
      setFarmer(profile);
      setAuthed(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (isFarmerAuthError(msg)) {
        await clearFarmerToken();
        setAuthed(false);
        setFarmer(null);
      } else {
        setAuthed(true);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    setReady(false);
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await clearFarmerToken();
    setAuthed(false);
    setFarmer(null);
  }, []);

  const value = useMemo(
    () => ({ ready, authed, farmer, logout, refresh }),
    [ready, authed, farmer, logout, refresh]
  );

  return <FarmerAuthContext.Provider value={value}>{children}</FarmerAuthContext.Provider>;
}

export function useFarmerAuth(): FarmerAuthState {
  const ctx = useContext(FarmerAuthContext);
  if (!ctx) throw new Error('useFarmerAuth must be used within FarmerAuthProvider');
  return ctx;
}
