import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

const Changes = createContext(null);
export function confirmDiscard(
  dirty,
  message = "Discard your unsaved changes? Choose Cancel to keep editing.",
) {
  return !dirty || window.confirm(message);
}
export function UnsavedChanges({ children }) {
  const entries = useRef(new Map());
  const value = useMemo(
    () => ({
      register(key, dirty, busy) {
        entries.current.set(key, { dirty, busy });
        return () => entries.current.delete(key);
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
    const beforeUnload = (event) => {
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
export function useLeaveGuard() {
  return useContext(Changes);
}
export function useUnsavedChanges(dirty, busy = false) {
  const context = useContext(Changes);
  const key = useRef(Symbol());
  useLayoutEffect(
    () => context?.register(key.current, dirty, busy),
    [context, dirty, busy],
  );
}
