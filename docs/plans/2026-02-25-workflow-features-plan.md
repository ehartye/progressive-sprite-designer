# Workflow Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three workflow features: configurable generation count (1-4), copy pose from approved sprite, and horizontal mirror flip.

**Architecture:** All three features follow the existing pattern: add reducer actions in WorkflowContext.tsx, wire them through useWorkflow.ts hook functions, and expose in UI components. A new `flipImageHorizontal()` utility joins `imageUtils.ts`. A new `CopyPosePicker.tsx` component provides the sprite selection modal.

**Tech Stack:** React 18, TypeScript, HTML5 Canvas API, CSS (no framework)

---

### Task 1: Add `flipImageHorizontal` utility to imageUtils.ts

**Files:**
- Modify: `src/lib/imageUtils.ts`

**Step 1: Add the flip function after the existing `downsampleImage` function**

Append to `src/lib/imageUtils.ts`:

```typescript
/**
 * Flip a base64-encoded image horizontally (mirror).
 * Returns a new base64 string (no data URL prefix) and mime type.
 */
export function flipImageHorizontal(
  base64: string,
  mimeType: string
): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      resolve({
        data: dataUrl.replace(/^data:image\/png;base64,/, ''),
        mimeType: 'image/png',
      });
    };
    img.onerror = () => reject(new Error('Failed to load image for flip'));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
feat: add flipImageHorizontal utility
```

---

### Task 2: Add `generationCount` state and new reducer actions to WorkflowContext.tsx

**Files:**
- Modify: `src/context/WorkflowContext.tsx`

**Step 1: Add `generationCount` to WorkflowState interface (after `generationSetId`)**

```typescript
  generationSetId: number | null;
  generationCount: number;
```

**Step 2: Add new action types to the Action union**

Add these to the `type Action` union:

```typescript
  | { type: 'SET_GENERATION_COUNT'; count: number }
  | { type: 'FLIP_OPTION'; index: number; flippedData: string; flippedMimeType: string }
  | { type: 'FLIP_APPROVED'; poseId: string; flippedData: string; flippedMimeType: string }
  | { type: 'COPY_POSE'; sprite: ApprovedSprite }
```

**Step 3: Add `generationCount: 4` to initialState**

```typescript
  generationSetId: null,
  generationCount: 4,
```

**Step 4: Add reducer cases**

Add these cases to `workflowReducer` before the `default:` case:

```typescript
    case 'SET_GENERATION_COUNT':
      return { ...state, generationCount: action.count };
    case 'FLIP_OPTION': {
      const opts = [...state.generatedOptions];
      const opt = opts[action.index];
      if (opt?.image) {
        opts[action.index] = { ...opt, image: { data: action.flippedData, mimeType: action.flippedMimeType } };
      }
      return { ...state, generatedOptions: opts };
    }
    case 'FLIP_APPROVED': {
      const updated = state.approvedSprites.map(s =>
        s.poseId === action.poseId
          ? { ...s, imageData: action.flippedData, mimeType: action.flippedMimeType }
          : s
      );
      return { ...state, approvedSprites: updated };
    }
    case 'COPY_POSE':
      return {
        ...state,
        approvedSprites: [...state.approvedSprites.filter(s => s.poseId !== action.sprite.poseId), action.sprite],
        selectedIndex: -1,
      };
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 6: Commit**

```
feat: add generationCount, flip, and copyPose reducer actions
```

---

### Task 3: Wire new hook functions in useWorkflow.ts

**Files:**
- Modify: `src/hooks/useWorkflow.ts`

**Step 1: Add `flipImageHorizontal` import**

Add to the existing import from `imageUtils`:

```typescript
import { downsampleImage, flipImageHorizontal } from '../lib/imageUtils';
```

**Step 2: Add `setGenerationCount` callback (after `setCustomInstructions`)**

```typescript
  const setGenerationCount = useCallback((count: number) => {
    dispatch({ type: 'SET_GENERATION_COUNT', count: Math.max(1, Math.min(4, count)) });
  }, [dispatch]);
```

**Step 3: Update `generate()` to use `state.generationCount`**

In the `generate` callback:
- Change `setStatus('Generating 4 options...', 'info')` to:
  ```typescript
  setStatus(`Generating ${state.generationCount} option(s)...`, 'info');
  ```
- The `engine.generateCurrentPose` call currently hardcodes 4 inside `workflow.ts`. We pass count via a new parameter. Change:
  ```typescript
  const results = await engine.generateCurrentPose(state.characterConfig, state.customInstructions);
  ```
  to:
  ```typescript
  const results = await engine.generateCurrentPose(state.characterConfig, state.customInstructions, state.generationCount);
  ```
- Change the error fallback from hardcoded 4 error entries:
  ```typescript
  results: [{ error: message }, { error: 'Failed' }, { error: 'Failed' }, { error: 'Failed' }],
  ```
  to:
  ```typescript
  results: Array.from({ length: state.generationCount }, (_, i) => ({ error: i === 0 ? message : 'Failed' })),
  ```
- Add `state.generationCount` to the dependency array of the `generate` callback.

**Step 4: Add `flipOption` callback**

```typescript
  const flipOption = useCallback(async (index: number) => {
    const option = state.generatedOptions[index];
    if (!option?.image) return;
    try {
      const flipped = await flipImageHorizontal(option.image.data, option.image.mimeType);
      dispatch({ type: 'FLIP_OPTION', index, flippedData: flipped.data, flippedMimeType: flipped.mimeType });

      // Also update engine's in-memory copy
      const engine = engineRef.current;
      if (engine && engine.generatedOptions[index]?.image) {
        engine.generatedOptions[index] = {
          ...engine.generatedOptions[index],
          image: { data: flipped.data, mimeType: flipped.mimeType },
        };
      }
    } catch (err) {
      console.warn('Failed to flip image:', err);
    }
  }, [state.generatedOptions, dispatch, engineRef]);
```

**Step 5: Add `flipApproved` callback**

```typescript
  const flipApproved = useCallback(async (poseId: string) => {
    const sprite = state.approvedSprites.find(s => s.poseId === poseId);
    if (!sprite) return;
    try {
      const flipped = await flipImageHorizontal(sprite.imageData, sprite.mimeType);
      dispatch({ type: 'FLIP_APPROVED', poseId, flippedData: flipped.data, flippedMimeType: flipped.mimeType });

      // Update engine's in-memory copy
      const engine = engineRef.current;
      if (engine) {
        const engineSprite = engine.approvedSprites.get(poseId);
        if (engineSprite) {
          engine.approvedSprites.set(poseId, { ...engineSprite, imageData: flipped.data, mimeType: flipped.mimeType });
        }
      }

      // Re-save to DB
      if (state.generationSetId) {
        const cachedId = spriteDbIdsRef.current.get(poseId);
        if (cachedId !== undefined) {
          addSpriteToGallery(state.generationSetId, {
            poseId,
            poseName: sprite.poseName,
            imageData: flipped.data,
            mimeType: flipped.mimeType,
            prompt: sprite.prompt,
            modelId: sprite.modelId,
            customInstructions: sprite.customInstructions,
            referenceImageIds: sprite.referenceImageIds,
          }).catch(() => { /* ignore */ });
        }
      }

      setStatus('Image flipped.', 'success');
    } catch (err) {
      console.warn('Failed to flip approved sprite:', err);
    }
  }, [state.approvedSprites, state.generationSetId, dispatch, engineRef, spriteDbIdsRef, setStatus]);
```

**Step 6: Add `copyFromSprite` callback**

```typescript
  const copyFromSprite = useCallback(async (sourcePoseId: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    const source = state.approvedSprites.find(s => s.poseId === sourcePoseId);
    if (!source) return;

    const pose = engine.getCurrentPose();
    if (!pose) return;
    const poseId = pose.id;

    const sprite: ApprovedSprite = {
      poseId,
      poseName: pose.name,
      imageData: source.imageData,
      mimeType: source.mimeType,
      timestamp: Date.now(),
      prompt: `Copied from ${source.poseName}`,
      modelId: source.modelId,
      customInstructions: '',
      referenceImageIds: [sourcePoseId],
    };

    // Update engine
    engine.approvedSprites.set(poseId, {
      imageData: sprite.imageData,
      mimeType: sprite.mimeType,
      poseName: sprite.poseName,
      timestamp: sprite.timestamp,
      prompt: sprite.prompt,
      modelId: sprite.modelId,
      customInstructions: sprite.customInstructions,
      referenceImageIds: sprite.referenceImageIds,
    });

    dispatch({ type: 'COPY_POSE', sprite });

    // Auto-save to DB
    if (state.generationSetId) {
      try {
        const result = await addSpriteToGallery(state.generationSetId, {
          poseId: sprite.poseId,
          poseName: sprite.poseName,
          imageData: sprite.imageData,
          mimeType: sprite.mimeType,
          prompt: sprite.prompt,
          modelId: sprite.modelId,
          customInstructions: sprite.customInstructions,
          referenceImageIds: sprite.referenceImageIds,
        });
        spriteDbIdsRef.current.set(sprite.poseId, result.id);
      } catch (err) {
        console.warn('Failed to save copied sprite to gallery:', err);
      }
    }

    setStatus(`Copied from "${source.poseName}".`, 'success');
  }, [state.approvedSprites, state.generationSetId, dispatch, engineRef, spriteDbIdsRef, setStatus]);
```

**Step 7: Add new functions to the return object**

Add to the return statement:

```typescript
    setGenerationCount,
    flipOption,
    flipApproved,
    copyFromSprite,
```

**Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 9: Commit**

```
feat: wire generation count, flip, and copy-pose hook functions
```

---

### Task 4: Update WorkflowEngine.generateCurrentPose to accept count parameter

**Files:**
- Modify: `src/lib/workflow.ts`

**Step 1: Add `count` parameter to `generateCurrentPose`**

Change the method signature from:

```typescript
async generateCurrentPose(characterConfig: CharacterConfig, customInstructions: string = ''): Promise<GeneratedOption[]> {
```

to:

```typescript
async generateCurrentPose(characterConfig: CharacterConfig, customInstructions: string = '', count: number = 4): Promise<GeneratedOption[]> {
```

**Step 2: Pass `count` to `generateMultiple` instead of hardcoded 4**

Change:

```typescript
const results = await this.client.generateMultiple(prompt, refs, 4, aspectRatio);
```

to:

```typescript
const results = await this.client.generateMultiple(prompt, refs, count, aspectRatio);
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```
feat: pass generation count through to API client
```

---

### Task 5: Update ActionBar.tsx with generation count selector and new buttons

**Files:**
- Modify: `src/components/workflow/ActionBar.tsx`

**Step 1: Update the hook destructuring**

Change:

```typescript
const { state, generate, approve, skip, nextPose, prevPose } = useWorkflow();
```

to:

```typescript
const { state, generate, approve, skip, nextPose, prevPose, setGenerationCount, flipApproved, copyFromSprite } = useWorkflow();
```

**Step 2: Add state for copy picker visibility**

```typescript
import { useState } from 'react';
```

And inside the component:

```typescript
const [showCopyPicker, setShowCopyPicker] = useState(false);
```

**Step 3: Compute current pose status**

After `hasApproved`:

```typescript
const currentPoseId = state.hierarchy[state.currentPhaseIndex]?.poses[state.currentPoseIndex]?.id;
const isCurrentPoseApproved = hasApproved;
const isCurrentPoseEmpty = !isCurrentPoseApproved && !state.skippedPoseIds.includes(currentPoseId ?? '');
```

**Step 4: Add import for CopyPosePicker**

```typescript
import CopyPosePicker from './CopyPosePicker';
```

**Step 5: Replace the entire return JSX**

```tsx
return (
  <div className="action-bar">
    <button className="btn btn-secondary" onClick={prevPose} disabled={!state.workflowActive}>
      &larr; Previous Pose
    </button>

    {/* Generation count selector */}
    <div className="gen-count-selector">
      {[1, 2, 3, 4].map(n => (
        <button
          key={n}
          className={`gen-count-btn${state.generationCount === n ? ' gen-count-active' : ''}`}
          onClick={() => setGenerationCount(n)}
          title={`Generate ${n} option(s)`}
        >
          {n}
        </button>
      ))}
    </div>

    <button className="btn btn-primary" onClick={generate} disabled={!state.workflowActive || state.isGenerating}>
      {state.isGenerating ? 'Generating...' : 'Generate'}
    </button>
    <button className="btn btn-success" onClick={approve} disabled={!hasSelection}>
      Approve Selected
    </button>
    <button className="btn btn-secondary" onClick={skip} disabled={!state.workflowActive || state.isGenerating}>
      Skip Pose
    </button>
    <button className="btn btn-secondary" onClick={nextPose} disabled={!state.workflowActive || !hasApproved}>
      Next Pose &rarr;
    </button>

    {/* Copy From button — visible when current pose is empty and there are approved sprites */}
    {isCurrentPoseEmpty && state.approvedSprites.length > 0 && (
      <button
        className="btn btn-secondary"
        onClick={() => setShowCopyPicker(true)}
        disabled={!state.workflowActive}
      >
        Copy From...
      </button>
    )}

    {/* Flip button — visible when current pose is approved */}
    {isCurrentPoseApproved && currentPoseId && (
      <button
        className="btn btn-secondary"
        onClick={() => flipApproved(currentPoseId)}
        disabled={!state.workflowActive}
      >
        Flip &#8596;
      </button>
    )}

    {/* Copy pose picker modal */}
    {showCopyPicker && (
      <CopyPosePicker
        sprites={state.approvedSprites}
        onSelect={(sourcePoseId) => {
          copyFromSprite(sourcePoseId);
          setShowCopyPicker(false);
        }}
        onClose={() => setShowCopyPicker(false)}
      />
    )}
  </div>
);
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

### Task 6: Create CopyPosePicker.tsx component

**Files:**
- Create: `src/components/workflow/CopyPosePicker.tsx`

**Step 1: Create the component**

```tsx
import type { ApprovedSprite } from '../../context/WorkflowContext';

interface Props {
  sprites: ApprovedSprite[];
  onSelect: (poseId: string) => void;
  onClose: () => void;
}

export default function CopyPosePicker({ sprites, onSelect, onClose }: Props) {
  return (
    <div className="copy-picker-overlay" onClick={onClose}>
      <div className="copy-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="copy-picker-header">
          <span>Copy from approved sprite</span>
          <button className="copy-picker-close" onClick={onClose}>&times;</button>
        </div>
        <div className="copy-picker-grid">
          {sprites.map(sprite => (
            <div
              key={sprite.poseId}
              className="copy-picker-item"
              onClick={() => onSelect(sprite.poseId)}
            >
              <img
                src={`data:${sprite.mimeType};base64,${sprite.imageData}`}
                alt={sprite.poseName}
                className="copy-picker-thumb"
              />
              <span className="copy-picker-label">{sprite.poseName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

### Task 7: Add flip button to ImageCard.tsx

**Files:**
- Modify: `src/components/workflow/ImageCard.tsx`

**Step 1: Add `onFlip` prop**

Update the Props interface:

```typescript
interface Props {
  option: GeneratedOption;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRegenerate: () => void;
  onFlip: () => void;
}
```

**Step 2: Add onFlip to destructuring**

```typescript
export default function ImageCard({ option, index, isSelected, onSelect, onRegenerate, onFlip }: Props) {
```

**Step 3: Add flip button next to the regen button inside `.image-card-inner`**

After the existing regen button, add:

```tsx
<button
  className="flip-btn"
  title="Flip horizontal"
  onClick={e => { e.stopPropagation(); onFlip(); }}
>
  &#8596;
</button>
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

### Task 8: Update GenerationGrid.tsx for dynamic count and flip

**Files:**
- Modify: `src/components/workflow/GenerationGrid.tsx`

**Step 1: Update to use generationCount and flipOption**

Replace the full component:

```tsx
import { useWorkflow } from '../../hooks/useWorkflow';
import ImageCard from './ImageCard';

export default function GenerationGrid() {
  const { state, selectImage, regenerateOne, flipOption } = useWorkflow();
  const count = state.generationCount;

  // Show shimmer placeholders while generating or when no results
  if (state.isGenerating) {
    return (
      <div className={`generation-grid gen-grid-${count}`}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="image-card placeholder-card">
            <div className="image-card-inner shimmer" />
            <div className="image-card-meta"><span className="image-dim">Generating...</span></div>
          </div>
        ))}
      </div>
    );
  }

  if (state.generatedOptions.length === 0) {
    return (
      <div className={`generation-grid gen-grid-${count}`}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="image-card placeholder-card">
            <div className="image-card-inner shimmer" />
            <div className="image-card-meta"><span className="image-dim">--</span></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`generation-grid gen-grid-${count}`}>
      {state.generatedOptions.map((option, idx) => (
        <ImageCard
          key={idx}
          option={option}
          index={idx}
          isSelected={state.selectedIndex === idx}
          onSelect={() => selectImage(idx)}
          onRegenerate={() => regenerateOne(idx)}
          onFlip={() => flipOption(idx)}
        />
      ))}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

### Task 9: Add CSS styles for all new UI elements

**Files:**
- Modify: `css/styles.css`

**Step 1: Add generation count selector styles (after `.action-bar` block around line 493)**

```css
/* --- Generation Count Selector --- */
.gen-count-selector {
  display: flex;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.gen-count-btn {
  background: var(--bg-card);
  border: none;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-family: var(--font-mono);
  width: 28px;
  height: 28px;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.gen-count-btn:hover {
  background: var(--bg-card-hover);
  color: var(--text-primary);
}

.gen-count-btn.gen-count-active {
  background: var(--accent);
  color: #0d1117;
}
```

**Step 2: Add grid layout variants for 1-4 columns (after `.generation-grid` block around line 397)**

```css
.gen-grid-1 { grid-template-columns: 1fr; max-width: 300px; }
.gen-grid-2 { grid-template-columns: repeat(2, 1fr); }
.gen-grid-3 { grid-template-columns: repeat(3, 1fr); }
.gen-grid-4 { grid-template-columns: repeat(2, 1fr); }
```

**Step 3: Add flip button styles (after `.regen-btn:hover` block around line 772)**

```css
.flip-btn {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(13, 17, 23, 0.85);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 1rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast), color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-card:hover .flip-btn {
  opacity: 1;
}

.flip-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}
```

**Step 4: Add copy picker modal styles (after the flip button styles)**

```css
/* --- Copy Pose Picker Modal --- */
.copy-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.copy-picker-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  max-width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  min-width: 280px;
}

.copy-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.copy-picker-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.3rem;
  cursor: pointer;
  padding: 0 4px;
}

.copy-picker-close:hover {
  color: var(--text-primary);
}

.copy-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}

.copy-picker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.copy-picker-item:hover {
  border-color: var(--accent);
  background: var(--bg-card-hover);
}

.copy-picker-thumb {
  width: 80px;
  height: 80px;
  object-fit: contain;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.copy-picker-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
```

**Step 5: Verify the app renders correctly**

Run: `npx tsc --noEmit`

**Step 6: Commit all remaining changes**

```
feat: add generation count selector, copy pose picker, flip buttons, and CSS
```

---

### Task 10: Final build check and integration commit

**Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`

**Step 2: Verify no stale references**

Grep for any remaining hardcoded `[0, 1, 2, 3].map` in GenerationGrid (should be gone).

**Step 3: Push to remote**

```
git push
```
