import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export function useWorkspaceData(paths) {
  const key = JSON.stringify(paths);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const mutationLock = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(
    async (signal) => {
      const result = await Promise.all(
        JSON.parse(key).map((path) => api(path, { signal })),
      );
      if (!signal?.aborted && mounted.current) setData(result);
    },
    [key],
  );
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    refresh(controller.signal)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [refresh]);
  async function mutate(path, body, reset) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPending(true);
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      if (!mounted.current) return;
      reset();
      await refresh();
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      mutationLock.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return { data, loading, error, pending, mutate };
}
