import type { AnimationEditorAPI } from '../../hooks/useAnimationEditor';
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
  } = api;

  const groupMs = state.msPerFrame[selectedAnimGroup] ?? 133;
  const groupLoop = state.loopGroups[selectedAnimGroup] ?? true;

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

      {/* Frame list with sliders */}
      <FrameStrip
        frames={framesForSelectedGroup}
        adjustments={state.frameAdjustments}
        sprites={approvedSprites}
        onAdjust={setFrameAdjust}
        onReset={resetFrameAdjust}
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
