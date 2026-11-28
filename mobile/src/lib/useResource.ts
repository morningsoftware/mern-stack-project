import { useCallback, useEffect, useState } from 'react';
import { api, useSession } from './session';

interface Result<T> { scope: string; attempt: number; data: T | null; error: string }

/**
 * GET a JSON resource for the signed-in user. Data from a previous load stays on screen
 * while a reload runs (`refreshing`), so pull-to-refresh never blanks the list.
 */
export function useResource<T>(path: string | null) {
  const { user } = useSession();
  const scope = path && user ? `${user._id}:${path}` : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    if (!scope || !path) return;
    const controller = new AbortController();
    api.request<T>(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ scope, attempt, data, error: '' }); })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const error = err instanceof Error ? err.message : 'Something went wrong. Try again.';
        setResult(previous => ({ scope, attempt, data: previous?.scope === scope ? previous.data : null, error }));
      });
    return () => controller.abort();
  }, [scope, path, attempt]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const sameScope = !!result && result.scope === scope;
  const settled = sameScope && result.attempt === attempt;
  const data = sameScope ? result.data : null;
  const loading = !!scope && !settled;
  return { data, error: settled ? result.error : '', loading, refreshing: loading && data !== null, reload };
}
