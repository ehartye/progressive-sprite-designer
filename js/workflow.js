/**
 * Workflow Engine for Progressive Sprite Designer.
 * Manages the progressive generation state machine.
 */

import { getPoseHierarchy, getTotalPoseCount, GAME_TYPES } from './poses.js';
import { buildFullPrompt } from './prompts.js';

export class WorkflowEngine {
  /**
   * @param {import('./api.js').default} geminiClient
   * @param {string} gameTypeId
   */
  constructor(geminiClient, gameTypeId) {
    this.client = geminiClient;
    this.gameTypeId = gameTypeId;
    this.hierarchy = getPoseHierarchy(gameTypeId);
    this.spriteSize = GAME_TYPES[gameTypeId]?.defaultSpriteSize ?? { w: 16, h: 24 };

    if (!this.hierarchy) {
      throw new Error(`Unknown game type: ${gameTypeId}`);
    }

    this.currentPhaseIndex = 0;
    this.currentPoseIndex = 0;

    /** @type {Map<string, {imageData:string, mimeType:string, timestamp:number, prompt:string, modelId:string, customInstructions:string, referenceImageIds:string[]}>} */
    this.approvedSprites = new Map();
    /** @type {Set<string>} */
    this.skippedPoses = new Set();

    this.generatedOptions = [];
    this.selectedOptionIndex = -1;
    this.lastPrompt = '';
    this.isGenerating = false;
  }

  // --- Accessors ---

  getCurrentPhase() {
    return this.hierarchy[this.currentPhaseIndex] ?? null;
  }

  getCurrentPose() {
    const phase = this.getCurrentPhase();
    return phase?.poses[this.currentPoseIndex] ?? null;
  }

  getApprovedSprites() {
    return Array.from(this.approvedSprites.entries()).map(([poseId, data]) => ({
      poseId,
      poseName: data.poseName ?? poseId,
      imageData: data.imageData,
      mimeType: data.mimeType,
      timestamp: data.timestamp,
      prompt: data.prompt,
      modelId: data.modelId,
      customInstructions: data.customInstructions,
      referenceImageIds: data.referenceImageIds,
    }));
  }

  getApprovedImagesForReference() {
    return Array.from(this.approvedSprites.values()).map(s => ({
      data: s.imageData,
      mimeType: s.mimeType,
    }));
  }

  // --- Generation ---

  /**
   * Generate images for the current pose.
   * @param {{name:string, description:string, equipment?:string, colorNotes?:string}} characterConfig
   * @param {string} customInstructions
   * @returns {Promise<Array>}
   */
  async generateCurrentPose(characterConfig, customInstructions = '') {
    const pose = this.getCurrentPose();
    if (!pose) throw new Error('No current pose');

    this.isGenerating = true;
    this.generatedOptions = [];
    this.selectedOptionIndex = -1;

    try {
      let prompt = buildFullPrompt(
        this.gameTypeId,
        this.spriteSize,
        characterConfig,
        pose,
        this.approvedSprites.size
      );

      if (customInstructions.trim()) {
        prompt += `\n\nAdditional instructions: ${customInstructions.trim()}`;
      }

      this.lastPrompt = prompt;
      const refs = this.getApprovedImagesForReference();
      const results = await this.client.generateMultiple(prompt, refs, 4);
      this.generatedOptions = results;
      return results;
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Regenerate a single slot.
   */
  async regenerateOne(index, characterConfig, customInstructions = '') {
    const pose = this.getCurrentPose();
    if (!pose) throw new Error('No current pose');

    let prompt = buildFullPrompt(
      this.gameTypeId,
      this.spriteSize,
      characterConfig,
      pose,
      this.approvedSprites.size
    );

    if (customInstructions.trim()) {
      prompt += `\n\nAdditional instructions: ${customInstructions.trim()}`;
    }

    this.lastPrompt = prompt;
    const refs = this.getApprovedImagesForReference();

    try {
      const result = await this.client.generateImage(prompt, refs);
      this.generatedOptions[index] = result;
      return result;
    } catch (err) {
      this.generatedOptions[index] = { error: err.message };
      return { error: err.message };
    }
  }

  // --- Selection & Approval ---

  selectOption(index) {
    this.selectedOptionIndex = index;
    return this.generatedOptions[index] ?? null;
  }

  approveSelected() {
    if (this.selectedOptionIndex < 0) return null;
    const option = this.generatedOptions[this.selectedOptionIndex];
    if (!option?.image) return null;

    const pose = this.getCurrentPose();
    const data = {
      imageData: option.image.data,
      mimeType: option.image.mimeType,
      poseName: pose?.name ?? 'Unknown',
      timestamp: Date.now(),
      prompt: this.lastPrompt,
      modelId: this.client.getModelId(),
      customInstructions: '',
      referenceImageIds: Array.from(this.approvedSprites.keys()),
    };

    this.approvedSprites.set(pose.id, data);
    return data;
  }

  skipCurrentPose() {
    const pose = this.getCurrentPose();
    if (pose) this.skippedPoses.add(pose.id);
  }

  removeApproval(poseId) {
    const data = this.approvedSprites.get(poseId);
    this.approvedSprites.delete(poseId);
    return data ?? null;
  }

  // --- Navigation ---

  advanceToNextPose() {
    let pi = this.currentPoseIndex;
    let ph = this.currentPhaseIndex;

    while (ph < this.hierarchy.length) {
      const phase = this.hierarchy[ph];
      pi++;

      if (pi >= phase.poses.length) {
        ph++;
        pi = 0;
        if (ph >= this.hierarchy.length) {
          return { phase: null, pose: null, done: true };
        }
      }

      const pose = this.hierarchy[ph].poses[pi];
      if (!this.approvedSprites.has(pose.id) && !this.skippedPoses.has(pose.id)) {
        this.currentPhaseIndex = ph;
        this.currentPoseIndex = pi;
        this.generatedOptions = [];
        this.selectedOptionIndex = -1;
        return { phase: this.hierarchy[ph], pose, done: false };
      }
    }

    return { phase: null, pose: null, done: true };
  }

  goToPreviousPose() {
    let pi = this.currentPoseIndex;
    let ph = this.currentPhaseIndex;

    pi--;
    if (pi < 0) {
      ph--;
      if (ph < 0) {
        ph = 0;
        pi = 0;
      } else {
        pi = this.hierarchy[ph].poses.length - 1;
      }
    }

    this.currentPhaseIndex = ph;
    this.currentPoseIndex = pi;
    this.generatedOptions = [];
    this.selectedOptionIndex = -1;
    return { phase: this.hierarchy[ph], pose: this.hierarchy[ph].poses[pi] };
  }

  jumpToPose(phaseIndex, poseIndex) {
    if (phaseIndex < 0 || phaseIndex >= this.hierarchy.length) return null;
    const phase = this.hierarchy[phaseIndex];
    if (poseIndex < 0 || poseIndex >= phase.poses.length) return null;

    this.currentPhaseIndex = phaseIndex;
    this.currentPoseIndex = poseIndex;
    this.generatedOptions = [];
    this.selectedOptionIndex = -1;
    return { phase, pose: phase.poses[poseIndex] };
  }

  // --- Progress ---

  getProgress() {
    const total = getTotalPoseCount(this.gameTypeId);
    return {
      completed: this.approvedSprites.size + this.skippedPoses.size,
      total,
      approved: this.approvedSprites.size,
      skipped: this.skippedPoses.size,
    };
  }

  isComplete() {
    const { completed, total } = this.getProgress();
    return completed >= total;
  }

  getLastPrompt() {
    return this.lastPrompt;
  }
}
