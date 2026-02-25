import posesData from '../data/poses.json';

export interface SpriteSize {
  w: number;
  h: number;
}

export interface Pose {
  id: string;
  name: string;
  description: string;
  direction: string | null;
  animGroup: string;
  frameIndex: number;
  spriteSize: SpriteSize;
  required: boolean;
}

export interface Phase {
  id: string;
  name: string;
  description: string;
  dependsOn: string | null;
  required: boolean;
  poses: Pose[];
}

export interface GameType {
  id: string;
  name: string;
  description: string;
  defaultSpriteSize: SpriteSize;
}

// Static fallback (used during loading or if API fails)
export const GAME_TYPES: Record<string, GameType> = posesData.gameTypes;
export const POSE_HIERARCHIES: Record<string, Phase[]> = posesData.hierarchies;

export function getPoseHierarchy(gameTypeId: string): Phase[] | null {
  return POSE_HIERARCHIES[gameTypeId] ?? null;
}

export function getPhaseById(gameTypeId: string, phaseId: string): Phase | null {
  const phases = POSE_HIERARCHIES[gameTypeId];
  if (!phases) return null;
  return phases.find(ph => ph.id === phaseId) ?? null;
}

export function getNextPhase(gameTypeId: string, completedPhaseIds: string[] = []): Phase | null {
  const phases = POSE_HIERARCHIES[gameTypeId];
  if (!phases) return null;
  const done = new Set(completedPhaseIds);
  for (const phase of phases) {
    if (done.has(phase.id)) continue;
    if (phase.dependsOn === null || done.has(phase.dependsOn)) return phase;
  }
  return null;
}

export function getTotalPoseCount(gameTypeId: string): number {
  const phases = POSE_HIERARCHIES[gameTypeId];
  if (!phases) return 0;
  return phases.reduce((s, ph) => s + ph.poses.length, 0);
}

export function getTotalPoseCountFromHierarchy(hierarchy: Phase[]): number {
  return hierarchy.reduce((s, ph) => s + ph.poses.length, 0);
}

export function getRequiredPoseCount(gameTypeId: string): number {
  const phases = POSE_HIERARCHIES[gameTypeId];
  if (!phases) return 0;
  return phases.reduce((s, ph) => s + ph.poses.filter(po => po.required).length, 0);
}
