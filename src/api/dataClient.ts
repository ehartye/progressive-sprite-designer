// API client for data, gallery, and admin operations

export interface GameTypeData {
  id: string;
  name: string;
  description: string;
  defaultSpriteSize: { w: number; h: number };
}

export interface PhaseData {
  id: string;
  name: string;
  description: string;
  dependsOn: string | null;
  required: boolean;
  poses: PoseData[];
}

export interface PoseData {
  id: string;
  name: string;
  description: string;
  direction: string | null;
  animGroup: string;
  frameIndex: number;
  spriteSize: { w: number; h: number };
  required: boolean;
}

export interface PromptsData {
  superPrompts: Record<string, string>;
  posePrompts: Record<string, string>;
}

export interface CharacterData {
  id: string;
  name: string;
  gameType: string;
  genre?: string | null;
  description: string;
  equipment: string;
  colorNotes: string;
  isPreset: boolean;
  isCustom: boolean;
}

export interface GalleryEntry {
  id: number;
  characterName: string;
  gameType: string;
  description: string;
  equipment: string;
  colorNotes: string;
  model: string;
  spriteCount: number;
  createdAt: string;
  updatedAt: string;
  keyImage: { data: string; mimeType: string; poseName: string } | null;
}

export interface GalleryDetail {
  id: number;
  characterName: string;
  gameType: string;
  description: string;
  equipment: string;
  colorNotes: string;
  model: string;
  customInstructions: string;
  createdAt: string;
  updatedAt: string;
  sprites: SpriteData[];
}

export interface SpriteData {
  id: number;
  poseId: string;
  poseName: string;
  imageData: string;
  mimeType: string;
  prompt: string;
  modelId: string;
  customInstructions: string;
  referenceImageIds: string[];
  createdAt: string;
}

// === Data endpoints ===

export async function fetchGameTypes(): Promise<Record<string, GameTypeData>> {
  const res = await fetch('/api/data/game-types');
  if (!res.ok) throw new Error('Failed to fetch game types');
  return res.json();
}

export async function fetchHierarchy(gameType: string): Promise<PhaseData[]> {
  const res = await fetch(`/api/data/hierarchy/${gameType}`);
  if (!res.ok) throw new Error('Failed to fetch hierarchy');
  return res.json();
}

export async function fetchPrompts(): Promise<PromptsData> {
  const res = await fetch('/api/data/prompts');
  if (!res.ok) throw new Error('Failed to fetch prompts');
  return res.json();
}

export async function fetchCharacters(): Promise<CharacterData[]> {
  const res = await fetch('/api/data/characters');
  if (!res.ok) throw new Error('Failed to fetch characters');
  return res.json();
}

// === Gallery endpoints ===

export async function fetchGallery(): Promise<GalleryEntry[]> {
  const res = await fetch('/api/gallery');
  if (!res.ok) throw new Error('Failed to fetch gallery');
  return res.json();
}

export async function fetchGalleryEntry(id: number): Promise<GalleryDetail> {
  const res = await fetch(`/api/gallery/${id}`);
  if (!res.ok) throw new Error('Failed to fetch gallery entry');
  return res.json();
}

export async function createGalleryEntry(data: {
  characterName: string;
  gameType: string;
  description?: string;
  equipment?: string;
  colorNotes?: string;
  model?: string;
}): Promise<{ id: number }> {
  const res = await fetch('/api/gallery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create gallery entry');
  return res.json();
}

export async function deleteGalleryEntry(id: number): Promise<void> {
  const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete gallery entry');
}

export async function addSpriteToGallery(generationSetId: number, sprite: {
  poseId: string;
  poseName: string;
  imageData: string;
  mimeType: string;
  prompt: string;
  modelId: string;
  customInstructions: string;
  referenceImageIds: string[];
}): Promise<{ id: number }> {
  const res = await fetch(`/api/gallery/${generationSetId}/sprites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sprite),
  });
  if (!res.ok) throw new Error('Failed to add sprite');
  return res.json();
}

export async function removeSpriteFromGallery(generationSetId: number, spriteId: number): Promise<void> {
  const res = await fetch(`/api/gallery/${generationSetId}/sprites/${spriteId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove sprite');
}

// === Admin endpoints ===

export async function createCharacter(data: {
  name: string;
  gameType: string;
  genre?: string;
  description: string;
  equipment: string;
  colorNotes: string;
}): Promise<{ id: string }> {
  const res = await fetch('/api/admin/characters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create character');
  return res.json();
}

export async function updateCharacter(id: string, data: Partial<{
  name: string;
  gameType: string;
  genre: string;
  description: string;
  equipment: string;
  colorNotes: string;
}>): Promise<void> {
  const res = await fetch(`/api/admin/characters/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update character');
}

export async function deleteCharacter(id: string): Promise<void> {
  const res = await fetch(`/api/admin/characters/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete character');
}

export async function updatePose(gameType: string, poseId: string, data: Partial<{
  name: string;
  description: string;
  direction: string;
  animGroup: string;
  frameIndex: number;
  spriteWidth: number;
  spriteHeight: number;
  required: number;
}>): Promise<void> {
  const res = await fetch(`/api/admin/poses/${gameType}/${poseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update pose');
}

export async function updatePosePrompt(poseId: string, promptText: string): Promise<void> {
  const res = await fetch(`/api/admin/pose-prompts/${poseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptText }),
  });
  if (!res.ok) throw new Error('Failed to update pose prompt');
}

export async function updateSuperPrompt(gameType: string, promptTemplate: string): Promise<void> {
  const res = await fetch(`/api/admin/super-prompts/${gameType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptTemplate }),
  });
  if (!res.ok) throw new Error('Failed to update super prompt');
}
