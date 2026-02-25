import { useCallback, useRef, useEffect } from 'react';
import { useWorkflowContext, ApprovedSprite, StatusMessage } from '../context/WorkflowContext';
import { WorkflowEngine } from '../lib/workflow';
import { GAME_TYPES, getTotalPoseCountFromHierarchy } from '../lib/poses';
import type { Phase } from '../lib/poses';
import { buildFullPrompt } from '../lib/prompts';
import { downsampleImage } from '../lib/imageUtils';
import { createGalleryEntry, addSpriteToGallery, removeSpriteFromGallery, fetchGalleryEntry, fetchHierarchy } from '../api/dataClient';

const STORED_MAX_DIM = 512;

export function useWorkflow() {
  const { state, dispatch, engineRef, clientRef, spriteDbIdsRef } = useWorkflowContext();
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-dismiss status for info/success
  useEffect(() => {
    if (state.status && (state.status.type === 'info' || state.status.type === 'success')) {
      statusTimerRef.current = setTimeout(() => dispatch({ type: 'CLEAR_STATUS' }), 5000);
      return () => clearTimeout(statusTimerRef.current);
    }
  }, [state.status, dispatch]);

  const setStatus = useCallback((message: string, type: StatusMessage['type'] = 'info') => {
    dispatch({ type: 'SET_STATUS', status: { message, type } });
  }, [dispatch]);

  const setModel = useCallback((model: string) => {
    clientRef.current.setModel(model);
    dispatch({ type: 'SET_MODEL', model });
  }, [dispatch, clientRef]);

  const testConnection = useCallback(async () => {
    setStatus('Testing connection...', 'info');
    try {
      const result = await clientRef.current.testConnection();
      if (result.success) {
        setStatus(`Connected to ${result.model}`, 'success');
      } else {
        setStatus(result.error || 'Connection failed', 'error');
      }
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Connection failed: ${message}`, 'error');
      return { success: false, error: message };
    }
  }, [clientRef, setStatus]);

  const startWorkflow = useCallback(async (config: { gameType: string; name: string; description: string; equipment: string; colorNotes: string }) => {
    if (!config.gameType || !config.name || !config.description) {
      setStatus('Please fill in all required fields.', 'warning');
      return;
    }

    dispatch({ type: 'SET_CHARACTER_CONFIG', config });

    // Fetch hierarchy from API (DB-backed)
    let hierarchy: Phase[];
    try {
      hierarchy = await fetchHierarchy(config.gameType);
    } catch {
      // Fallback to static data
      const engine = new WorkflowEngine(clientRef.current, config.gameType);
      hierarchy = engine.hierarchy;
    }

    const engine = new WorkflowEngine(clientRef.current, config.gameType, hierarchy);
    engineRef.current = engine;

    // Create gallery entry in DB
    let generationSetId: number | null = null;
    try {
      const result = await createGalleryEntry({
        characterName: config.name,
        gameType: config.gameType,
        description: config.description,
        equipment: config.equipment,
        colorNotes: config.colorNotes,
        model: state.model,
      });
      generationSetId = result.id;
    } catch (err) {
      console.warn('Failed to create gallery entry:', err);
    }

    dispatch({
      type: 'WORKFLOW_STARTED',
      hierarchy: engine.hierarchy,
      totalPoses: getTotalPoseCountFromHierarchy(engine.hierarchy),
      generationSetId,
    });

    // Build initial prompt preview
    const pose = engine.getCurrentPose();
    if (pose) {
      try {
        const prompt = buildFullPrompt(config.gameType, engine.spriteSize, config, pose, 0);
        dispatch({ type: 'POSE_NAVIGATED', phaseIndex: 0, poseIndex: 0, prompt });
      } catch {
        /* ignore prompt build errors on init */
      }
    }

    const gameTypeName = GAME_TYPES[config.gameType]?.name ?? config.gameType;
    setStatus(
      `Workflow started — ${gameTypeName} (${getTotalPoseCountFromHierarchy(engine.hierarchy)} poses)`,
      'success',
    );
  }, [dispatch, clientRef, engineRef, setStatus, state.model]);

  const generate = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || engine.isGenerating) return;

    dispatch({ type: 'GENERATE_START' });
    setStatus('Generating 4 options...', 'info');

    try {
      const results = await engine.generateCurrentPose(state.characterConfig, state.customInstructions);
      dispatch({ type: 'GENERATE_COMPLETE', results, prompt: engine.getLastPrompt() });

      const successCount = results.filter((r: { image?: unknown }) => r.image).length;
      if (successCount > 0) {
        setStatus(`Generated ${successCount} option(s). Click one to select.`, 'success');
      } else {
        setStatus('All generations failed. Try again or adjust your prompt.', 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      dispatch({
        type: 'GENERATE_COMPLETE',
        results: [{ error: message }, { error: 'Failed' }, { error: 'Failed' }, { error: 'Failed' }],
        prompt: engine.getLastPrompt(),
      });
      setStatus(`Generation failed: ${message}`, 'error');
    }
  }, [state.characterConfig, state.customInstructions, dispatch, engineRef, setStatus]);

  const selectImage = useCallback((index: number) => {
    const engine = engineRef.current;
    if (engine) engine.selectOption(index);
    dispatch({ type: 'IMAGE_SELECTED', index });
  }, [dispatch, engineRef]);

  const approve = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    // Capture pose identity before any async work to prevent race conditions
    // if the user navigates during the downsample await.
    const pose = engine.getCurrentPose();
    const poseId = pose?.id ?? '';

    const data = engine.approveSelected();
    if (!data) {
      setStatus('No image selected to approve.', 'warning');
      return;
    }

    // Downscale the approved image so stored sprites (and future references) are smaller
    const downsized = await downsampleImage(data.imageData, data.mimeType, STORED_MAX_DIM);
    data.imageData = downsized.data;
    data.mimeType = downsized.mimeType;
    // Also update the engine's copy so in-memory references stay small
    engine.approvedSprites.set(poseId, data);

    const sprite: ApprovedSprite = {
      poseId,
      poseName: data.poseName ?? 'Unknown',
      imageData: data.imageData,
      mimeType: data.mimeType,
      timestamp: data.timestamp,
      prompt: data.prompt,
      modelId: data.modelId,
      customInstructions: state.customInstructions,
      referenceImageIds: data.referenceImageIds,
    };

    dispatch({ type: 'POSE_APPROVED', sprite });

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
        // Cache the DB sprite ID to avoid fetching the full gallery on removal
        spriteDbIdsRef.current.set(sprite.poseId, result.id);
      } catch (err) {
        console.warn('Failed to save sprite to gallery:', err);
      }
    }

    setStatus('Sprite approved!', 'success');
  }, [dispatch, engineRef, setStatus, state.generationSetId, state.customInstructions, spriteDbIdsRef]);

  const skip = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const pose = engine.getCurrentPose();
    engine.skipCurrentPose();
    if (pose) dispatch({ type: 'POSE_SKIPPED', poseId: pose.id });

    const { done } = engine.advanceToNextPose();
    if (done) {
      dispatch({ type: 'WORKFLOW_COMPLETE' });
      setStatus(
        `Workflow complete! ${engine.getProgress().approved} sprites approved, ${engine.getProgress().skipped} skipped.`,
        'success',
      );
    } else {
      const prompt = buildPromptPreview(engine, state.characterConfig);
      dispatch({
        type: 'POSE_NAVIGATED',
        phaseIndex: engine.currentPhaseIndex,
        poseIndex: engine.currentPoseIndex,
        prompt,
      });
      setStatus('Pose skipped.', 'info');
    }
  }, [dispatch, engineRef, state.characterConfig, setStatus]);

  const nextPose = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const { done } = engine.advanceToNextPose();
    if (done) {
      if (engine.isComplete()) {
        // All poses approved/skipped — advance sequentially so user can browse
        let ph = engine.currentPhaseIndex;
        let pi = engine.currentPoseIndex + 1;
        if (pi >= engine.hierarchy[ph].poses.length) {
          ph++;
          pi = 0;
        }
        if (ph >= engine.hierarchy.length) {
          // Wrap to start
          ph = 0;
          pi = 0;
        }
        engine.jumpToPose(ph, pi);
        const prompt = buildPromptPreview(engine, state.characterConfig);
        dispatch({ type: 'POSE_NAVIGATED', phaseIndex: ph, poseIndex: pi, prompt });

        // Load the approved sprite into the generation slot
        const pose = engine.getCurrentPose();
        const approved = pose ? engine.approvedSprites.get(pose.id) : null;
        if (approved) {
          const result = { image: { data: approved.imageData, mimeType: approved.mimeType } };
          engine.generatedOptions = [result];
          engine.selectedOptionIndex = 0;
          dispatch({ type: 'GENERATE_COMPLETE', results: [result], prompt });
          dispatch({ type: 'IMAGE_SELECTED', index: 0 });
        }
      } else {
        // advanceToNextPose only scans forward — wrap around from the beginning
        // to find unapproved poses that may be before the current position
        const { done: reallyDone } = engine.advanceToNextUnapprovedPose();
        if (reallyDone) {
          dispatch({ type: 'WORKFLOW_COMPLETE' });
          setStatus(
            `Workflow complete! ${engine.getProgress().approved} sprites approved, ${engine.getProgress().skipped} skipped.`,
            'success',
          );
        } else {
          const prompt = buildPromptPreview(engine, state.characterConfig);
          dispatch({
            type: 'POSE_NAVIGATED',
            phaseIndex: engine.currentPhaseIndex,
            poseIndex: engine.currentPoseIndex,
            prompt,
          });
        }
      }
    } else {
      const prompt = buildPromptPreview(engine, state.characterConfig);
      dispatch({
        type: 'POSE_NAVIGATED',
        phaseIndex: engine.currentPhaseIndex,
        poseIndex: engine.currentPoseIndex,
        prompt,
      });
    }
  }, [dispatch, engineRef, state.characterConfig, setStatus]);

  const prevPose = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.goToPreviousPose();
    const prompt = buildPromptPreview(engine, state.characterConfig);
    dispatch({
      type: 'POSE_NAVIGATED',
      phaseIndex: engine.currentPhaseIndex,
      poseIndex: engine.currentPoseIndex,
      prompt,
    });

    // If navigating to an already-approved pose, show its sprite
    const pose = engine.getCurrentPose();
    const approved = pose ? engine.approvedSprites.get(pose.id) : null;
    if (approved) {
      const result = { image: { data: approved.imageData, mimeType: approved.mimeType } };
      engine.generatedOptions = [result];
      engine.selectedOptionIndex = 0;
      dispatch({ type: 'GENERATE_COMPLETE', results: [result], prompt });
      dispatch({ type: 'IMAGE_SELECTED', index: 0 });
    }
  }, [dispatch, engineRef, state.characterConfig]);

  const jumpToPose = useCallback((phaseIndex: number, poseIndex: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.jumpToPose(phaseIndex, poseIndex);
    const prompt = buildPromptPreview(engine, state.characterConfig);
    dispatch({ type: 'POSE_NAVIGATED', phaseIndex, poseIndex, prompt });

    // If navigating to an already-approved pose, show its sprite
    const pose = engine.getCurrentPose();
    const approved = pose ? engine.approvedSprites.get(pose.id) : null;
    if (approved) {
      const result = { image: { data: approved.imageData, mimeType: approved.mimeType } };
      engine.generatedOptions = [result];
      engine.selectedOptionIndex = 0;
      dispatch({ type: 'GENERATE_COMPLETE', results: [result], prompt });
      dispatch({ type: 'IMAGE_SELECTED', index: 0 });
    }
  }, [dispatch, engineRef, state.characterConfig]);

  const regenerateOne = useCallback(async (index: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    setStatus(`Regenerating option ${index + 1}...`, 'info');
    try {
      await engine.regenerateOne(index, state.characterConfig, state.customInstructions);
      dispatch({ type: 'GENERATE_COMPLETE', results: [...engine.generatedOptions], prompt: engine.getLastPrompt() });
      setStatus('Regenerated.', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Regeneration failed: ${message}`, 'error');
    }
  }, [state.characterConfig, state.customInstructions, dispatch, engineRef, setStatus]);

  const removeSprite = useCallback(async (poseId: string) => {
    const engine = engineRef.current;
    if (engine) engine.removeApproval(poseId);
    dispatch({ type: 'SPRITE_REMOVED', poseId });

    // Also remove from DB (fire-and-forget). Use cached sprite ID to avoid fetching
    // the full gallery entry (including base64 image data for every sprite).
    if (state.generationSetId) {
      const cachedId = spriteDbIdsRef.current.get(poseId);
      if (cachedId !== undefined) {
        spriteDbIdsRef.current.delete(poseId);
        removeSpriteFromGallery(state.generationSetId, cachedId).catch(() => { /* ignore */ });
      } else {
        // Fallback: locate the sprite ID via gallery entry if it wasn't cached
        fetchGalleryEntry(state.generationSetId).then(entry => {
          const dbSprite = entry.sprites.find(s => s.poseId === poseId);
          if (dbSprite) removeSpriteFromGallery(state.generationSetId!, dbSprite.id).catch(() => { /* ignore */ });
        }).catch(() => { /* ignore */ });
      }
    }

    setStatus('Sprite removed from approved.', 'info');
  }, [dispatch, engineRef, setStatus, state.generationSetId, spriteDbIdsRef]);

  const setCustomInstructions = useCallback((text: string) => {
    dispatch({ type: 'SET_CUSTOM_INSTRUCTIONS', text });
  }, [dispatch]);

  const setCharacterConfig = useCallback((config: Partial<{ gameType: string; name: string; description: string; equipment: string; colorNotes: string }>) => {
    dispatch({ type: 'SET_CHARACTER_CONFIG', config });
  }, [dispatch]);

  // Resume workflow from a gallery entry. Returns true on success, false on failure.
  const resumeFromGallery = useCallback(async (galleryId: number): Promise<boolean> => {
    try {
      setStatus('Loading gallery entry...', 'info');
      const entry = await fetchGalleryEntry(galleryId);

      const config = {
        gameType: entry.gameType,
        name: entry.characterName,
        description: entry.description,
        equipment: entry.equipment,
        colorNotes: entry.colorNotes,
      };
      dispatch({ type: 'SET_CHARACTER_CONFIG', config });

      if (entry.model) {
        clientRef.current.setModel(entry.model);
        dispatch({ type: 'SET_MODEL', model: entry.model });
      }

      // Fetch hierarchy from DB
      let hierarchy: Phase[];
      try {
        hierarchy = await fetchHierarchy(entry.gameType);
      } catch {
        const tempEngine = new WorkflowEngine(clientRef.current, entry.gameType);
        hierarchy = tempEngine.hierarchy;
      }

      const engine = new WorkflowEngine(clientRef.current, entry.gameType, hierarchy);
      engineRef.current = engine;

      // Restore approved sprites into the engine, downscaling legacy full-res images
      const approvedSprites: ApprovedSprite[] = [];
      spriteDbIdsRef.current.clear();
      const downsized = await Promise.all(
        entry.sprites.map(sprite => downsampleImage(sprite.imageData, sprite.mimeType, STORED_MAX_DIM))
      );
      for (let idx = 0; idx < entry.sprites.length; idx++) {
        const sprite = entry.sprites[idx];
        const img = downsized[idx];
        const spriteData = {
          imageData: img.data,
          mimeType: img.mimeType,
          poseName: sprite.poseName,
          timestamp: new Date(sprite.createdAt).getTime(),
          prompt: sprite.prompt,
          modelId: sprite.modelId,
          customInstructions: sprite.customInstructions,
          referenceImageIds: sprite.referenceImageIds,
        };
        engine.approvedSprites.set(sprite.poseId, spriteData);
        approvedSprites.push({ poseId: sprite.poseId, ...spriteData });
        spriteDbIdsRef.current.set(sprite.poseId, sprite.id);
      }

      dispatch({
        type: 'WORKFLOW_STARTED',
        hierarchy: engine.hierarchy,
        totalPoses: getTotalPoseCountFromHierarchy(engine.hierarchy),
        generationSetId: galleryId,
      });

      // Sync approved sprites into state
      dispatch({ type: 'SYNC_ENGINE', approvedSprites, skippedPoseIds: [] });

      // Navigate to the first unapproved pose
      const { done } = engine.advanceToNextUnapprovedPose();
      if (done) {
        // All poses approved, go to first pose
        engine.jumpToPose(0, 0);
      }

      const prompt = buildPromptPreview(engine, config);
      dispatch({
        type: 'POSE_NAVIGATED',
        phaseIndex: engine.currentPhaseIndex,
        poseIndex: engine.currentPoseIndex,
        prompt,
      });

      // If all complete, show the current pose's approved sprite in the first slot
      if (done) {
        const pose = engine.getCurrentPose();
        const approved = pose ? engine.approvedSprites.get(pose.id) : null;
        if (approved) {
          const result = { image: { data: approved.imageData, mimeType: approved.mimeType } };
          engine.generatedOptions = [result];
          engine.selectedOptionIndex = 0;
          dispatch({ type: 'GENERATE_COMPLETE', results: [result], prompt });
          dispatch({ type: 'IMAGE_SELECTED', index: 0 });
        }
      }

      setStatus(
        `Resumed "${entry.characterName}" — ${approvedSprites.length} sprite(s) loaded`,
        'success',
      );
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resume';
      setStatus(`Resume failed: ${message}`, 'error');
      return false;
    }
  }, [dispatch, clientRef, engineRef, setStatus, spriteDbIdsRef]);

  const resetWorkflow = useCallback(() => {
    engineRef.current = null;
    dispatch({ type: 'WORKFLOW_RESET' });
  }, [dispatch, engineRef]);

  return {
    state,
    setModel,
    testConnection,
    startWorkflow,
    generate,
    selectImage,
    approve,
    skip,
    nextPose,
    prevPose,
    jumpToPose,
    regenerateOne,
    removeSprite,
    setCustomInstructions,
    setCharacterConfig,
    setStatus,
    resumeFromGallery,
    resetWorkflow,
  };
}

function buildPromptPreview(
  engine: WorkflowEngine,
  characterConfig: { name: string; description: string; equipment?: string; colorNotes?: string },
): string {
  const pose = engine.getCurrentPose();
  if (!pose) return '';
  try {
    return buildFullPrompt(engine.gameTypeId, engine.spriteSize, characterConfig, pose, engine.approvedSprites.size);
  } catch {
    return '(prompt preview unavailable)';
  }
}
