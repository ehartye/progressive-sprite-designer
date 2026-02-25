import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  fetchGameTypes, fetchPrompts, fetchCharacters,
  type GameTypeData, type PromptsData, type CharacterData,
} from '../api/dataClient';

interface DataState {
  gameTypes: Record<string, GameTypeData>;
  prompts: PromptsData;
  characters: CharacterData[];
  loading: boolean;
  error: string | null;
}

interface DataContextValue extends DataState {
  reloadCharacters: () => Promise<void>;
  reloadPrompts: () => Promise<void>;
  reloadAll: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({
    gameTypes: {},
    prompts: { superPrompts: {}, posePrompts: {} },
    characters: [],
    loading: true,
    error: null,
  });

  const loadAll = useCallback(async () => {
    try {
      setState(s => ({ ...s, loading: true, error: null }));
      const [gameTypes, prompts, characters] = await Promise.all([
        fetchGameTypes(),
        fetchPrompts(),
        fetchCharacters(),
      ]);
      setState({ gameTypes, prompts, characters, loading: false, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      setState(s => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  const reloadCharacters = useCallback(async () => {
    try {
      const characters = await fetchCharacters();
      setState(s => ({ ...s, characters }));
    } catch { /* ignore */ }
  }, []);

  const reloadPrompts = useCallback(async () => {
    try {
      const prompts = await fetchPrompts();
      setState(s => ({ ...s, prompts }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <DataContext.Provider value={{ ...state, reloadCharacters, reloadPrompts, reloadAll: loadAll }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
