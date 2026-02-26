# Workflow Features Design: Generation Count, Copy Pose, Mirror Flip

Date: 2026-02-25

## Overview

Three features to improve the sprite generation workflow:
1. Configurable number of generation options (1-4)
2. Copy an approved pose into an empty pose slot
3. Horizontal mirror flip for generated and approved images

## Feature 1: Configurable Generation Count (1-4)

### State
- Add `generationCount: number` (default 4) to `WorkflowState`
- New reducer action `SET_GENERATION_COUNT`

### UI
- Segmented button group `[1] [2] [3] [4]` in `ActionBar.tsx`, inline next to Generate button

### Flow
- `ActionBar` reads/sets `generationCount` via workflow hook
- `generate()` passes `state.generationCount` to `engine.generateCurrentPose()`
- `generateCurrentPose()` passes count to `client.generateMultiple()` (already accepts `count` param)
- `GenerationGrid` renders `generationCount` placeholders/cards instead of hardcoded 4
- Error fallback creates `generationCount` error entries instead of hardcoded 4

### Files
- `WorkflowContext.tsx` — state + reducer action
- `useWorkflow.ts` — expose setter, pass count to engine
- `workflow.ts` — accept count param in `generateCurrentPose()`
- `ActionBar.tsx` — segmented button UI
- `GenerationGrid.tsx` — dynamic card count

## Feature 2: Copy Pose from Approved Sprite

### UI
- "Copy From..." button in `ActionBar.tsx`, visible when current pose is unapproved
- Opens a picker modal showing thumbnails of all approved sprites
- User clicks a sprite to copy it into the current pose slot

### Flow
- New action `COPY_POSE` in reducer
- Copied sprite gets: current pose's `poseId`/`poseName`, source's `imageData`/`mimeType`, fresh timestamp
- Prompt field stores "Copied from {sourcePoseName}"
- After copy, pose marked approved and workflow advances (same as normal approval)
- Database auto-save triggers like regular approval

### Files
- `WorkflowContext.tsx` — new `COPY_POSE` action
- `useWorkflow.ts` — new `copyFromSprite()` function
- `ActionBar.tsx` — button + trigger
- New `CopyPosePicker.tsx` component — modal with sprite thumbnails

## Feature 3: Horizontal Mirror Flip

### Utility
- New `flipImageHorizontal(base64, mimeType): Promise<{data, mimeType}>` in `imageUtils.ts`
- Uses offscreen canvas with `ctx.scale(-1, 1)` transform

### On generated options (pre-approval)
- Flip icon button on each `ImageCard`
- New reducer action `FLIP_OPTION` takes option index
- Replaces that option's image data with flipped version

### On approved sprites (post-approval)
- "Flip" button in `ActionBar.tsx` when viewing an approved pose
- New reducer action `FLIP_APPROVED`
- Flips approved sprite's image data and re-saves to database

### Files
- `imageUtils.ts` — new `flipImageHorizontal()` utility
- `WorkflowContext.tsx` — `FLIP_OPTION` + `FLIP_APPROVED` actions
- `useWorkflow.ts` — `flipOption()` + `flipApproved()` functions
- `ImageCard.tsx` — flip button on card
- `ActionBar.tsx` — flip button for approved poses

## Excluded (YAGNI)
- No vertical flip
- No undo for flip (flip again to restore)
- No cross-session copy (only within current workflow)
- Generation count not persisted to database (session-only)
