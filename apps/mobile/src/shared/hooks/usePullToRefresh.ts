import { useTask } from './useTask';

export function usePullToRefresh(invalidate: () => Promise<unknown>) {
  const { pending, run } = useTask();
  return {
    // Background refetches must not start the native refresh animation, which
    // changes the scroll offset on iOS.
    refreshing: pending,
    onRefresh: () => {
      void run(invalidate);
    },
  };
}
