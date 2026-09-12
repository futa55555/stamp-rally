import { useEffect, useRef, useState } from 'react';
import { useData } from '../app-data/AppDataProvider';
import { normalizeLocations } from '../trips/model/validation';
import type {
  SaveTemplateEdit,
  TemplateChange,
  TemplateEditPreview,
} from './edit-types';

type Confirm = (preview: TemplateEditPreview) => Promise<boolean>;
const message = (error: unknown) =>
  error instanceof Error ? error.message : '候補を取得できませんでした。';
export function useTripTemplateEdit(
  tripId: string | undefined,
  locations: string[],
  activityPresets: string[],
  confirm: Confirm,
) {
  const { client, userId } = useData();
  const [changes, setChanges] = useState<TemplateChange[]>([]);
  const [result, setResult] = useState<{
    key: string;
    value: TemplateEditPreview;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const confirmed = useRef<string | null>(null);
  const key = JSON.stringify({
    locations: normalizeLocations(locations),
    activityPresets,
    changes,
  });
  const current = useRef(key);
  current.current = key;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!tripId || !userId) return;
    const controller = new AbortController();
    const guard = client.sessionGuard();
    const timer = setTimeout(() => {
      void client
        .request<TemplateEditPreview>({
          method: 'POST',
          url: `/trips/${tripId}/template-preview`,
          data: JSON.parse(key),
          signal: controller.signal,
        })
        .then((value) => {
          guard();
          if (!controller.signal.aborted && current.current === key) {
            setResult({ key, value });
            setFailure(null);
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted && current.current === key)
            setFailure({ key, message: message(error) });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [client, tripId, userId, key, attempt]);

  const fetchPreview = async (inputKey: string) => {
    const guard = client.sessionGuard();
    const value = await client.request<TemplateEditPreview>({
      method: 'POST',
      url: `/trips/${tripId}/template-preview`,
      data: JSON.parse(inputKey),
    });
    guard();
    if (!mounted.current || current.current !== key)
      throw new Error('入力が変わりました。もう一度操作してください。');
    return { value, guard };
  };
  const toggle = async (change: TemplateChange) => {
    if (!tripId || locked.current) return;
    locked.current = true;
    setBusy(true);
    setFailure(null);
    try {
      // Keep one explicit override per checkbox, in user action order.
      const nextChanges = [
        ...changes.filter(
          (item) =>
            !(
              item.categoryRef === change.categoryRef &&
              item.stampRef === change.stampRef
            ),
        ),
        change,
      ];
      const nextKey = JSON.stringify({
        ...JSON.parse(key),
        changes: nextChanges,
      });
      const { value, guard } = await fetchPreview(nextKey);
      const category = result?.value.categories.find(
        (item) => item.ref === change.categoryRef,
      );
      const existing = change.stampRef
        ? category?.stamps.find((item) => item.ref === change.stampRef)?.id
        : category?.id;
      if (!change.selected && existing) {
        if (!(await confirm(value))) return;
        guard();
        if (!mounted.current || current.current !== key) return;
        confirmed.current = value.confirmationToken;
      }
      setChanges(nextChanges);
      setResult({ key: nextKey, value });
    } catch (error) {
      if (mounted.current && current.current === key)
        setFailure({ key, message: message(error) });
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const prepare = async (
    clientRequestId: string,
  ): Promise<SaveTemplateEdit | null> => {
    const { value, guard } = await fetchPreview(key);
    setResult({ key, value });
    if (
      value.impact.stampCount > 0 &&
      value.confirmationToken !== confirmed.current
    ) {
      if (!(await confirm(value))) return null;
      guard();
      if (!mounted.current || current.current !== key)
        throw new Error('入力が変わりました。もう一度保存してください。');
      confirmed.current = value.confirmationToken;
    }
    return {
      clientRequestId,
      changes,
      confirmationToken: value.confirmationToken,
    };
  };
  const error = failure?.key === key ? failure.message : null;
  return {
    categories: result?.value.categories ?? [],
    ready: !tripId || (result?.key === key && !error && !busy),
    pending: !!tripId && result?.key !== key && !error,
    busy,
    error,
    dirty: changes.length > 0,
    toggle,
    prepare,
    retry: () => {
      setFailure(null);
      setAttempt((value) => value + 1);
    },
  };
}
