import { useState, useMemo, useRef, useEffect } from 'react';
import type { AnimFrame } from '../../lib/animationEngine';
import type { ApprovedSprite } from '../../context/WorkflowContext';
import { drawImageFitCenter, setupHiDpiCanvas } from '../../lib/canvasUtils';

interface FrameStripProps {
  frames: AnimFrame[];
  sprites: ApprovedSprite[];
  selectedPoseId: string;
  onSelect: (poseId: string) => void;
  onReorder: (orderedPoseIds: string[]) => void;
}

export default function FrameStrip({ frames, sprites, selectedPoseId, onSelect, onReorder }: FrameStripProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const spriteMap = useMemo(
    () => new Map(sprites.map(s => [s.poseId, s])),
    [sprites],
  );

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
        const sprite = spriteMap.get(frame.poseId);
        if (!sprite) return null;
        return (
          <FrameThumb
            key={frame.poseId}
            frame={frame}
            sprite={sprite}
            isSelected={frame.poseId === selectedPoseId}
            onClick={() => onSelect(frame.poseId)}
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

// --- FrameThumb ---

interface FrameThumbProps {
  frame: AnimFrame;
  sprite: ApprovedSprite;
  isSelected: boolean;
  onClick: () => void;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function FrameThumb({
  frame, sprite, isSelected, onClick,
  isDragging, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: FrameThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const THUMB_SIZE = 64;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setupHiDpiCanvas(canvas, THUMB_SIZE, THUMB_SIZE);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      drawImageFitCenter(ctx, img, THUMB_SIZE, THUMB_SIZE);
    };
    img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;

    return () => { cancelled = true; };
  }, [sprite.imageData, sprite.mimeType]);

  const className = [
    'anim-frame-thumb-card',
    isSelected ? 'anim-frame-thumb-selected' : '',
    isDragging ? 'anim-frame-dragging' : '',
    isDragOver ? 'anim-frame-drag-over' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      onClick={onClick}
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
    >
      <canvas ref={canvasRef} className="anim-frame-thumb" />
      <span className="anim-frame-index">#{frame.frameIndex}</span>
    </div>
  );
}
