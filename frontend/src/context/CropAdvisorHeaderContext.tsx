import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

export type CrmNotification = { id: string; message: string; at: string };

export type CropAdvisorHeaderState = {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  canWrite: boolean;
  onAddLead: () => void;
  selectedPhone: string | null;
  unreadNotifications: number;
  pendingEscalations: number;
  onViewEscalations: () => void;
  notifications: CrmNotification[];
  showNotifications: boolean;
  setShowNotifications: Dispatch<SetStateAction<boolean>>;
  onToggleNotifications: () => void;
};

const defaultState: CropAdvisorHeaderState = {
  search: '',
  setSearch: () => {},
  canWrite: false,
  onAddLead: () => {},
  selectedPhone: null,
  unreadNotifications: 0,
  pendingEscalations: 0,
  onViewEscalations: () => {},
  notifications: [],
  showNotifications: false,
  setShowNotifications: () => {},
  onToggleNotifications: () => {},
};

type CropAdvisorHeaderContextValue = CropAdvisorHeaderState & {
  patchHeader: (patch: Partial<CropAdvisorHeaderState>) => void;
};

const CropAdvisorHeaderContext = createContext<CropAdvisorHeaderContextValue | null>(null);

export function CropAdvisorHeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CropAdvisorHeaderState>(defaultState);

  const patchHeader = useCallback((patch: Partial<CropAdvisorHeaderState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      patchHeader,
    }),
    [state, patchHeader]
  );

  return (
    <CropAdvisorHeaderContext.Provider value={value}>{children}</CropAdvisorHeaderContext.Provider>
  );
}

export function useCropAdvisorHeader() {
  const ctx = useContext(CropAdvisorHeaderContext);
  if (!ctx) throw new Error('useCropAdvisorHeader must be used within CropAdvisorHeaderProvider');
  return ctx;
}

export function useCropAdvisorHeaderOptional() {
  return useContext(CropAdvisorHeaderContext);
}
