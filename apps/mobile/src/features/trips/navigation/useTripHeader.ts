import {
  useIsFocused,
  useNavigation,
  useRouter,
  type NativeStackNavigationProp,
} from 'expo-router';
import { useEffect, useLayoutEffect } from 'react';
import { headerButtonOptions } from '../../../shared/navigation/headerButtonOptions';
import type { Category, Stamp, Trip } from '../model/types';
import type { TripRoute, TripStackParamList } from './types';

export function useTripHeader({
  title,
  trip,
  category,
  stamp,
  tripId = trip?.id,
  categoryId = category?.id,
  stampId = stamp?.id,
}: {
  title: string;
  trip?: Trip;
  category?: Category;
  stamp?: Stamp;
  tripId?: string;
  categoryId?: string;
  stampId?: string;
}) {
  const router = useRouter();
  const navigation =
    useNavigation<NativeStackNavigationProp<TripStackParamList>>();
  const focused = useIsFocused();

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      ...headerButtonOptions({
        label: '投稿を追加',
        symbol: 'plus',
        icon: 'camera-plus-outline',
        onPress: () =>
          router.push({
            pathname: '/editor/post',
            params: {
              initialTripId: tripId,
              initialCategoryId: categoryId,
              initialStampId: stampId,
            },
          }),
      }),
    });
  }, [navigation, router, title, tripId, categoryId, stampId]);

  useEffect(() => {
    if (!focused || !trip || (stampId && !stamp) || (categoryId && !category))
      return;
    const state = navigation.getState();
    if (!state) return;
    const current = state.routes[state.index];
    const screenName = stampId
      ? 'stamp/[stampId]'
      : categoryId
        ? 'category/[categoryId]'
        : 'trip/[tripId]';
    if (current.name !== screenName) return;
    // A direct link may contain only the destination (and the initial list).
    // Insert its ancestors so the system Back button/menu works immediately.
    // Preserve existing navigation history and the current screen's key/state.
    if (
      state.routes.slice(0, state.index).some((route) => route.name !== 'index')
    )
      return;
    const ancestors: TripRoute[] = [{ name: 'index', params: undefined }];
    if (current.name !== 'trip/[tripId]') {
      ancestors.push({
        name: 'trip/[tripId]',
        params: { tripId: trip.id, title: trip.name },
      });
    }
    if (current.name === 'stamp/[stampId]' && category) {
      ancestors.push({
        name: 'category/[categoryId]',
        params: { categoryId: category.id, title: category.name },
      });
    }
    if (state.index === ancestors.length) return;
    navigation.dispatch({
      type: 'RESET',
      payload: {
        index: ancestors.length,
        routes: [
          ...ancestors.map((ancestor) =>
            ancestor.name === 'index'
              ? (state.routes.find((route) => route.name === 'index') ??
                ancestor)
              : ancestor,
          ),
          current,
          ...state.routes.slice(state.index + 1),
        ],
      },
    });
  }, [focused, navigation, trip, category, stamp, categoryId, stampId]);
}
