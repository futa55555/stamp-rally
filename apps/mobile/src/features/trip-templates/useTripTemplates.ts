import { useEffect, useRef, useState } from 'react';
import { useData } from '../app-data/AppDataProvider';
import { normalizeLocations } from '../trips/model/validation';
import { reconcileSelection, stampSelectionKey } from './selection';
import type {
  TemplateCategory,
  TemplatePresets,
  TemplateSelection,
} from './types';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '候補を取得できませんでした。';

export function useTripTemplates(
  enabled: boolean,
  locations: string[],
  activityPresets: string[],
  previewEnabled = true,
) {
  const { client, userId } = useData();
  const [presets, setPresets] = useState<TemplatePresets | null>(null);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [presetsAttempt, retryPresets] = useState(0);
  const [attempt, retryPreview] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    categories: TemplateCategory[];
    selection: TemplateSelection;
  }>({ key: '', categories: [], selection: {} });
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const inputKey = JSON.stringify({
    locations: normalizeLocations(locations),
    activityPresets,
  });
  const currentKey = useRef(inputKey);
  currentKey.current = inputKey;

  useEffect(() => {
    if (!enabled || !userId) return;
    const controller = new AbortController();
    const guard = client.sessionGuard();
    setPresetsError(null);
    void client
      .request<TemplatePresets>({
        url: '/trip-templates/presets',
        signal: controller.signal,
      })
      .then((value) => {
        guard();
        if (!controller.signal.aborted) setPresets(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setPresetsError(errorMessage(error));
      });
    return () => controller.abort();
  }, [client, enabled, userId, presetsAttempt]);

  useEffect(() => {
    if (!enabled || !previewEnabled || !userId) return;
    const input = JSON.parse(inputKey) as {
      locations: string[];
      activityPresets: string[];
    };
    const controller = new AbortController();
    const guard = client.sessionGuard();
    setFailure(null);
    if (!input.locations.length && !input.activityPresets.length) {
      setResult({ key: inputKey, categories: [], selection: {} });
      return;
    }
    // Keep the previous successful selection visible while the new input loads.
    const timer = setTimeout(() => {
      void client
        .request<{ categories: TemplateCategory[] }>({
          method: 'POST',
          url: '/trip-templates/preview',
          data: input,
          signal: controller.signal,
        })
        .then(({ categories }) => {
          guard();
          if (controller.signal.aborted || currentKey.current !== inputKey)
            return;
          setResult((previous) => ({
            key: inputKey,
            categories,
            selection: reconcileSelection(categories, previous.selection),
          }));
        })
        .catch((error) => {
          if (controller.signal.aborted || currentKey.current !== inputKey)
            return;
          setFailure({ key: inputKey, message: errorMessage(error) });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [client, enabled, previewEnabled, inputKey, userId, attempt]);

  const error = failure?.key === inputKey ? failure.message : null;
  const hasInput =
    normalizeLocations(locations).length > 0 || activityPresets.length > 0;
  const ready =
    !enabled ||
    (!hasInput && !result.categories.length) ||
    (result.key === inputKey && !error);
  return {
    presets,
    presetsError,
    presetsPending: enabled && !presets && !presetsError,
    retryPresets: () => retryPresets((value) => value + 1),
    categories: result.categories,
    selection: result.selection,
    error,
    ready,
    pending: enabled && !ready && !error,
    retry: () => {
      setFailure(null);
      retryPreview((value) => value + 1);
    },
    toggleStamp: (category: string, title: string) => {
      const key = stampSelectionKey(category, title);
      setResult((previous) => ({
        ...previous,
        selection: { ...previous.selection, [key]: !previous.selection[key] },
      }));
    },
    toggleCategory: (category: TemplateCategory, checked: boolean) =>
      setResult((previous) => ({
        ...previous,
        selection: {
          ...previous.selection,
          ...Object.fromEntries(
            category.stamps.map(({ key, title }) => [
              stampSelectionKey(category.key ?? category.name, key ?? title),
              checked,
            ]),
          ),
        },
      })),
  };
}
