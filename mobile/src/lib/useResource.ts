import { useEffect, useState } from 'react';
import { api, useSession } from './session';
export function useResource<T>(path: string | null) {
  const { user } = useSession();
  const [state, setState] = useState<{ key: string; data: T | null; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = path && user ? `${user._id}:${path}:${attempt}` : null;
  useEffect(() => {
    if (!path || !key) return;
    const controller = new AbortController();
    api.request<T>(path, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setState({ key, data: result, error: '' }); })
      .catch(err => { if (!controller.signal.aborted) setState({ key, data: null, error: err.message }); });
    return () => controller.abort();
  }, [path, key]);
  return { data: state?.key === key ? state!.data : null, loading: !!key && state?.key !== key, error: state?.key === key ? state!.error : '', reload: () => setAttempt(n => n + 1) };
}
