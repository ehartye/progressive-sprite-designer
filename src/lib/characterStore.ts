import { createCharacter, deleteCharacter as apiDeleteCharacter } from '../api/dataClient';
import type { CharacterData } from '../api/dataClient';

export interface CharacterConfig {
  id: string;
  name: string;
  gameType: string;
  genre?: string;
  description: string;
  equipment: string;
  colorNotes: string;
  isCustom?: boolean;
  isPreset?: boolean;
}

export function charactersFromData(data: CharacterData[]): {
  presets: CharacterConfig[];
  customs: CharacterConfig[];
} {
  const presets: CharacterConfig[] = [];
  const customs: CharacterConfig[] = [];

  for (const c of data) {
    const config: CharacterConfig = {
      id: c.id,
      name: c.name,
      gameType: c.gameType,
      genre: c.genre ?? undefined,
      description: c.description,
      equipment: c.equipment,
      colorNotes: c.colorNotes,
      isPreset: c.isPreset,
      isCustom: c.isCustom,
    };
    if (c.isPreset) presets.push(config);
    else customs.push(config);
  }

  return { presets, customs };
}

export async function saveCustomCharacter(char: Omit<CharacterConfig, 'id' | 'isCustom'>): Promise<CharacterConfig> {
  const result = await createCharacter({
    name: char.name,
    gameType: char.gameType,
    genre: char.genre,
    description: char.description,
    equipment: char.equipment,
    colorNotes: char.colorNotes,
  });

  return { ...char, id: result.id, isCustom: true };
}

export async function deleteCustomCharacter(id: string): Promise<void> {
  await apiDeleteCharacter(id);
}
