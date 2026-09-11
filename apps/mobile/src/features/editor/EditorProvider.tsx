import { useNavigation } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState } from 'react';
import { useData } from '../app-data/AppDataProvider';
import type { NotificationTarget } from '../notifications/model/types';
import { resolveApiTarget } from '../trips/navigation/targets';

function useEditorFlow() {
  const navigation = useNavigation('/');
  const { client, userId } = useData();
  const [finishing, setFinishing] = useState(false);
  const finish = async ({
    target,
    viaGenreId,
  }: {
    target?: NotificationTarget;
    viaGenreId?: string;
  }) => {
    const assertCurrent = client.sessionGuard();
    setFinishing(true);
    try {
      const routes = target
        ? await resolveApiTarget(client, target, viaGenreId)
        : null;
      assertCurrent();
      if (client.snapshot().user?.id !== userId) return;
      // Let the removal guard observe finishing before dispatching the reset.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      assertCurrent();
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
        const main = state.routes.find((route) => route.name === '(main)');
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
                  index: tabs.findIndex((route) => route.name === 'trips'),
                  routes: tabs.map((route) =>
                    route.name === 'trips'
                      ? {
                          ...route,
                          state: { index: routes.length - 1, routes },
                        }
                      : route,
                  ),
                },
              },
            ],
          },
        };
      });
    } catch (error) {
      setFinishing(false);
      throw error;
    }
  };
  return { finishing, finish };
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
