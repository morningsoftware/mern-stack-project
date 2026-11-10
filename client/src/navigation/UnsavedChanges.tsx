import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";

interface UnsavedEntry {
  dirty: boolean;
  busy: boolean;
}

interface LeaveGuard {
  register(key: symbol, dirty: boolean, busy: boolean): () => void;
  canLeave(): boolean;
}

const Changes = createContext<LeaveGuard | null>(null);

export function confirmDiscard(
  dirty: boolean,
  message = "Discard your unsaved changes? Choose Cancel to keep editing.",
): boolean {
  return !dirty || window.confirm(message);
}

export function UnsavedChanges({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<symbol, UnsavedEntry>());
  const value = useMemo<LeaveGuard>(
    () => ({
      register(key, dirty, busy) {
        entries.current.set(key, { dirty, busy });
        return () => {
          entries.current.delete(key);
        };
      },
      canLeave() {
        const values = [...entries.current.values()];
        return (
          !values.some((item) => item.busy) &&
          confirmDiscard(values.some((item) => item.dirty))
        );
      },
    }),
    [],
  );
  useLayoutEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        [...entries.current.values()].some((item) => item.dirty || item.busy)
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  return <Changes.Provider value={value}>{children}</Changes.Provider>;
}

export function useLeaveGuard(): LeaveGuard | null {
  return useContext(Changes);
}

export function useUnsavedChanges(dirty: boolean, busy = false): void {
  const context = useContext(Changes);
  const key = useRef(Symbol());
  useLayoutEffect(() => {
    const unregister = context?.register(key.current, dirty, busy);
    return unregister;
  }, [context, dirty, busy]);
}
