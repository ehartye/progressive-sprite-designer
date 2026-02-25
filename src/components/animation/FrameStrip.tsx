import { useState, useRef, useEffect } from 'react';
import type { AnimFrame, FrameAdjust } from '../../lib/animationEngine';
import { DEFAULT_FRAME_ADJUST } from '../../lib/animationEngine';
import type { ApprovedSprite } from '../../context/WorkflowContext';

interface FrameStripProps {
  frames: AnimFrame[];
  adjustments: Record<string, FrameAdjust>;
  sprites: ApprovedSprite[];
  onAdjust: (poseId: string, adjustment: FrameAdjust) => void;
  onReset: (poseId: string) => void;
  onReorder: (orderedPoseIds: string[]) => void;
}

export default function FrameStrip({ frames, adjustments, sprites, onAdjust, onReset, onReorder }: FrameStripProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (frames.length === 0) {
    return <p className="empty-state-text">No approved frames for this group yet.</p>;
  }

  const handleDrop = (targetIndex: number) => {
    if (dragIndex != null && dragIndex !== targetIndex) {
      const ids = frames.map(f => f.poseId);
      const [moved] = ids.splice(dragIndex, 1);
      ids.splice(targetIndex, 0, moved);
      onReorder(ids);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="anim-frame-strip">
      {frames.map((frame, index) => {
        const sprite = sprites.find(s => s.poseId === frame.poseId);
        if (!sprite) return null;
        const adj = adjustments[frame.poseId] ?? DEFAULT_FRAME_ADJUST;
        return (
          <FrameCard
            key={frame.poseId}
            frame={frame}
            sprite={sprite}
            adjustment={adj}
            onAdjust={onAdjust}
            onReset={onReset}
            isDragging={dragIndex === index}
            isDragOver={dragOverIndex === index}
            onDragStart={() => setDragIndex(index)}
            onDragOver={() => setDragOverIndex(index)}
            onDragLeave={() => { if (dragOverIndex === index) setDragOverIndex(null); }}
            onDrop={() => handleDrop(index)}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
          />
        );
      })}
    </div>
  );
}

// --- FrameCard (private sub-component) ---

interface FrameCardProps {
  frame: AnimFrame;
  sprite: ApprovedSprite;
  adjustment: FrameAdjust;
  onAdjust: (poseId: string, adjustment: FrameAdjust) => void;
  onReset: (poseId: string) => void;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function FrameCard({
  frame, sprite, adjustment, onAdjust, onReset,
  isDragging, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: FrameCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw thumbnail
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      // Scale to fill canvas, centered
      const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    };
    img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;

    return () => { cancelled = true; };
  }, [sprite.imageData, sprite.mimeType]);

  const handleSlider = (key: keyof FrameAdjust) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onAdjust(frame.poseId, { ...adjustment, [key]: Number(e.target.value) });
  };

  const className = [
    'anim-frame-card',
    isDragging ? 'anim-frame-dragging' : '',
    isDragOver ? 'anim-frame-drag-over' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
    >
      <div className="anim-frame-thumb-wrapper">
        <canvas ref={canvasRef} width={48} height={48} className="anim-frame-thumb" />
        <span className="anim-frame-index">#{frame.frameIndex}</span>
      </div>
      <div className="anim-frame-sliders">
        <SliderRow label="X Pos" min={-16} max={16} step={1} value={adjustment.dx} onChange={handleSlider('dx')} />
        <SliderRow label="Y Pos" min={-16} max={16} step={1} value={adjustment.dy} onChange={handleSlider('dy')} />
        <SliderRow label="X Scale" min={0.5} max={2} step={0.05} value={adjustment.scaleX} onChange={handleSlider('scaleX')} />
        <SliderRow label="Y Scale" min={0.5} max={2} step={0.05} value={adjustment.scaleY} onChange={handleSlider('scaleY')} />
        <button className="btn btn-secondary btn-sm" onClick={() => onReset(frame.poseId)}>
          Reset
        </button>
      </div>
    </div>
  );
}

// --- SliderRow (private sub-component) ---

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
