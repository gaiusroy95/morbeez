import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  partnerClient,
  partnerLogout,
  verifyPartnerOtp,
  type PartnerProfile,
} from '@morbeez/shared';

type PartnerAuthContextValue = {
  ready: boolean;
  authed: boolean;
  partner: PartnerProfile | null;
  loginWithOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const PartnerAuthContext = createContext<PartnerAuthContextValue | null>(null);

export function PartnerAuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await partnerClient.me();
      setPartner(me);
    } catch {
      setPartner(null);
      await partnerLogout();
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  const loginWithOtp = useCallback(async (phone: string, code: string) => {
    const r = await verifyPartnerOtp(phone, code);
    setPartner(r.partner);
  }, []);

  const logout = useCallback(async () => {
    await partnerLogout();
    setPartner(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      authed: Boolean(partner),
      partner,
      loginWithOtp,
      logout,
      refresh,
    }),
    [ready, partner, loginWithOtp, logout, refresh]
  );

  return <PartnerAuthContext.Provider value={value}>{children}</PartnerAuthContext.Provider>;
}

export function usePartnerAuth() {
  const ctx = useContext(PartnerAuthContext);
  if (!ctx) throw new Error('usePartnerAuth requires PartnerAuthProvider');
  return ctx;
}
