import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { fetch as expoFetch } from 'expo/fetch';
import { ApiClient, validateOrigin } from './api';
import type { User } from './models';

export const api = new ApiClient(validateOrigin(process.env.EXPO_PUBLIC_API_URL || 'https://checkpoint.morning.codes', __DEV__), expoFetch as typeof fetch);
const key = 'checkpoint.session.v1';
const store = {
  get: () => Platform.OS === 'web' ? Promise.resolve(sessionStorage.getItem(key)) : SecureStore.getItemAsync(key),
  set: (value: string) => Platform.OS === 'web' ? Promise.resolve(sessionStorage.setItem(key, value)) : SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  clear: () => Platform.OS === 'web' ? Promise.resolve(sessionStorage.removeItem(key)) : SecureStore.deleteItemAsync(key),
};
type SessionContext = { user: User | null; loading: boolean; error: string; signIn: (body: Record<string, string>, register?: boolean) => Promise<void>; signOut: () => Promise<void>; retry: () => void };
const Context = createContext<SessionContext | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const signOut = useCallback(async () => {
    generation.current++;
    api.setToken(null); setUser(null); setError(''); setLoading(false);
    try { await store.clear(); } catch { setError('Signed out. Device storage could not be cleared; retry sign-out before sharing this device.'); }
  }, []);
  useEffect(() => {
    api.onUnauthorized = () => { void signOut(); };
    return () => { api.onUnauthorized = null; };
  }, [signOut]);
  useEffect(() => {
    const id = ++generation.current;
    const controller = new AbortController();
    async function restore() {
      try {
        const stored = await store.get();
        if (id !== generation.current || !stored) return;
        const session = JSON.parse(stored);
        if (session.origin !== api.origin || typeof session.token !== 'string') { await store.clear(); return; }
        api.setToken(session.token);
        const result = await api.request<{ user: User }>('/api/auth/me', { signal: controller.signal });
        if (id === generation.current) setUser(result.user);
      } catch (err) {
        if (!controller.signal.aborted && id === generation.current) { api.setToken(null); setError(err instanceof Error ? err.message : 'Could not restore the session.'); }
      } finally { if (id === generation.current) setLoading(false); }
    }
    void restore();
    return () => controller.abort();
  }, [attempt]);
  async function signIn(body: Record<string, string>, register = false) {
    const id = ++generation.current;
    const result = await api.request<{ token: string; user: User }>(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(body) });
    if (id !== generation.current) return;
    // Secure storage must succeed before treating the device as signed in.
    await store.set(JSON.stringify({ origin: api.origin, token: result.token }));
    if (id !== generation.current) { await store.clear(); return; }
    api.setToken(result.token); setUser(result.user); setError(''); setLoading(false);
  }
  return <Context.Provider value={{ user, loading, error, signIn, signOut, retry: () => { setLoading(true); setError(''); setAttempt(n => n + 1); } }}>{children}</Context.Provider>;
}
export function useSession() { const value = useContext(Context); if (!value) throw new Error('SessionProvider is missing.'); return value; }
