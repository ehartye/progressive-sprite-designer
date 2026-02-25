import { useReducer, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { useWorkflowContext } from '../context/WorkflowContext';
import type { ApprovedSprite } from '../context/WorkflowContext';
import type { Phase, Pose } from '../lib/poses';
import { GAME_TYPES } from '../lib/poses';
import { AnimationEngine } from '../lib/animationEngine';
import type { FrameAdjust, AnimFrame } from '../lib/animationEngine';
import { base64ToImageData, applyChromaKey, imageDataToImage } from '../lib/chromaKey';
import { getPathScripts, getDefaultMsPerFrame, getDefaultLoop } from '../lib/pathScripts';
import type { PathScript } from '../lib/pathScripts';

// --- State ---

interface AnimEditorState {
  selectedAnimGroup: string;
  frameAdjustments: Record<string, FrameAdjust>;
  chromaTolerance: number;
  msPerFrame: Record<string, number>;
  loopGroups: Record<string, boolean>;
  isPlaying: boolean;
  zoomLevel: number;
  selectedScriptId: string;
}

type AnimAction =
  | { type: 'SELECT_GROUP'; group: string }
  | { type: 'SET_ADJUST'; poseId: string; adjustment: FrameAdjust }
  | { type: 'RESET_ADJUST'; poseId: string }
  | { type: 'SET_CHROMA'; tolerance: number }
  | { type: 'SET_MS_PER_FRAME'; group: string; ms: number }
  | { type: 'TOGGLE_LOOP'; group: string }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_SCRIPT'; scriptId: string }
  | { type: 'INIT_GROUPS'; groups: string[] };

const initialState: AnimEditorState = {
  selectedAnimGroup: '',
  frameAdjustments: {},
  chromaTolerance: 30,
  msPerFrame: {},
  loopGroups: {},
  isPlaying: true,
  zoomLevel: 4,
  selectedScriptId: '',
};

function animReducer(state: AnimEditorState, action: AnimAction): AnimEditorState {
  switch (action.type) {
    case 'SELECT_GROUP':
      return { ...state, selectedAnimGroup: action.group };
    case 'SET_ADJUST':
      return {
        ...state,
        frameAdjustments: { ...state.frameAdjustments, [action.poseId]: action.adjustment },
      };
    case 'RESET_ADJUST': {
      const { [action.poseId]: _, ...rest } = state.frameAdjustments;
      return { ...state, frameAdjustments: rest };
    }
    case 'SET_CHROMA':
      return { ...state, chromaTolerance: action.tolerance };
    case 'SET_MS_PER_FRAME':
      return {
        ...state,
        msPerFrame: { ...state.msPerFrame, [action.group]: action.ms },
      };
    case 'TOGGLE_LOOP': {
      const current = state.loopGroups[action.group] ?? getDefaultLoop(action.group);
      return {
        ...state,
        loopGroups: { ...state.loopGroups, [action.group]: !current },
      };
    }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.playing };
    case 'SET_ZOOM':
      return { ...state, zoomLevel: action.zoom };
    case 'SET_SCRIPT':
      return { ...state, selectedScriptId: action.scriptId };
    case 'INIT_GROUPS': {
      // Merge defaults — preserve any user-modified values
      const msPerFrame = { ...state.msPerFrame };
      const loopGroups = { ...state.loopGroups };
      for (const g of action.groups) {
        if (msPerFrame[g] == null) msPerFrame[g] = getDefaultMsPerFrame(g);
        if (loopGroups[g] == null) loopGroups[g] = getDefaultLoop(g);
      }
      return {
        ...state,
        msPerFrame,
        loopGroups,
        selectedAnimGroup: state.selectedAnimGroup || (action.groups[0] ?? ''),
      };
    }
    default:
      return state;
  }
}

// --- Helpers ---

function buildPoseMap(hierarchy: Phase[]): Map<string, Pose> {
  const map = new Map<string, Pose>();
  for (const phase of hierarchy) {
    for (const pose of phase.poses) {
      map.set(pose.id, pose);
    }
  }
  return map;
}

function buildGroupedFrames(
  sprites: ApprovedSprite[],
  poseMap: Map<string, Pose>,
): Map<string, AnimFrame[]> {
  const groups = new Map<string, AnimFrame[]>();

  for (const sprite of sprites) {
    const pose = poseMap.get(sprite.poseId);
    if (!pose) continue;

    const frame: AnimFrame = {
      poseId: sprite.poseId,
      animGroup: pose.animGroup,
      frameIndex: pose.frameIndex,
    };

    const arr = groups.get(pose.animGroup) ?? [];
    arr.push(frame);
    groups.set(pose.animGroup, arr);
  }

  // Sort each group by frameIndex
  for (const [, frames] of groups) {
    frames.sort((a, b) => a.frameIndex - b.frameIndex);
  }

  return groups;
}

// --- Hook ---

export function useAnimationEditor() {
  const { state: workflowState } = useWorkflowContext();
  const { approvedSprites, hierarchy, characterConfig } = workflowState;
  const gameType = characterConfig.gameType;
  const spriteSize = GAME_TYPES[gameType]?.defaultSpriteSize ?? { w: 16, h: 24 };

  const [state, dispatch] = useReducer(animReducer, initialState);
  const engineRef = useRef<AnimationEngine | null>(null);

  // Track image loading via state (not ref) so chroma effect re-runs
  const [imagesReady, setImagesReady] = useState(false);

  // Persistent processed images ref — survives across effect cycles
  const processedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Track chroma processing to avoid redundant work
  const chromaProcessingRef = useRef<Map<string, number>>(new Map()); // poseId → tolerance

  // --- Derived data ---

  const poseMap = useMemo(() => buildPoseMap(hierarchy), [hierarchy]);

  const groupedFrames = useMemo(
    () => buildGroupedFrames(approvedSprites, poseMap),
    [approvedSprites, poseMap],
  );

  const animGroups = useMemo(
    () => Array.from(groupedFrames.keys()).sort(),
    [groupedFrames],
  );

  const pathScripts = useMemo(
    () => getPathScripts(gameType, new Set(animGroups)),
    [gameType, animGroups],
  );

  const activeScript: PathScript | null = useMemo(() => {
    if (state.selectedScriptId) {
      return pathScripts.find(s => s.id === state.selectedScriptId) ?? pathScripts[0] ?? null;
    }
    return pathScripts[0] ?? null;
  }, [state.selectedScriptId, pathScripts]);

  const framesForSelectedGroup = useMemo(
    () => groupedFrames.get(state.selectedAnimGroup) ?? [],
    [groupedFrames, state.selectedAnimGroup],
  );

  // --- Initialize groups on first render / when groups change ---

  const animGroupsKey = animGroups.join(',');
  useEffect(() => {
    if (animGroups.length > 0) {
      dispatch({ type: 'INIT_GROUPS', groups: animGroups });
    }
  }, [animGroupsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Select first script
  useEffect(() => {
    if (pathScripts.length > 0 && !state.selectedScriptId) {
      dispatch({ type: 'SET_SCRIPT', scriptId: pathScripts[0].id });
    }
  }, [pathScripts, state.selectedScriptId]);

  // --- Preload images ---

  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      const imageMap = new Map<string, HTMLImageElement>();
      const promises = approvedSprites.map(sprite => {
        return new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([sprite.poseId, img]);
          img.onerror = () => reject(new Error(`Failed to load ${sprite.poseId}`));
          img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
        });
      });

      try {
        const results = await Promise.all(promises);
        if (cancelled) return;
        for (const [poseId, img] of results) {
          imageMap.set(poseId, img);
        }
        engineRef.current?.setImages(imageMap);
        setImagesReady(true);
      } catch (err) {
        console.warn('Failed to preload some animation images:', err);
      }
    };

    loadAll();
    return () => { cancelled = true; };
  }, [approvedSprites]);

  // --- Chroma key processing ---

  useEffect(() => {
    if (!imagesReady || approvedSprites.length === 0) return;

    let cancelled = false;
    const tolerance = state.chromaTolerance;

    const processAll = async () => {
      let changed = false;

      for (const sprite of approvedSprites) {
        if (cancelled) return;

        // Skip if already processed at this tolerance
        if (chromaProcessingRef.current.get(sprite.poseId) === tolerance) {
          continue;
        }

        try {
          const imageData = await base64ToImageData(sprite.imageData, sprite.mimeType);
          if (cancelled) return;
          const keyed = applyChromaKey(imageData, tolerance);
          const img = await imageDataToImage(keyed);
          if (cancelled) return;
          processedImagesRef.current.set(sprite.poseId, img);
          chromaProcessingRef.current.set(sprite.poseId, tolerance);
          changed = true;
        } catch (err) {
          console.warn(`Chroma key failed for ${sprite.poseId}:`, err);
        }
      }

      if (!cancelled && changed) {
        engineRef.current?.setProcessedImages(new Map(processedImagesRef.current));
      }
    };

    // Debounce chroma processing slightly
    const timer = setTimeout(processAll, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.chromaTolerance, approvedSprites, imagesReady]);

  // --- Sync engine state ---

  useEffect(() => {
    engineRef.current?.setGroupedFrames(groupedFrames);
  }, [groupedFrames]);

  useEffect(() => {
    const map = new Map(Object.entries(state.frameAdjustments));
    engineRef.current?.setAdjustments(map);
  }, [state.frameAdjustments]);

  useEffect(() => {
    const map = new Map(Object.entries(state.msPerFrame));
    engineRef.current?.setMsPerFrame(map);
  }, [state.msPerFrame]);

  useEffect(() => {
    const set = new Set(
      Object.entries(state.loopGroups)
        .filter(([, v]) => v)
        .map(([k]) => k),
    );
    engineRef.current?.setLoopGroups(set);
  }, [state.loopGroups]);

  useEffect(() => {
    engineRef.current?.setZoom(state.zoomLevel);
  }, [state.zoomLevel]);

  useEffect(() => {
    engineRef.current?.setPathScript(activeScript);
  }, [activeScript]);

  // --- Play/pause ---

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (state.isPlaying) {
      engine.start();
    } else {
      engine.stop();
      if (state.selectedAnimGroup) {
        engine.renderStatic(state.selectedAnimGroup);
      }
    }
  }, [state.isPlaying, state.selectedAnimGroup]);

  // --- Callbacks ---

  const selectAnimGroup = useCallback((group: string) => {
    dispatch({ type: 'SELECT_GROUP', group });
  }, []);

  const setFrameAdjust = useCallback((poseId: string, adjustment: FrameAdjust) => {
    dispatch({ type: 'SET_ADJUST', poseId, adjustment });
  }, []);

  const resetFrameAdjust = useCallback((poseId: string) => {
    dispatch({ type: 'RESET_ADJUST', poseId });
  }, []);

  const setChromaTolerance = useCallback((tolerance: number) => {
    // Invalidate chroma cache so frames get reprocessed
    chromaProcessingRef.current.clear();
    dispatch({ type: 'SET_CHROMA', tolerance });
  }, []);

  const setMsPerFrame = useCallback((group: string, ms: number) => {
    dispatch({ type: 'SET_MS_PER_FRAME', group, ms });
  }, []);

  const toggleLoop = useCallback((group: string) => {
    dispatch({ type: 'TOGGLE_LOOP', group });
  }, []);

  const togglePlayPause = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', playing: !state.isPlaying });
  }, [state.isPlaying]);

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: 'SET_ZOOM', zoom });
  }, []);

  const selectScript = useCallback((scriptId: string) => {
    dispatch({ type: 'SET_SCRIPT', scriptId });
  }, []);

  return {
    // State
    state,
    selectedAnimGroup: state.selectedAnimGroup,
    animGroups,
    groupedFrames,
    framesForSelectedGroup,
    pathScripts,
    activeScript,
    spriteSize,

    // Refs
    engineRef,

    // Callbacks
    selectAnimGroup,
    setFrameAdjust,
    resetFrameAdjust,
    setChromaTolerance,
    setMsPerFrame,
    toggleLoop,
    togglePlayPause,
    setZoom,
    selectScript,

    // Workflow data (for frame thumbnails)
    approvedSprites,
  };
}

export type AnimationEditorAPI = ReturnType<typeof useAnimationEditor>;
