import { useReducer, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { useWorkflowContext } from '../context/WorkflowContext';
import type { ApprovedSprite } from '../context/WorkflowContext';
import type { Phase, Pose } from '../lib/poses';
import { GAME_TYPES } from '../lib/poses';
import { AnimationEngine } from '../lib/animationEngine';
import type { FrameAdjust, AnimFrame } from '../lib/animationEngine';
import { DEFAULT_FRAME_ADJUST } from '../lib/animationEngine';
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
  onionSkinEnabled: boolean;
  onionSkinOpacity: number;
  frameOrder: Record<string, string[]>;
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
  | { type: 'SET_ONION_SKIN'; enabled: boolean }
  | { type: 'SET_ONION_OPACITY'; opacity: number }
  | { type: 'REORDER_FRAMES'; group: string; orderedPoseIds: string[] }
  | { type: 'INIT_GROUPS'; groups: string[] };

const initialState: AnimEditorState = {
  selectedAnimGroup: '',
  frameAdjustments: {},
  chromaTolerance: 100,
  msPerFrame: {},
  loopGroups: {},
  isPlaying: true,
  zoomLevel: 4,
  selectedScriptId: '',
  onionSkinEnabled: false,
  onionSkinOpacity: 0.3,
  frameOrder: {},
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
    case 'SET_ONION_SKIN':
      return { ...state, onionSkinEnabled: action.enabled };
    case 'SET_ONION_OPACITY':
      return { ...state, onionSkinOpacity: action.opacity };
    case 'REORDER_FRAMES':
      return {
        ...state,
        frameOrder: { ...state.frameOrder, [action.group]: action.orderedPoseIds },
      };
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

// --- Download helper ---

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const spriteSize = useMemo(
    () => GAME_TYPES[gameType]?.defaultSpriteSize ?? { w: 16, h: 24 },
    [gameType],
  );

  const [state, dispatch] = useReducer(animReducer, initialState);
  const engineRef = useRef<AnimationEngine | null>(null);

  // Track image loading via state (not ref) so chroma effect re-runs
  const [imagesReady, setImagesReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });

  // Persistent processed images ref — survives across effect cycles
  const processedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Loaded raw images ref — survives engine mount race
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Track chroma processing to avoid redundant work
  const chromaProcessingRef = useRef<Map<string, number>>(new Map()); // poseId → tolerance

  // Bump to trigger re-renders when chroma processing completes
  const [chromaVersion, setChromaVersion] = useState(0);

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

  // Apply custom frame ordering
  const orderedGroupedFrames = useMemo(() => {
    const result = new Map<string, AnimFrame[]>();
    for (const [group, frames] of groupedFrames) {
      const order = state.frameOrder[group];
      if (order) {
        const frameMap = new Map(frames.map(f => [f.poseId, f]));
        const ordered: AnimFrame[] = [];
        for (const id of order) {
          const f = frameMap.get(id);
          if (f) ordered.push(f);
        }
        // Include any new frames not yet in the custom order
        for (const f of frames) {
          if (!order.includes(f.poseId)) ordered.push(f);
        }
        result.set(group, ordered);
      } else {
        result.set(group, frames);
      }
    }
    return result;
  }, [groupedFrames, state.frameOrder]);

  const framesForSelectedGroup = useMemo(
    () => orderedGroupedFrames.get(state.selectedAnimGroup) ?? [],
    [orderedGroupedFrames, state.selectedAnimGroup],
  );


  // --- Initialize groups on first render / when groups change ---

  useEffect(() => {
    if (animGroups.length > 0) {
      dispatch({ type: 'INIT_GROUPS', groups: animGroups });
    }
  }, [animGroups]);

  // Select first script
  useEffect(() => {
    if (pathScripts.length > 0 && !state.selectedScriptId) {
      dispatch({ type: 'SET_SCRIPT', scriptId: pathScripts[0].id });
    }
  }, [pathScripts, state.selectedScriptId]);

  // --- Preload images ---

  useEffect(() => {
    // Invalidate chroma cache so re-approved sprites get reprocessed
    processedImagesRef.current = new Map();
    chromaProcessingRef.current = new Map();

    let cancelled = false;
    const total = approvedSprites.length;
    setLoadProgress({ loaded: 0, total });
    setImagesReady(false);

    if (total === 0) return;

    const loadAll = async () => {
      const imageMap = new Map<string, HTMLImageElement>();
      let loaded = 0;

      const promises = approvedSprites.map(sprite => {
        return new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            loaded++;
            if (!cancelled) setLoadProgress({ loaded, total });
            resolve([sprite.poseId, img]);
          };
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
        loadedImagesRef.current = imageMap;
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
        setChromaVersion(v => v + 1);
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
    engineRef.current?.setGroupedFrames(orderedGroupedFrames);
  }, [orderedGroupedFrames]);

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

  useEffect(() => {
    engineRef.current?.setOnionSkin(state.onionSkinEnabled, state.onionSkinOpacity);
  }, [state.onionSkinEnabled, state.onionSkinOpacity]);

  // --- Play/pause ---

  useEffect(() => {
    if (!engineRef.current) return;
    if (state.isPlaying) engineRef.current.start();
    else engineRef.current.stop();
  }, [state.isPlaying]);

  useEffect(() => {
    if (!state.isPlaying && state.selectedAnimGroup) {
      engineRef.current?.renderStatic(state.selectedAnimGroup);
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

  const toggleOnionSkin = useCallback(() => {
    dispatch({ type: 'SET_ONION_SKIN', enabled: !state.onionSkinEnabled });
  }, [state.onionSkinEnabled]);

  const setOnionOpacity = useCallback((opacity: number) => {
    dispatch({ type: 'SET_ONION_OPACITY', opacity });
  }, []);

  const reorderFrames = useCallback((group: string, orderedPoseIds: string[]) => {
    dispatch({ type: 'REORDER_FRAMES', group, orderedPoseIds });
  }, []);

  const getProcessedImage = useCallback((poseId: string): HTMLImageElement | null => {
    return processedImagesRef.current.get(poseId) ?? null;
  }, []);

  // --- Export functions ---

  const exportMetadata = useCallback(() => {
    const groups: Record<string, unknown> = {};
    for (const [group, frames] of orderedGroupedFrames) {
      groups[group] = {
        msPerFrame: state.msPerFrame[group] ?? getDefaultMsPerFrame(group),
        loop: state.loopGroups[group] ?? getDefaultLoop(group),
        frames: frames.map(f => ({
          poseId: f.poseId,
          frameIndex: f.frameIndex,
          adjustments: state.frameAdjustments[f.poseId] ?? DEFAULT_FRAME_ADJUST,
        })),
      };
    }

    const metadata = { gameType, spriteSize, animationGroups: groups };
    const json = JSON.stringify(metadata, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    triggerDownload(blob, 'animation_metadata.json');
  }, [gameType, spriteSize, orderedGroupedFrames, state.msPerFrame, state.loopGroups, state.frameAdjustments]);

  const exportChromaSheet = useCallback(() => {
    const processed = processedImagesRef.current;
    if (processed.size === 0) return;

    // Collect images in animation group order
    const allImages: HTMLImageElement[] = [];
    for (const [, frames] of orderedGroupedFrames) {
      for (const frame of frames) {
        const img = processed.get(frame.poseId);
        if (img) allImages.push(img);
      }
    }
    if (allImages.length === 0) return;

    const maxW = Math.max(...allImages.map(i => i.naturalWidth || i.width));
    const maxH = Math.max(...allImages.map(i => i.naturalHeight || i.height));
    const cols = Math.ceil(Math.sqrt(allImages.length));
    const rows = Math.ceil(allImages.length / cols);

    const canvas = document.createElement('canvas');
    canvas.width = cols * maxW;
    canvas.height = rows * maxH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    allImages.forEach((img, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const x = col * maxW + Math.floor((maxW - iw) / 2);
      const y = row * maxH + Math.floor((maxH - ih) / 2);
      ctx.drawImage(img, x, y);
    });

    canvas.toBlob(blob => {
      if (!blob) return;
      triggerDownload(blob, 'sprite_sheet_transparent.png');
    }, 'image/png');
  }, [orderedGroupedFrames]);

  return {
    // State
    state,
    selectedAnimGroup: state.selectedAnimGroup,
    animGroups,
    groupedFrames: orderedGroupedFrames,
    framesForSelectedGroup,
    pathScripts,
    activeScript,
    spriteSize,

    // Refs
    engineRef,
    loadedImagesRef,

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
    toggleOnionSkin,
    setOnionOpacity,
    reorderFrames,

    // Export
    exportMetadata,
    exportChromaSheet,

    // Chroma
    chromaVersion,
    getProcessedImage,

    // Loading state
    imagesReady,
    loadProgress,

    // Workflow data (for frame thumbnails)
    approvedSprites,
  };
}

export type AnimationEditorAPI = ReturnType<typeof useAnimationEditor>;
