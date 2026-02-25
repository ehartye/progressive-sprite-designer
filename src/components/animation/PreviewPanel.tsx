import { useRef, useEffect } from 'react';
import { AnimationEngine } from '../../lib/animationEngine';
import type { AnimationEditorAPI } from '../../hooks/useAnimationEditor';

interface Props {
  api: AnimationEditorAPI;
}

export default function PreviewPanel({ api }: Props) {
  const {
    state,
    engineRef,
    groupedFrames,
    activeScript,
    pathScripts,
    spriteSize,
    togglePlayPause,
    setZoom,
    selectScript,
  } = api;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas dimensions based on zoom
  const canvasW = spriteSize.w * state.zoomLevel * 6;
  const canvasH = spriteSize.h * state.zoomLevel * 5;

  // Create engine on mount, seed with current state, clean up on unmount.
  // All subsequent syncs happen in the hook's useEffects.
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new AnimationEngine(
      canvasRef.current,
      spriteSize.w,
      spriteSize.h,
    );
    engineRef.current = engine;

    // Seed engine with current state so first frame renders correctly
    engine.setGroupedFrames(groupedFrames);
    engine.setZoom(state.zoomLevel);
    engine.setPathScript(activeScript);

    const msMap = new Map(Object.entries(state.msPerFrame));
    engine.setMsPerFrame(msMap);

    const loopSet = new Set(
      Object.entries(state.loopGroups).filter(([, v]) => v).map(([k]) => k),
    );
    engine.setLoopGroups(loopSet);

    const adjMap = new Map(Object.entries(state.frameAdjustments));
    engine.setAdjustments(adjMap);

    if (state.isPlaying) {
      engine.start();
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="anim-preview-pane">
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="anim-preview-canvas"
      />
      <div className="anim-preview-controls">
        <button className="btn btn-secondary" onClick={togglePlayPause}>
          {state.isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="anim-zoom-control">
          <span className="anim-slider-label">Zoom</span>
          <input
            type="range"
            className="anim-slider"
            min={2}
            max={8}
            step={1}
            value={state.zoomLevel}
            onChange={e => setZoom(Number(e.target.value))}
          />
          <span className="anim-slider-value">{state.zoomLevel}x</span>
        </div>
        {pathScripts.length > 1 && (
          <select
            className="select-input anim-script-select"
            value={state.selectedScriptId}
            onChange={e => selectScript(e.target.value)}
          >
            {pathScripts.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
