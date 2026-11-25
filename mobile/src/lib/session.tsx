
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { ApiClient, validateOrigin } from './api';
import type { User } from './models';

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const DEFAULT_API_URL = 'https://checkpoint.morning.codes';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

const SESSION_STORAGE_KEY = 'checkpoint.session.v1';

// Use the default React Native fetch implementation.
// Do not import expoFetch here.
export const api = new ApiClient(
  validateOrigin(API_URL, __DEV__)
);

console.log('[mobile API origin]', api.origin);

// --------------------------------------------------
// Session storage
// --------------------------------------------------

const sessionStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    }

    return SecureStore.getItemAsync(SESSION_STORAGE_KEY);
  },

  async set(value: string): Promise<void> {
    if (Platform.OS === 'web') {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, value);
      return;
    }

    await SecureStore.setItemAsync(
      SESSION_STORAGE_KEY,
      value,
      {
        keychainAccessible:
          SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }
    );
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  },
};

// --------------------------------------------------
// Serialize storage modifications
// --------------------------------------------------

let storageQueue: Promise<void> = Promise.resolve();

function updateStorage(
  operation: () => Promise<void>
): Promise<void> {
  const result = storageQueue.then(operation, operation);

  storageQueue = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}

// --------------------------------------------------
// Stored session validation
// --------------------------------------------------

type StoredSession = {
  origin: string;
  token: string;
};

function parseStoredSession(
  value: string
): StoredSession | null {
  try {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('origin' in parsed) ||
      !('token' in parsed)
    ) {
      return null;
    }

    if (
      typeof parsed.origin !== 'string' ||
      typeof parsed.token !== 'string' ||
      !parsed.token.trim() ||
      parsed.origin !== api.origin
    ) {
      return null;
    }

    return {
      origin: parsed.origin,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

// --------------------------------------------------
// Session context
// --------------------------------------------------

type SessionContext = {
  user: User | null;
  loading: boolean;
  error: string;

  signIn: (
    body: Record<string, string>,
    register?: boolean
  ) => Promise<void>;

  signOut: () => Promise<void>;

  retry: () => void;
};

const Context = createContext<SessionContext | null>(null);

// --------------------------------------------------
// Session provider
// --------------------------------------------------

export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  // Prevent outdated asynchronous operations from
  // changing the current authentication state.
  const generation = useRef(0);

  // ------------------------------------------------
  // Sign out
  // ------------------------------------------------

  const signOut = useCallback(async () => {
    const id = ++generation.current;

    api.setToken(null);

    setUser(null);
    setError('');
    setLoading(false);

    try {
      await updateStorage(() => sessionStorage.clear());
    } catch {
      if (id === generation.current) {
        setError(
          'Signed out. Device storage could not be cleared; retry sign-out before sharing this device.'
        );
      }
    }
  }, []);

  // ------------------------------------------------
  // Handle unauthorized API responses
  // ------------------------------------------------

  useEffect(() => {
    api.onUnauthorized = () => {
      void signOut();
    };

    return () => {
      api.onUnauthorized = null;
    };
  }, [signOut]);

  // ------------------------------------------------
  // Restore an existing session
  // ------------------------------------------------

  const restoreSession = useCallback(
    async (id: number, signal: AbortSignal) => {
      try {
        const stored = await sessionStorage.get();

        if (
          id !== generation.current ||
          signal.aborted
        ) {
          return;
        }

        if (!stored) {
          api.setToken(null);
          return;
        }

        const session = parseStoredSession(stored);

        if (!session) {
          // Check again before queuing a clear operation.
          if (id !== generation.current) return;

          await updateStorage(() => sessionStorage.clear());

          if (id !== generation.current) return;

          api.setToken(null);
          return;
        }

        api.setToken(session.token);

        const result = await api.request<{ user: User }>(
          '/api/auth/me',
          { signal }
        );

        if (id !== generation.current) return;

        setUser(result.user);
        setError('');
      } catch (err) {
        if (
          signal.aborted ||
          id !== generation.current
        ) {
          return;
        }

        api.setToken(null);

        setError(
          err instanceof Error
            ? err.message
            : 'Could not restore the session.'
        );

        // Preserve stored credentials during temporary
        // network or server failures.
      } finally {
        if (id === generation.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const id = ++generation.current;
    const controller = new AbortController();

    void restoreSession(id, controller.signal);

    return () => {
      controller.abort();
    };
  }, [restoreSession, attempt]);

  // ------------------------------------------------
  // Sign in / Register
  // ------------------------------------------------

  const signIn = useCallback(
    async (
      body: Record<string, string>,
      register = false
    ): Promise<void> => {
      console.log('[signIn] Handler reached');

      const id = ++generation.current;

      const endpoint = register
        ? '/api/auth/register'
        : '/api/auth/login';

      console.log(
        '[signIn] Sending request to:',
        api.origin + endpoint
      );

      try {
        const result = await api.request<{
          token: string;
          user: User;
        }>(endpoint, {
          method: 'POST',
          body: JSON.stringify(body),
        });

        if (id !== generation.current) return;

        if (
          typeof result.token !== 'string' ||
          !result.token.trim() ||
          !result.user
        ) {
          throw new Error(
            'The server returned an invalid authentication response.'
          );
        }

        // Save credentials before treating the device
        // as signed in.
        await updateStorage(() =>
          sessionStorage.set(
            JSON.stringify({
              origin: api.origin,
              token: result.token,
            })
          )
        );

        if (id !== generation.current) return;

        api.setToken(result.token);

        setUser(result.user);
        setError('');
        setLoading(false);
      } catch (err) {
        if (id === generation.current) {
          setLoading(false);

          setError(
            err instanceof Error
              ? err.message
              : 'Could not sign in. Please try again.'
          );
        }

        throw err;
      }
    },
    []
  );

  // ------------------------------------------------
  // Retry session restoration
  // ------------------------------------------------

  const retry = useCallback(() => {
    setLoading(true);
    setError('');

    setAttempt((current) => current + 1);
  }, []);

  // ------------------------------------------------
  // Context value
  // ------------------------------------------------

  const value: SessionContext = {
    user,
    loading,
    error,
    signIn,
    signOut,
    retry,
  };

  return (
    <Context.Provider value={value}>
      {children}
    </Context.Provider>
  );
}

// --------------------------------------------------
// Session hook
// --------------------------------------------------

export function useSession(): SessionContext {
  const value = useContext(Context);

  if (!value) {
    throw new Error('SessionProvider is missing.');
  }

  return value;
}
