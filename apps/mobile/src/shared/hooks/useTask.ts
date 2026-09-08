import { useCallback, useEffect, useRef, useState } from 'react';

export function useTask() {
  const locked = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async (operation: () => Promise<unknown>) => {
    if (locked.current) return false;
    locked.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
      return true;
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : '操作に失敗しました。もう一度お試しください。',
        );
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);
  return { pending, error, run, clearError: () => setError(null) };
}
