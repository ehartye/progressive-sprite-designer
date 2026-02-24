import presetData from '../data/characters.json';

export interface CharacterConfig {
  id: string;
  name: string;
  gameType: string;
  genre?: string;
  description: string;
  equipment: string;
  colorNotes: string;
  isCustom?: boolean;
}

const STORAGE_KEY = 'sprite-designer-characters';

export function getPresetCharacters(): CharacterConfig[] {
  return presetData.presets;
}

export function getCustomCharacters(): CharacterConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomCharacter(char: Omit<CharacterConfig, 'id' | 'isCustom'>): CharacterConfig {
  const customs = getCustomCharacters();
  const newChar: CharacterConfig = { ...char, id: `custom-${Date.now()}`, isCustom: true };
  customs.push(newChar);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
  return newChar;
}

export function deleteCustomCharacter(id: string): void {
  const customs = getCustomCharacters().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
}
