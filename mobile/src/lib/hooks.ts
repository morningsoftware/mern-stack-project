import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useFocusEffect, useNavigation, usePreventRemove } from 'expo-router';

/** Current time, refreshed on an interval, for deadline labels. */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Reload when a tab regains focus (for example after submitting a report), skipping the first focus. */
export function useRefreshOnFocus(reload: () => void) {
  const first = useRef(true);
  const latest = useRef(reload);
  useEffect(() => { latest.current = reload; });
  // The focus callback never changes identity, so a new `reload` closure cannot retrigger it.
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    latest.current();
  }, []));
}

export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? true);
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Keep editing', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** Ask before leaving a screen that holds unsent work. Call `allowLeave()` right before a deliberate navigation. */
export function useDiscardGuard(dirty: boolean) {
  const navigation = useNavigation();
  const bypass = useRef(false);
  usePreventRemove(dirty, ({ data }) => {
    if (bypass.current) { navigation.dispatch(data.action); return; }
    void confirmAction('Discard this draft?', 'Your unsent changes will be lost.', 'Discard').then(ok => {
      if (ok) navigation.dispatch(data.action);
    });
  });
  return useCallback(() => { bypass.current = true; }, []);
}
