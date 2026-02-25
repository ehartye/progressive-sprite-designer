import { useState, useEffect, useRef } from 'react';
import type { AnimationEditorAPI } from '../../hooks/useAnimationEditor';
import type { FrameAdjust } from '../../lib/animationEngine';
import { DEFAULT_FRAME_ADJUST } from '../../lib/animationEngine';
import { drawImageFitCenter } from '../../lib/canvasUtils';
import { getDefaultMsPerFrame, getDefaultLoop } from '../../lib/pathScripts';
import FrameStrip from './FrameStrip';

interface Props {
  api: AnimationEditorAPI;
}

export default function FrameEditorPanel({ api }: Props) {
  const {
    state,
    selectedAnimGroup,
    animGroups,
    framesForSelectedGroup,
    selectAnimGroup,
    setFrameAdjust,
    resetFrameAdjust,
    setChromaTolerance,
    setMsPerFrame,
    toggleLoop,
    reorderFrames,
    exportMetadata,
    exportChromaSheet,
    approvedSprites,
    chromaVersion,
    getProcessedImage,
  } = api;

  const [selectedFrameId, setSelectedFrameId] = useState('');
  const detailCanvasRef = useRef<HTMLCanvasElement>(null);

  const groupMs = state.msPerFrame[selectedAnimGroup] ?? getDefaultMsPerFrame(selectedAnimGroup);
  const groupLoop = state.loopGroups[selectedAnimGroup] ?? getDefaultLoop(selectedAnimGroup);

  // Synchronous derivation: if selected frame isn't in current group, snap to first frame
  const activeFrameId = framesForSelectedGroup.some(f => f.poseId === selectedFrameId)
    ? selectedFrameId
    : (framesForSelectedGroup[0]?.poseId ?? '');

  const selectedFrame = framesForSelectedGroup.find(f => f.poseId === activeFrameId);
  const selectedSprite = selectedFrame
    ? approvedSprites.find(s => s.poseId === selectedFrame.poseId)
    : null;
  const selectedAdj = selectedFrame
    ? (state.frameAdjustments[selectedFrame.poseId] ?? DEFAULT_FRAME_ADJUST)
    : DEFAULT_FRAME_ADJUST;

  // Draw selected frame on the detail canvas — prefer chroma-processed image
  useEffect(() => {
    const canvas = detailCanvasRef.current;
    if (!canvas || !selectedSprite) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // Try chroma-processed image first
    const processed = getProcessedImage(selectedSprite.poseId);
    if (processed) {
      drawImageFitCenter(ctx, processed, canvas.width, canvas.height);
      return;
    }

    // Fallback: load from raw base64
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawImageFitCenter(ctx, img, canvas.width, canvas.height);
    };
    img.src = `data:${selectedSprite.mimeType};base64,${selectedSprite.imageData}`;

    return () => { cancelled = true; };
  }, [selectedSprite, chromaVersion, getProcessedImage]);

  const handleSlider = (key: keyof FrameAdjust) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFrame) return;
    setFrameAdjust(selectedFrame.poseId, { ...selectedAdj, [key]: Number(e.target.value) });
  };

  return (
    <div className="anim-editor-pane">
      {/* Animation group selector */}
      <div className="anim-group-selector">
        <label className="form-label">Animation Group</label>
        <select
          className="select-input"
          value={selectedAnimGroup}
          onChange={e => selectAnimGroup(e.target.value)}
        >
          {animGroups.map(g => (
            <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Chroma key controls */}
      <div className="anim-timing-controls">
        <div className="anim-timing-row">
          <span className="anim-slider-label">
            <span className="anim-chroma-swatch" /> Chroma Key
          </span>
          <input
            type="range"
            className="anim-slider"
            min={0}
            max={128}
            step={1}
            value={state.chromaTolerance}
            onChange={e => setChromaTolerance(Number(e.target.value))}
          />
          <span className="anim-slider-value">{state.chromaTolerance}</span>
        </div>
      </div>

      {/* Group timing controls */}
      <div className="anim-timing-controls">
        <div className="anim-timing-row">
          <span className="anim-slider-label">Speed</span>
          <input
            type="range"
            className="anim-slider"
            min={50}
            max={500}
            step={10}
            value={groupMs}
            onChange={e => setMsPerFrame(selectedAnimGroup, Number(e.target.value))}
          />
          <span className="anim-slider-value">{groupMs}ms</span>
        </div>
        <div className="anim-timing-row">
          <label className="anim-loop-label">
            <input
              type="checkbox"
              checked={groupLoop}
              onChange={() => toggleLoop(selectedAnimGroup)}
            />
            Loop
          </label>
        </div>
      </div>

      {/* Selected frame detail panel — image on top, sliders below full width */}
      {selectedFrame && selectedSprite ? (
        <div className="anim-frame-detail">
          <canvas
            ref={detailCanvasRef}
            width={192}
            height={192}
            className="anim-frame-detail-canvas"
          />
          <div className="anim-frame-detail-sliders">
            <span className="anim-frame-detail-label">Frame #{selectedFrame.frameIndex}</span>
            <SliderRow label="X Pos" min={-16} max={16} step={1} value={selectedAdj.dx} onChange={handleSlider('dx')} />
            <SliderRow label="Y Pos" min={-16} max={16} step={1} value={selectedAdj.dy} onChange={handleSlider('dy')} />
            <SliderRow label="X Scale" min={0.5} max={2} step={0.05} value={selectedAdj.scaleX} onChange={handleSlider('scaleX')} />
            <SliderRow label="Y Scale" min={0.5} max={2} step={0.05} value={selectedAdj.scaleY} onChange={handleSlider('scaleY')} />
            <button className="btn btn-secondary btn-sm" onClick={() => resetFrameAdjust(selectedFrame.poseId)}>
              Reset
            </button>
          </div>
        </div>
      ) : (
        <p className="empty-state-text">Select a frame below to adjust.</p>
      )}

      {/* Thumbnail strip */}
      <FrameStrip
        frames={framesForSelectedGroup}
        sprites={approvedSprites}
        selectedPoseId={activeFrameId}
        onSelect={setSelectedFrameId}
        onReorder={ids => reorderFrames(selectedAnimGroup, ids)}
      />

      {/* Export section */}
      <div className="anim-export-section">
        <button className="btn btn-secondary btn-sm" onClick={exportMetadata}>
          Export Metadata (JSON)
        </button>
        <button className="btn btn-secondary btn-sm" onClick={exportChromaSheet}>
          Export Sprite Sheet
        </button>
      </div>
    </div>
  );
}

// --- SliderRow ---

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function SliderRow({ label, min, max, step, value, onChange }: SliderRowProps) {
  const displayValue = step < 1 ? value.toFixed(2) : String(value);
  return (
    <div className="anim-slider-row">
      <span className="anim-slider-label">{label}</span>
      <input
        type="range"
        className="anim-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
      />
      <span className="anim-slider-value">{displayValue}</span>
    </div>
  );
}
