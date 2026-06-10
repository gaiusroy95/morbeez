import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import type { CartLine } from '@morbeez/shared';

const CART_KEY = 'morbeez_shop_cart';

type ShopCartState = {
  items: CartLine[];
  count: number;
  totalPaise: number;
  addItem: (line: Omit<CartLine, 'key' | 'quantity'> & { quantity?: number }) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  ready: boolean;
};

const ShopCartContext = createContext<ShopCartState | null>(null);

function cartKey(variantId: string): string {
  return `v:${variantId}`;
}

async function loadCart(): Promise<CartLine[]> {
  try {
    const raw = await SecureStore.getItemAsync(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCart(items: CartLine[]): Promise<void> {
  try {
    if (!items.length) {
      await SecureStore.deleteItemAsync(CART_KEY);
      return;
    }
    await SecureStore.setItemAsync(CART_KEY, JSON.stringify(items));
  } catch {
    /* ignore persistence errors */
  }
}

export function ShopCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadCart().then((loaded) => {
      setItems(loaded);
      setReady(true);
    });
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setItems(next);
    void saveCart(next);
  }, []);

  const addItem = useCallback(
    (line: Omit<CartLine, 'key' | 'quantity'> & { quantity?: number }) => {
      const key = cartKey(line.variantId);
      const qty = Math.max(1, line.quantity ?? 1);
      setItems((prev) => {
        const existing = prev.find((i) => i.key === key);
        let next: CartLine[];
        if (existing) {
          const newQty = Math.min(existing.maxQuantity, existing.quantity + qty);
          next = prev.map((i) => (i.key === key ? { ...i, quantity: newQty } : i));
        } else {
          next = [
            ...prev,
            {
              ...line,
              key,
              quantity: Math.min(line.maxQuantity, qty),
            },
          ];
        }
        void saveCart(next);
        return next;
      });
    },
    []
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        const next = prev.filter((i) => i.key !== key);
        void saveCart(next);
        return next;
      }
      const next = prev.map((i) =>
        i.key === key ? { ...i, quantity: Math.min(i.maxQuantity, quantity) } : i
      );
      void saveCart(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== key);
      void saveCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    persist([]);
  }, [persist]);

  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const totalPaise = useMemo(
    () => items.reduce((s, i) => s + i.pricePaise * i.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      count,
      totalPaise,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      ready,
    }),
    [items, count, totalPaise, addItem, setQuantity, removeItem, clearCart, ready]
  );

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart(): ShopCartState {
  const ctx = useContext(ShopCartContext);
  if (!ctx) throw new Error('useShopCart must be used within ShopCartProvider');
  return ctx;
}
