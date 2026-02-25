/**
 * Scripted character paths for the animation preview.
 * Each game type has a predefined movement sequence that exercises
 * the available directional animations.
 */

export interface PathStep {
  animGroup: string;
  durationMs: number;
  /** Canvas-pixel movement per millisecond (x direction) */
  moveX: number;
  /** Canvas-pixel movement per millisecond (y direction) */
  moveY: number;
}

export interface PathScript {
  id: string;
  label: string;
  steps: PathStep[];
}

/**
 * Combined defaults for each animation group:
 * ms-per-frame and whether the group loops.
 */
interface AnimGroupDefaults { ms: number; loop: boolean; }

const ANIM_GROUP_DEFAULTS: Record<string, AnimGroupDefaults> = {
  idle:            { ms: 500, loop: true },
  walk_down:       { ms: 500, loop: true },
  walk_up:         { ms: 500, loop: true },
  walk_left:       { ms: 500, loop: true },
  walk_right:      { ms: 500, loop: true },
  run_down:        { ms: 500, loop: true },
  run_up:          { ms: 500, loop: true },
  run_left:        { ms: 500, loop: true },
  run_right:       { ms: 500, loop: true },
  run:             { ms: 500, loop: true },
  battle_idle:     { ms: 500, loop: true },
  battle_attack:   { ms: 500, loop: false },
  battle_cast:     { ms: 500, loop: false },
  battle_damage:   { ms: 500, loop: false },
  battle_ko:       { ms: 500, loop: false },
  battle_victory:  { ms: 500, loop: false },
  attack:          { ms: 500, loop: false },
  jump:            { ms: 500, loop: false },
  emotes:          { ms: 500, loop: false },
};

/**
 * Default ms-per-frame for each animation type,
 * matching SNES-era sprite animation conventions.
 */
export const DEFAULT_MS_PER_FRAME: Record<string, number> = Object.fromEntries(
  Object.entries(ANIM_GROUP_DEFAULTS).map(([k, v]) => [k, v.ms])
);

/** Animation groups that should loop by default (vs one-shot) */
export const LOOP_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  Object.entries(ANIM_GROUP_DEFAULTS).map(([k, v]) => [k, v.loop])
);

export function getDefaultMsPerFrame(animGroup: string): number {
  if (DEFAULT_MS_PER_FRAME[animGroup] != null) {
    return DEFAULT_MS_PER_FRAME[animGroup];
  }
  return 500;
}

export function getDefaultLoop(animGroup: string): boolean {
  if (LOOP_DEFAULTS[animGroup] != null) return LOOP_DEFAULTS[animGroup];
  if (animGroup.includes('attack') || animGroup.includes('damage') ||
      animGroup.includes('ko') || animGroup.includes('cast') ||
      animGroup.includes('victory') || animGroup.includes('jump')) {
    return false;
  }
  return true;
}

/**
 * Get the path scripts available for a game type.
 * Steps referencing animGroups not in `available` are skipped.
 * Dynamically generates per-group and all-groups scripts from available groups.
 */
export function getPathScripts(
  gameType: string,
  available: Set<string>,
): PathScript[] {
  const raw = RAW_SCRIPTS[gameType] ?? RAW_SCRIPTS['GENERIC'];
  const scripts: PathScript[] = raw.map(script => ({
    ...script,
    steps: script.steps.filter(step => available.has(step.animGroup)),
  })).filter(script => script.steps.length > 0);

  const allGroups = Array.from(available).sort();

  // Dynamic: "All Groups Demo" cycles through every available group
  if (allGroups.length > 1) {
    scripts.push({
      id: 'all_groups',
      label: 'All Groups Demo',
      steps: allGroups.map(group => ({
        animGroup: group,
        durationMs: 1500,
        moveX: 0,
        moveY: 0,
      })),
    });
  }

  // Dynamic: per-group scripts for previewing a single group
  for (const group of allGroups) {
    scripts.push({
      id: `single_${group}`,
      label: group.replace(/_/g, ' '),
      steps: [{ animGroup: group, durationMs: 5000, moveX: 0, moveY: 0 }],
    });
  }

  return scripts;
}

// Movement speed constant (canvas px per ms at 4x zoom)
const S = 0.06;

const IDLE_ONLY_SCRIPT: PathScript = {
  id: 'idle_only',
  label: 'Idle in Place',
  steps: [{ animGroup: 'idle', durationMs: 2000, moveX: 0, moveY: 0 }],
};

const PATROL_SQUARE_SCRIPT: PathScript = {
  id: 'patrol_square',
  label: 'Walk Patrol (Square)',
  steps: [
    { animGroup: 'idle',       durationMs: 800,  moveX: 0,  moveY: 0 },
    { animGroup: 'walk_down',  durationMs: 1200, moveX: 0,  moveY: S },
    { animGroup: 'walk_right', durationMs: 1200, moveX: S,  moveY: 0 },
    { animGroup: 'walk_up',    durationMs: 1200, moveX: 0,  moveY: -S },
    { animGroup: 'walk_left',  durationMs: 1200, moveX: -S, moveY: 0 },
  ],
};

const TOP_DOWN_SCRIPTS: PathScript[] = [
  PATROL_SQUARE_SCRIPT,
  {
    id: 'battle_demo',
    label: 'Battle Sequence',
    steps: [
      { animGroup: 'battle_idle',    durationMs: 1000, moveX: 0, moveY: 0 },
      { animGroup: 'battle_attack',  durationMs: 600,  moveX: 0, moveY: 0 },
      { animGroup: 'battle_idle',    durationMs: 500,  moveX: 0, moveY: 0 },
      { animGroup: 'battle_damage',  durationMs: 500,  moveX: 0, moveY: 0 },
      { animGroup: 'battle_idle',    durationMs: 500,  moveX: 0, moveY: 0 },
      { animGroup: 'battle_cast',    durationMs: 600,  moveX: 0, moveY: 0 },
      { animGroup: 'battle_idle',    durationMs: 500,  moveX: 0, moveY: 0 },
      { animGroup: 'battle_victory', durationMs: 800,  moveX: 0, moveY: 0 },
    ],
  },
  IDLE_ONLY_SCRIPT,
];

const ACTION_RPG_SCRIPTS: PathScript[] = [
  PATROL_SQUARE_SCRIPT,
  {
    id: 'run_demo',
    label: 'Run Demo',
    steps: [
      { animGroup: 'idle',      durationMs: 600,  moveX: 0,     moveY: 0 },
      { animGroup: 'run_right', durationMs: 1500, moveX: S * 2, moveY: 0 },
      { animGroup: 'idle',      durationMs: 400,  moveX: 0,     moveY: 0 },
      { animGroup: 'run_left',  durationMs: 1500, moveX: -S * 2, moveY: 0 },
    ],
  },
  IDLE_ONLY_SCRIPT,
];

const SIDE_SCROLLER_SCRIPTS: PathScript[] = [
  {
    id: 'run_and_attack',
    label: 'Run & Attack',
    steps: [
      { animGroup: 'idle',   durationMs: 600,  moveX: 0,     moveY: 0 },
      { animGroup: 'run',    durationMs: 1500, moveX: S * 2, moveY: 0 },
      { animGroup: 'attack', durationMs: 500,  moveX: 0,     moveY: 0 },
      { animGroup: 'idle',   durationMs: 400,  moveX: 0,     moveY: 0 },
      { animGroup: 'jump',   durationMs: 500,  moveX: S,     moveY: 0 },
      { animGroup: 'idle',   durationMs: 400,  moveX: 0,     moveY: 0 },
    ],
  },
  IDLE_ONLY_SCRIPT,
];

const CREATURE_SCRIPTS: PathScript[] = [
  { ...IDLE_ONLY_SCRIPT, id: 'idle_cycle', label: 'Idle Cycle' },
  {
    id: 'attack_demo',
    label: 'Attack Demo',
    steps: [
      { animGroup: 'idle',   durationMs: 800, moveX: 0, moveY: 0 },
      { animGroup: 'attack', durationMs: 600, moveX: 0, moveY: 0 },
      { animGroup: 'idle',   durationMs: 600, moveX: 0, moveY: 0 },
    ],
  },
];

const GENERIC_SCRIPTS: PathScript[] = [
  IDLE_ONLY_SCRIPT,
];

const RAW_SCRIPTS: Record<string, PathScript[]> = {
  TOP_DOWN_RPG: TOP_DOWN_SCRIPTS,
  ACTION_RPG: ACTION_RPG_SCRIPTS,
  SIDE_SCROLLER: SIDE_SCROLLER_SCRIPTS,
  CREATURE: CREATURE_SCRIPTS,
  GENERIC: GENERIC_SCRIPTS,
};
