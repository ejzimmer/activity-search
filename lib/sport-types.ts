// Garmin groups its activity types under broader ones (trail running under
// running), but an activity summary only names its parent by numeric id, so
// the grouping is written out here by type key.
const CHILD_SPORT_TYPES: Record<string, string[]> = {
  running: [
    'trail_running',
    'treadmill_running',
    'street_running',
    'track_running',
    'indoor_running',
    'virtual_run',
    'ultra_run',
    'obstacle_run',
  ],
  cycling: [
    'road_biking',
    'mountain_biking',
    'gravel_cycling',
    'indoor_cycling',
    'virtual_ride',
    'cyclocross',
    'track_cycling',
    'recumbent_cycling',
    'bmx',
    'downhill_biking',
    'e_bike_fitness',
    'e_bike_mountain',
    'hand_cycling',
    'indoor_hand_cycling',
  ],
  walking: ['casual_walking', 'speed_walking', 'indoor_walking'],
  swimming: ['lap_swimming', 'open_water_swimming'],
  fitness_equipment: [
    'strength_training',
    'indoor_cardio',
    'elliptical',
    'stair_climbing',
    'indoor_rowing',
    'yoga',
    'pilates',
    'hiit',
  ],
};

export function findParentSportType(sportType: string): string | null {
  const parent = Object.entries(CHILD_SPORT_TYPES).find(([, children]) =>
    children.includes(sportType),
  );
  return parent?.[0] ?? null;
}

export function listSportTypesWithin(sportType: string): string[] {
  return [sportType, ...(CHILD_SPORT_TYPES[sportType] ?? [])];
}

export interface SportTypeOption {
  sportType: string;
  isChild: boolean;
}

/** Each recorded type, plus its parent even when nothing was recorded as the parent itself, with children listed under their parent. */
export function listSportTypeOptions(
  recordedSportTypes: string[],
): SportTypeOption[] {
  const childrenByParent = new Map<string, string[]>();
  for (const sportType of recordedSportTypes) {
    const parent = findParentSportType(sportType);
    if (parent === null) {
      if (!childrenByParent.has(sportType)) childrenByParent.set(sportType, []);
    } else {
      childrenByParent.set(parent, [
        ...(childrenByParent.get(parent) ?? []),
        sportType,
      ]);
    }
  }
  return [...childrenByParent.keys()].sort().flatMap((parent) => [
    { sportType: parent, isChild: false },
    ...childrenByParent
      .get(parent)!
      .sort()
      .map((child) => ({ sportType: child, isChild: true })),
  ]);
}
