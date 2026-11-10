import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api";

export function useWorkspaceData<T extends unknown[]>(paths: string[]) {
  const key = JSON.stringify(paths);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const mutationLock = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const result = await Promise.all(
        (JSON.parse(key) as string[]).map((path) =>
          api(path, { signal }),
        ),
      );
      if (!signal?.aborted && mounted.current) setData(result as T);
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
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [refresh]);
  async function mutate(
    path: string,
    body: unknown,
    reset: () => void,
  ): Promise<void> {
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
      if (mounted.current) setError(errorMessage(err));
    } finally {
      mutationLock.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return { data, loading, error, pending, mutate };
}
