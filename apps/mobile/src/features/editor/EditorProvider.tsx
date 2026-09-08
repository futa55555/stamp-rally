import { useNavigation } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useData } from '../app-data/AppDataProvider';
import type { NotificationTarget } from '../notifications/model/types';
import { resolveTarget } from '../trips/navigation/targets';
import type { PostDraft } from './model/draft';

function useEditorFlow() {
  const navigation = useNavigation('/');
  const { data, userId } = useData();
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [completion, finish] = useState<{ target?: NotificationTarget } | null>(
    null,
  );

  useEffect(() => {
    if (!completion) return;
    const routes = completion.target
      ? resolveTarget(data, completion.target, userId!)
      : null;
    // Wait until newly created entities have reached the store before navigating.
    if (completion.target && !routes) return;
    const frame = requestAnimationFrame(() => {
      if (!routes) {
        if (navigation.canGoBack()) navigation.goBack();
        else
          navigation.dispatch({
            type: 'RESET',
            payload: { index: 0, routes: [{ name: '(main)' }] },
          });
        return;
      }
      navigation.dispatch((state) => {
        const main = state.routes.find((r) => r.name === '(main)');
        const tabs = main?.state?.routes ?? [
          { name: 'trips' },
          { name: 'notifications' },
          { name: 'settings' },
        ];
        return {
          type: 'RESET',
          payload: {
            ...state,
            index: 0,
            routes: [
              {
                ...main,
                name: '(main)',
                state: {
                  ...main?.state,
                  index: tabs.findIndex((r) => r.name === 'trips'),
                  routes: tabs.map((r) =>
                    r.name === 'trips'
                      ? { ...r, state: { index: routes.length - 1, routes } }
                      : r,
                  ),
                },
              },
            ],
          },
        };
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [completion, data, userId, navigation]);
  return { draft, setDraft, finishing: !!completion, finish };
}

const EditorContext = createContext<ReturnType<typeof useEditorFlow> | null>(
  null,
);

export function EditorProvider({ children }: PropsWithChildren) {
  const flow = useEditorFlow();
  return (
    <EditorContext.Provider value={flow}>{children}</EditorContext.Provider>
  );
}

export function useEditor() {
  const flow = useContext(EditorContext);
  if (!flow) throw new Error('EditorProvider is required');
  return flow;
}
