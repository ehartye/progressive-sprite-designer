import promptsData from '../data/prompts.json';

const SUPER_PROMPTS: Record<string, string> = promptsData.superPrompts;
const POSE_PROMPTS: Record<string, string> = promptsData.posePrompts;

export function buildSuperPrompt(gameTypeId: string, spriteSize: { w: number; h: number }): string {
  const template = SUPER_PROMPTS[gameTypeId];
  if (!template) throw new Error(`Unknown game type: ${gameTypeId}`);
  return template.replace('{w}', String(spriteSize.w)).replace('{h}', String(spriteSize.h));
}

export function buildCharacterPrompt(characterConfig: { name: string; description: string; equipment?: string; colorNotes?: string }): string {
  const { name, description, equipment, colorNotes } = characterConfig;
  let prompt = `The character is ${name}: ${description}.`;
  if (equipment) prompt += ` ${equipment}.`;
  if (colorNotes) prompt += ` ${colorNotes}.`;
  return prompt;
}

export function buildPosePrompt(pose: { id: string } | string): string {
  const poseId = typeof pose === 'string' ? pose : pose.id;
  const fragment = POSE_PROMPTS[poseId];
  if (!fragment) throw new Error(`No prompt fragment for pose: ${poseId}`);
  return fragment;
}

export function buildReferenceContext(approvedCount: number): string {
  if (!approvedCount || approvedCount <= 0) return '';
  return `I am providing ${approvedCount} reference image(s) of this same character in other poses. Maintain EXACT consistency with these references — same character design, same colors, same proportions, same pixel art style, same level of detail. The new sprite must look like it belongs on the same sprite sheet.`;
}

export function buildFullPrompt(
  gameTypeId: string,
  spriteSize: { w: number; h: number },
  characterConfig: { name: string; description: string; equipment?: string; colorNotes?: string },
  pose: { id: string } | string,
  approvedCount: number
): string {
  const parts = [buildSuperPrompt(gameTypeId, spriteSize), buildCharacterPrompt(characterConfig)];
  const refContext = buildReferenceContext(approvedCount);
  if (refContext) parts.push(refContext);
  parts.push(buildPosePrompt(pose));
  return parts.join('\n\n');
}

export function getPromptForPose(poseId: string): string {
  const fragment = POSE_PROMPTS[poseId];
  if (!fragment) throw new Error(`No prompt fragment for pose: ${poseId}`);
  return fragment;
}

export function getAvailablePoseIds(): string[] {
  return Object.keys(POSE_PROMPTS);
}
