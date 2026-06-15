const BROWSER_STAFF_TOKEN_KEY = 'morbeez_admin_token';

function isBrowser(): boolean {  return typeof document !== 'undefined';
}

async function secureStoreModule() {
  if (isBrowser()) {
    return {
      getItemAsync: async () => null,
      setItemAsync: async () => undefined,
      deleteItemAsync: async () => undefined,
    };
  }
  return import('expo-secure-store');
}

export async function readSessionItem(key: string): Promise<string | null> {
  if (isBrowser()) {
    try {
      if (key === BROWSER_STAFF_TOKEN_KEY) {
        return localStorage.getItem(key) ?? sessionStorage.getItem(key);
      }
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
  const SecureStore = await secureStoreModule();
  return SecureStore.getItemAsync(key);
}

export async function writeSessionItem(key: string, value: string): Promise<void> {
  if (isBrowser()) {
    if (key === BROWSER_STAFF_TOKEN_KEY) {
      localStorage.setItem(key, value);
    }
    sessionStorage.setItem(key, value);
    return;
  }
  const SecureStore = await secureStoreModule();
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSessionItem(key: string): Promise<void> {
  if (isBrowser()) {
    if (key === BROWSER_STAFF_TOKEN_KEY) {
      localStorage.removeItem(key);
    }
    sessionStorage.removeItem(key);
    return;
  }
  const SecureStore = await secureStoreModule();
  await SecureStore.deleteItemAsync(key);
}

export async function readPersistedItem(key: string): Promise<string | null> {
  if (isBrowser()) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  const SecureStore = await secureStoreModule();
  return SecureStore.getItemAsync(key);
}

export async function writePersistedItem(key: string, value: string): Promise<void> {
  if (isBrowser()) {
    localStorage.setItem(key, value);
    return;
  }
  const SecureStore = await secureStoreModule();
  await SecureStore.setItemAsync(key, value);
}

export async function deletePersistedItem(key: string): Promise<void> {
  if (isBrowser()) {
    localStorage.removeItem(key);
    return;
  }
  const SecureStore = await secureStoreModule();
  await SecureStore.deleteItemAsync(key);
}
