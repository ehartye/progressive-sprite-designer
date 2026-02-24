import { useCallback, useRef, useEffect } from 'react';
import { useWorkflowContext, ApprovedSprite, StatusMessage } from '../context/WorkflowContext';
import { WorkflowEngine } from '../lib/workflow';
import { GAME_TYPES, getTotalPoseCount, getTotalPoseCountFromHierarchy } from '../lib/poses';
import type { Phase } from '../lib/poses';
import { buildFullPrompt } from '../lib/prompts';
import { createGalleryEntry, addSpriteToGallery, removeSpriteFromGallery, fetchGalleryEntry, fetchHierarchy } from '../api/dataClient';

export function useWorkflow() {
  const { state, dispatch, engineRef, clientRef } = useWorkflowContext();
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

    const data = engine.approveSelected();
    if (!data) {
      setStatus('No image selected to approve.', 'warning');
      return;
    }

    const sprite: ApprovedSprite = {
      poseId: engine.getCurrentPose()?.id || '',
      poseName: data.poseName ?? 'Unknown',
      imageData: data.imageData,
      mimeType: data.mimeType,
      timestamp: data.timestamp,
      prompt: data.prompt,
      modelId: data.modelId,
      customInstructions: data.customInstructions,
      referenceImageIds: data.referenceImageIds,
    };

    dispatch({ type: 'POSE_APPROVED', sprite });

    // Auto-save to DB
    if (state.generationSetId) {
      try {
        await addSpriteToGallery(state.generationSetId, {
          poseId: sprite.poseId,
          poseName: sprite.poseName,
          imageData: sprite.imageData,
          mimeType: sprite.mimeType,
          prompt: sprite.prompt,
          modelId: sprite.modelId,
          customInstructions: sprite.customInstructions,
          referenceImageIds: sprite.referenceImageIds,
        });
      } catch (err) {
        console.warn('Failed to save sprite to gallery:', err);
      }
    }

    setStatus('Sprite approved!', 'success');
  }, [dispatch, engineRef, setStatus, state.generationSetId]);

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
  }, [dispatch, engineRef, state.characterConfig]);

  const jumpToPose = useCallback((phaseIndex: number, poseIndex: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.jumpToPose(phaseIndex, poseIndex);
    const prompt = buildPromptPreview(engine, state.characterConfig);
    dispatch({ type: 'POSE_NAVIGATED', phaseIndex, poseIndex, prompt });
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

    // Also remove from DB - we need to find the sprite ID
    // For simplicity, we accept this may not find the sprite (fire-and-forget)
    if (state.generationSetId) {
      try {
        const entry = await fetchGalleryEntry(state.generationSetId);
        const dbSprite = entry.sprites.find(s => s.poseId === poseId);
        if (dbSprite) {
          await removeSpriteFromGallery(state.generationSetId, dbSprite.id);
        }
      } catch { /* ignore */ }
    }

    setStatus('Sprite removed from approved.', 'info');
  }, [dispatch, engineRef, setStatus, state.generationSetId]);

  const setCustomInstructions = useCallback((text: string) => {
    dispatch({ type: 'SET_CUSTOM_INSTRUCTIONS', text });
  }, [dispatch]);

  const setCharacterConfig = useCallback((config: Partial<{ gameType: string; name: string; description: string; equipment: string; colorNotes: string }>) => {
    dispatch({ type: 'SET_CHARACTER_CONFIG', config });
  }, [dispatch]);

  // Resume workflow from a gallery entry
  const resumeFromGallery = useCallback(async (galleryId: number) => {
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

      // Restore approved sprites into the engine
      const approvedSprites: ApprovedSprite[] = [];
      for (const sprite of entry.sprites) {
        const spriteData = {
          imageData: sprite.imageData,
          mimeType: sprite.mimeType,
          poseName: sprite.poseName,
          timestamp: new Date(sprite.createdAt).getTime(),
          prompt: sprite.prompt,
          modelId: sprite.modelId,
          customInstructions: sprite.customInstructions,
          referenceImageIds: sprite.referenceImageIds,
        };
        engine.approvedSprites.set(sprite.poseId, spriteData);
        approvedSprites.push({ poseId: sprite.poseId, ...spriteData });
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

      setStatus(
        `Resumed "${entry.characterName}" — ${approvedSprites.length} sprite(s) loaded`,
        'success',
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resume';
      setStatus(`Resume failed: ${message}`, 'error');
    }
  }, [dispatch, clientRef, engineRef, setStatus]);

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
