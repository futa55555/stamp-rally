import { useState } from 'react';
import type { Post } from '../model/types';
import {
  candidateKey,
  chooseRepresentative,
  representativeCandidates,
} from '../model/representative';

type Selection = { key: string; id: string | null };

export function useRepresentativePhotos(
  stamps: { id: string; photos: Post[] }[],
) {
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const next: Record<string, Selection> = {};
  const photos: Record<string, Post | undefined> = {};
  let changed = Object.keys(selections).length !== stamps.length;
  for (const stamp of stamps) {
    const candidates = representativeCandidates(stamp.photos);
    const key = candidateKey(candidates);
    const previous = selections[stamp.id];
    next[stamp.id] =
      previous?.key === key
        ? previous
        : { key, id: chooseRepresentative(candidates) };
    changed ||= next[stamp.id] !== previous;
    photos[stamp.id] = candidates.find((post) => post.id === next[stamp.id].id);
  }
  // Keep the selection for the lifetime of the screen, including virtualized cells.
  // Updating this component's state during render avoids showing a stale candidate.
  if (changed) setSelections(next);
  return photos;
}
