import { localDate } from '../../../shared/lib/dates';
import { newestFirst } from '../../../shared/lib/sort';
import type { Trip } from './types';

export const isActiveTrip = (trip: Trip, today = localDate(new Date())) =>
  trip.startDate <= today && today <= trip.endDate;

export function groupTrips(trips: Trip[], today = localDate(new Date())) {
  return {
    active: trips
      .filter((trip) => isActiveTrip(trip, today))
      .sort(
        (a, b) => b.startDate.localeCompare(a.startDate) || newestFirst(a, b),
      ),
    upcoming: trips
      .filter((trip) => trip.startDate > today)
      .sort(
        (a, b) =>
          a.startDate.localeCompare(b.startDate) ||
          a.endDate.localeCompare(b.endDate) ||
          newestFirst(a, b),
      ),
    past: trips
      .filter((trip) => trip.endDate < today)
      .sort(
        (a, b) =>
          b.endDate.localeCompare(a.endDate) ||
          b.startDate.localeCompare(a.startDate) ||
          newestFirst(a, b),
      ),
  };
}

export function sortTrips(trips: Trip[], today = localDate(new Date())) {
  const { active, upcoming, past } = groupTrips(trips, today);
  return [...active, ...upcoming, ...past];
}
