import { localDate } from '../../../shared/lib/dates';
import { newestFirst } from '../../../shared/lib/sort';
import type { Trip } from './types';

export const isActiveTrip = (trip: Trip, today = localDate(new Date())) =>
  trip.startDate <= today && today <= trip.endDate;

export function sortTrips(trips: Trip[], today = localDate(new Date())) {
  return [...trips].sort(
    (a, b) =>
      Number(isActiveTrip(b, today)) - Number(isActiveTrip(a, today)) ||
      newestFirst(a, b),
  );
}
