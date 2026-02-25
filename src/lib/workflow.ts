import { getPoseHierarchy, getTotalPoseCountFromHierarchy, GAME_TYPES, Phase, Pose, SpriteSize } from './poses';
import { buildFullPrompt } from './prompts';

interface ImageData {
  data: string;
  mimeType: string;
}

interface GeneratedOption {
  image?: ImageData;
  error?: string;
}

interface ApprovedSpriteData {
  imageData: string;
  mimeType: string;
  poseName: string;
  timestamp: number;
  prompt: string;
  modelId: string;
  customInstructions: string;
  referenceImageIds: string[];
}

interface SpriteClient {
  generateImage(prompt: string, refs: ImageData[], seed?: number, aspectRatio?: string): Promise<GeneratedOption>;
  generateMultiple(prompt: string, refs: ImageData[], count: number, aspectRatio?: string): Promise<GeneratedOption[]>;
  getModelId(): string;
}

function computeAspectRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

interface CharacterConfig {
  name: string;
  description: string;
  equipment?: string;
  colorNotes?: string;
}

export class WorkflowEngine {
  client: SpriteClient;
  gameTypeId: string;
  hierarchy: Phase[];
  spriteSize: SpriteSize;

  currentPhaseIndex: number;
  currentPoseIndex: number;

  approvedSprites: Map<string, ApprovedSpriteData>;
  skippedPoses: Set<string>;

  generatedOptions: GeneratedOption[];
  selectedOptionIndex: number;
  lastPrompt: string;
  isGenerating: boolean;

  constructor(geminiClient: SpriteClient, gameTypeId: string, externalHierarchy?: Phase[]) {
    this.client = geminiClient;
    this.gameTypeId = gameTypeId;
    this.hierarchy = externalHierarchy ?? getPoseHierarchy(gameTypeId) ?? [];
    this.spriteSize = GAME_TYPES[gameTypeId]?.defaultSpriteSize ?? { w: 16, h: 24 };

    if (!this.hierarchy.length) {
      throw new Error(`Unknown game type: ${gameTypeId}`);
    }

    this.currentPhaseIndex = 0;
    this.currentPoseIndex = 0;

    this.approvedSprites = new Map();
    this.skippedPoses = new Set();

    this.generatedOptions = [];
    this.selectedOptionIndex = -1;
    this.lastPrompt = '';
    this.isGenerating = false;
  }

  // --- Accessors ---

  getCurrentPhase(): Phase | null {
    return this.hierarchy[this.currentPhaseIndex] ?? null;
  }

  getCurrentPose(): Pose | null {
    const phase = this.getCurrentPhase();
    return phase?.poses[this.currentPoseIndex] ?? null;
  }

  getApprovedSprites(): Array<ApprovedSpriteData & { poseId: string }> {
    return Array.from(this.approvedSprites.entries()).map(([poseId, data]) => ({
      poseId,
      ...data,
    }));
  }

  getApprovedImagesForReference(): ImageData[] {
    const refs: ImageData[] = [];
    const added = new Set<string>();

    // Never include the current pose as a reference to avoid self-bias
    const currentPoseId = this.getCurrentPose()?.id;

    const addRef = (poseId: string) => {
      if (added.has(poseId)) return;
      if (poseId === currentPoseId) return;
      const sprite = this.approvedSprites.get(poseId);
      if (!sprite) return;
      refs.push({ data: sprite.imageData, mimeType: sprite.mimeType });
      added.add(poseId);
    };

    // Always include the first pose (anchor/base idle) as a reference
    const anchorId = this.hierarchy[0]?.poses[0]?.id;
    if (anchorId) addRef(anchorId);

    // Include preceding approved poses from the current phase
    const phase = this.getCurrentPhase();
    if (phase) {
      for (let i = 0; i < this.currentPoseIndex; i++) {
        addRef(phase.poses[i].id);
      }
    }

    return refs;
  }

  // --- Generation ---

  async generateCurrentPose(characterConfig: CharacterConfig, customInstructions: string = ''): Promise<GeneratedOption[]> {
    const pose = this.getCurrentPose();
    if (!pose) throw new Error('No current pose');

    this.isGenerating = true;
    this.generatedOptions = [];
    this.selectedOptionIndex = -1;

    try {
      const refs = this.getApprovedImagesForReference();
      let prompt = buildFullPrompt(
        this.gameTypeId,
        this.spriteSize,
        characterConfig,
        pose,
        refs.length
      );

      if (customInstructions.trim()) {
        prompt += `\n\nAdditional instructions: ${customInstructions.trim()}`;
      }

      this.lastPrompt = prompt;
      const aspectRatio = computeAspectRatio(this.spriteSize.w, this.spriteSize.h);
      const results = await this.client.generateMultiple(prompt, refs, 4, aspectRatio);
      this.generatedOptions = results;
      return results;
    } finally {
      this.isGenerating = false;
    }
  }

  async regenerateOne(index: number, characterConfig: CharacterConfig, customInstructions: string = ''): Promise<GeneratedOption> {
    const pose = this.getCurrentPose();
    if (!pose) throw new Error('No current pose');

    const refs = this.getApprovedImagesForReference();
    let prompt = buildFullPrompt(
      this.gameTypeId,
      this.spriteSize,
      characterConfig,
      pose,
      refs.length
    );

    if (customInstructions.trim()) {
      prompt += `\n\nAdditional instructions: ${customInstructions.trim()}`;
    }

    this.lastPrompt = prompt;
    const aspectRatio = computeAspectRatio(this.spriteSize.w, this.spriteSize.h);

    try {
      const result = await this.client.generateImage(prompt, refs, undefined, aspectRatio);
      this.generatedOptions[index] = result;
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.generatedOptions[index] = { error: message };
      return { error: message };
    }
  }

  // --- Selection & Approval ---

  selectOption(index: number): GeneratedOption | null {
    this.selectedOptionIndex = index;
    return this.generatedOptions[index] ?? null;
  }

  approveSelected(): ApprovedSpriteData | null {
    if (this.selectedOptionIndex < 0) return null;
    const option = this.generatedOptions[this.selectedOptionIndex];
    if (!option?.image) return null;

    const pose = this.getCurrentPose();
    const data: ApprovedSpriteData = {
      imageData: option.image.data,
      mimeType: option.image.mimeType,
      poseName: pose?.name ?? 'Unknown',
      timestamp: Date.now(),
      prompt: this.lastPrompt,
      modelId: this.client.getModelId(),
      customInstructions: '',
      referenceImageIds: Array.from(this.approvedSprites.keys()),
    };

    this.approvedSprites.set(pose!.id, data);
    return data;
  }

  skipCurrentPose(): void {
    const pose = this.getCurrentPose();
    if (pose) this.skippedPoses.add(pose.id);
  }

  removeApproval(poseId: string): ApprovedSpriteData | null {
    const data = this.approvedSprites.get(poseId);
    this.approvedSprites.delete(poseId);
    return data ?? null;
  }

  // --- Navigation ---

  advanceToNextPose(): { phase: Phase | null; pose: Pose | null; done: boolean } {
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

  goToPreviousPose(): { phase: Phase; pose: Pose } {
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

  jumpToPose(phaseIndex: number, poseIndex: number): { phase: Phase; pose: Pose } | null {
    if (phaseIndex < 0 || phaseIndex >= this.hierarchy.length) return null;
    const phase = this.hierarchy[phaseIndex];
    if (poseIndex < 0 || poseIndex >= phase.poses.length) return null;

    this.currentPhaseIndex = phaseIndex;
    this.currentPoseIndex = poseIndex;
    this.generatedOptions = [];
    this.selectedOptionIndex = -1;
    return { phase, pose: phase.poses[poseIndex] };
  }

  // Advance to next unapproved pose from the very beginning (used for resume)
  advanceToNextUnapprovedPose(): { phase: Phase | null; pose: Pose | null; done: boolean } {
    for (let ph = 0; ph < this.hierarchy.length; ph++) {
      const phase = this.hierarchy[ph];
      for (let pi = 0; pi < phase.poses.length; pi++) {
        const pose = phase.poses[pi];
        if (!this.approvedSprites.has(pose.id) && !this.skippedPoses.has(pose.id)) {
          this.currentPhaseIndex = ph;
          this.currentPoseIndex = pi;
          this.generatedOptions = [];
          this.selectedOptionIndex = -1;
          return { phase, pose, done: false };
        }
      }
    }
    return { phase: null, pose: null, done: true };
  }

  // --- Progress ---

  getProgress(): { completed: number; total: number; approved: number; skipped: number } {
    const total = getTotalPoseCountFromHierarchy(this.hierarchy);
    return {
      completed: this.approvedSprites.size + this.skippedPoses.size,
      total,
      approved: this.approvedSprites.size,
      skipped: this.skippedPoses.size,
    };
  }

  isComplete(): boolean {
    const { completed, total } = this.getProgress();
    return completed >= total;
  }

  getLastPrompt(): string {
    return this.lastPrompt;
  }
}
