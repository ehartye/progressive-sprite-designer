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
 * Default ms-per-frame for each animation type,
 * matching SNES-era sprite animation conventions.
 */
export const DEFAULT_MS_PER_FRAME: Record<string, number> = {
  idle: 200,
  walk_down: 133,
  walk_up: 133,
  walk_left: 133,
  walk_right: 133,
  run_down: 83,
  run_up: 83,
  run_left: 83,
  run_right: 83,
  run: 83,
  battle_idle: 150,
  battle_attack: 80,
  battle_cast: 100,
  battle_damage: 80,
  battle_ko: 200,
  battle_victory: 150,
  attack: 80,
  jump: 100,
  emotes: 300,
};

/** Animation groups that should loop by default (vs one-shot) */
export const LOOP_DEFAULTS: Record<string, boolean> = {
  idle: true,
  walk_down: true,
  walk_up: true,
  walk_left: true,
  walk_right: true,
  run_down: true,
  run_up: true,
  run_left: true,
  run_right: true,
  run: true,
  battle_idle: true,
  battle_attack: false,
  battle_cast: false,
  battle_damage: false,
  battle_ko: false,
  battle_victory: false,
  attack: false,
  jump: false,
  emotes: false,
};

export function getDefaultMsPerFrame(animGroup: string): number {
  if (DEFAULT_MS_PER_FRAME[animGroup] != null) {
    return DEFAULT_MS_PER_FRAME[animGroup];
  }
  // Heuristic fallbacks based on name patterns
  if (animGroup.startsWith('walk')) return 133;
  if (animGroup.startsWith('run')) return 83;
  if (animGroup.includes('attack') || animGroup.includes('cast')) return 80;
  if (animGroup.includes('idle')) return 200;
  return 133;
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
 */
export function getPathScripts(
  gameType: string,
  available: Set<string>,
): PathScript[] {
  const raw = RAW_SCRIPTS[gameType] ?? RAW_SCRIPTS['GENERIC'];
  return raw.map(script => ({
    ...script,
    steps: script.steps.filter(step => available.has(step.animGroup)),
  })).filter(script => script.steps.length > 0);
}

// Movement speed constant (canvas px per ms at 4x zoom)
const S = 0.06;

const TOP_DOWN_SCRIPTS: PathScript[] = [
  {
    id: 'patrol_square',
    label: 'Walk Patrol (Square)',
    steps: [
      { animGroup: 'idle',       durationMs: 800,  moveX: 0,  moveY: 0 },
      { animGroup: 'walk_down',  durationMs: 1200, moveX: 0,  moveY: S },
      { animGroup: 'walk_right', durationMs: 1200, moveX: S,  moveY: 0 },
      { animGroup: 'walk_up',    durationMs: 1200, moveX: 0,  moveY: -S },
      { animGroup: 'walk_left',  durationMs: 1200, moveX: -S, moveY: 0 },
    ],
  },
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
  {
    id: 'idle_only',
    label: 'Idle in Place',
    steps: [
      { animGroup: 'idle', durationMs: 2000, moveX: 0, moveY: 0 },
    ],
  },
];

const ACTION_RPG_SCRIPTS: PathScript[] = [
  {
    id: 'patrol_square',
    label: 'Walk Patrol (Square)',
    steps: [
      { animGroup: 'idle',       durationMs: 800,  moveX: 0,  moveY: 0 },
      { animGroup: 'walk_down',  durationMs: 1200, moveX: 0,  moveY: S },
      { animGroup: 'walk_right', durationMs: 1200, moveX: S,  moveY: 0 },
      { animGroup: 'walk_up',    durationMs: 1200, moveX: 0,  moveY: -S },
      { animGroup: 'walk_left',  durationMs: 1200, moveX: -S, moveY: 0 },
    ],
  },
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
  {
    id: 'idle_only',
    label: 'Idle in Place',
    steps: [
      { animGroup: 'idle', durationMs: 2000, moveX: 0, moveY: 0 },
    ],
  },
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
  {
    id: 'idle_only',
    label: 'Idle in Place',
    steps: [
      { animGroup: 'idle', durationMs: 2000, moveX: 0, moveY: 0 },
    ],
  },
];

const CREATURE_SCRIPTS: PathScript[] = [
  {
    id: 'idle_cycle',
    label: 'Idle Cycle',
    steps: [
      { animGroup: 'idle', durationMs: 2000, moveX: 0, moveY: 0 },
    ],
  },
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
  {
    id: 'idle_only',
    label: 'Idle in Place',
    steps: [
      { animGroup: 'idle', durationMs: 2000, moveX: 0, moveY: 0 },
    ],
  },
];

const RAW_SCRIPTS: Record<string, PathScript[]> = {
  TOP_DOWN_RPG: TOP_DOWN_SCRIPTS,
  ACTION_RPG: ACTION_RPG_SCRIPTS,
  SIDE_SCROLLER: SIDE_SCROLLER_SCRIPTS,
  CREATURE: CREATURE_SCRIPTS,
  GENERIC: GENERIC_SCRIPTS,
};
