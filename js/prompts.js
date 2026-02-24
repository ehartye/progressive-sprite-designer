/**
 * Prompt Engine Module
 *
 * Layered prompt builder for the Gemini image generation API.
 * Layers: Super Prompt -> Character Prompt -> Reference Context -> Pose Prompt
 */

// ---------------------------------------------------------------------------
// Super Prompt Templates (per game type)
// ---------------------------------------------------------------------------

const SUPER_PROMPTS = {
  TOP_DOWN_RPG: (w, h) =>
    `Generate a single 16-bit SNES-era pixel art character sprite. The sprite should be exactly ${w}x${h} pixels on a solid flat magenta (#FF00FF) background. Use a limited color palette of no more than 15 colors. The pixel art should be clean with no anti-aliasing, no sub-pixel rendering, and crisp pixel edges. The style should match classic Super Nintendo RPGs like Final Fantasy VI. This is one frame of a sprite sheet — generate ONLY the single sprite, centered in the image, with no duplicates, no sheet layout, no text labels.`,

  ACTION_RPG: (w, h) =>
    `Generate a single 16-bit SNES-era pixel art character sprite. The sprite should be approximately ${w}x${h} pixels on a solid flat magenta (#FF00FF) background. Use a limited color palette of no more than 20 colors. The pixel art should be detailed but clean, matching the style of Chrono Trigger or Secret of Mana. Slightly larger and more detailed than basic RPG sprites. Generate ONLY a single sprite, centered, no duplicates, no sheet, no labels.`,

  SIDE_SCROLLER: (w, h) =>
    `Generate a single 16-bit pixel art character sprite. The sprite should be approximately ${w}x${h} pixels on a solid flat magenta (#FF00FF) background. Use a limited color palette of no more than 20 colors. The style should match classic side-scrolling action games like Mega Man X or Castlevania. Generate ONLY a single sprite, centered, no duplicates, no sheet, no labels.`,

  CREATURE: (w, h) =>
    `Generate a single 16-bit SNES-era pixel art creature/enemy sprite on a solid flat magenta (#FF00FF) background. Use a limited color palette. The creature should be a single cohesive design suitable for a role-playing game. Generate ONLY a single sprite, centered, no duplicates, no sheet, no labels.`,
};

// ---------------------------------------------------------------------------
// Pose Prompt Fragments — keyed by pose ID
// ---------------------------------------------------------------------------

const POSE_PROMPTS = {
  // ===== TOP_DOWN_RPG poses =====

  // Phase 1 — Base Idle
  idle_front:
    'The character is standing still, facing directly toward the viewer (front view), in a relaxed neutral stance. Arms at sides or slightly ready.',

  // Phase 2 — Directional Idles
  idle_left:
    'The character is standing still, facing to the left (left profile view), in a relaxed neutral stance.',
  idle_right:
    'The character is standing still, facing to the right (right profile view), in a relaxed neutral stance.',
  idle_back:
    'The character is standing still, facing away from the viewer (back view), in a relaxed neutral stance.',

  // Phase 3 — Walk Cycles (4 directions x 3 frames)
  walk_down_1:
    'The character is mid-stride walking toward the viewer (front view), left foot forward. This is frame 1 of a walk cycle.',
  walk_down_2:
    'The character is walking toward the viewer (front view), feet together in a neutral mid-step position. This is frame 2 of a walk cycle.',
  walk_down_3:
    'The character is mid-stride walking toward the viewer (front view), right foot forward. This is frame 3 of a walk cycle.',

  walk_up_1:
    'The character is mid-stride walking away from the viewer (back view), left foot forward. This is frame 1 of a walk cycle.',
  walk_up_2:
    'The character is walking away from the viewer (back view), feet together in a neutral mid-step position. This is frame 2 of a walk cycle.',
  walk_up_3:
    'The character is mid-stride walking away from the viewer (back view), right foot forward. This is frame 3 of a walk cycle.',

  walk_left_1:
    'The character is mid-stride walking to the left (left profile view), left foot forward. This is frame 1 of a walk cycle.',
  walk_left_2:
    'The character is walking to the left (left profile view), feet together in a neutral mid-step position. This is frame 2 of a walk cycle.',
  walk_left_3:
    'The character is mid-stride walking to the left (left profile view), right foot forward. This is frame 3 of a walk cycle.',

  walk_right_1:
    'The character is mid-stride walking to the right (right profile view), left foot forward. This is frame 1 of a walk cycle.',
  walk_right_2:
    'The character is walking to the right (right profile view), feet together in a neutral mid-step position. This is frame 2 of a walk cycle.',
  walk_right_3:
    'The character is mid-stride walking to the right (right profile view), right foot forward. This is frame 3 of a walk cycle.',

  // Phase 4 — Battle Idle (side-view, 3 frames)
  battle_idle_1:
    'Side view. The character is in a battle-ready idle stance, weight centered, weapon at the ready. This is frame 1 of a battle idle animation.',
  battle_idle_2:
    'Side view. The character is in a battle-ready idle stance with a slight breathing motion, weapon at the ready. This is frame 2 of a battle idle animation.',
  battle_idle_3:
    'Side view. The character is in a battle-ready idle stance, returning to starting position. This is frame 3 of a battle idle animation.',

  // Phase 5 — Battle Attack (3 frames)
  battle_attack_1:
    'Side view. The character is winding up for an attack, pulling their weapon back. This is frame 1 of a 3-frame attack animation.',
  battle_attack_2:
    'Side view. The character is mid-swing attacking with their weapon, arm extended. This is frame 2 of a 3-frame attack animation.',
  battle_attack_3:
    'Side view. The character is in the follow-through of an attack, weapon extended past the target. This is frame 3 of a 3-frame attack animation.',

  // Phase 6 — Battle Cast/Magic (3 frames)
  battle_cast_1:
    'Side view. The character is beginning to cast a spell, raising their arms upward. This is frame 1 of a 3-frame casting animation.',
  battle_cast_2:
    'Side view. The character is actively casting, arms raised above their head with magical energy gathering. This is frame 2 of a 3-frame casting animation.',
  battle_cast_3:
    'Side view. The character is releasing the spell, arms thrust forward, magical energy flowing outward. This is frame 3 of a 3-frame casting animation.',

  // Phase 7 — Battle Damage (3 frames)
  battle_damage_1:
    'Side view. The character has just been hit, recoiling backward with a pained expression. This is frame 1 of a 3-frame damage animation.',
  battle_damage_2:
    'Side view. The character is staggering from the hit, leaning further back. This is frame 2 of a 3-frame damage animation.',
  battle_damage_3:
    'Side view. The character is recovering from the hit, returning toward a standing position. This is frame 3 of a 3-frame damage animation.',

  // Phase 8 — Battle KO/Dead (2 frames)
  battle_ko_1:
    'Side view. The character is collapsing, falling to one knee with eyes closed. This is frame 1 of a 2-frame KO animation.',
  battle_ko_2:
    'Side view. The character has fallen and is lying on the ground, defeated. This is frame 2 of a 2-frame KO animation.',

  // Phase 9 — Battle Victory (3 frames)
  battle_victory_1:
    'Side view. The character is beginning a victory celebration, raising a fist or weapon. This is frame 1 of a 3-frame victory animation.',
  battle_victory_2:
    'Side view. The character is celebrating victory with arms raised high in triumph. This is frame 2 of a 3-frame victory animation.',
  battle_victory_3:
    'Side view. The character is finishing their victory pose, smiling proudly. This is frame 3 of a 3-frame victory animation.',

  // Phase 10 — Emotes
  emote_surprise:
    'Front view. The character looks startled with wide eyes, a small exclamation mark effect above their head.',
  emote_sad:
    'Front view. The character looks sad and downcast, head slightly bowed, a small tear visible.',
  emote_laugh:
    'Front view. The character is laughing heartily, mouth open, body slightly bent forward in amusement.',

  // ===== ACTION_RPG poses =====

  // Phase 1 — Base Idle (shared: idle_front)
  // Phase 2 — Directional Idles (shared: idle_left, idle_right, idle_back)

  // Phase 3 — Walk Cycles (4 directions x 4 frames)
  walk_down_4:
    'The character is completing a walk stride toward the viewer (front view), returning to center. This is frame 4 of a walk cycle.',
  walk_up_4:
    'The character is completing a walk stride away from the viewer (back view), returning to center. This is frame 4 of a walk cycle.',
  walk_left_4:
    'The character is completing a walk stride to the left (left profile view), returning to center. This is frame 4 of a walk cycle.',
  walk_right_4:
    'The character is completing a walk stride to the right (right profile view), returning to center. This is frame 4 of a walk cycle.',

  // Phase 4 — Run Cycles (4 directions x 4 frames)
  run_down_1:
    'The character is running toward the viewer (front view), left foot forward in a long stride, body leaning forward. This is frame 1 of a run cycle.',
  run_down_2:
    'The character is running toward the viewer (front view), both feet close together mid-bounce. This is frame 2 of a run cycle.',
  run_down_3:
    'The character is running toward the viewer (front view), right foot forward in a long stride. This is frame 3 of a run cycle.',
  run_down_4:
    'The character is running toward the viewer (front view), both feet close together mid-bounce. This is frame 4 of a run cycle.',

  run_up_1:
    'The character is running away from the viewer (back view), left foot forward in a long stride, body leaning forward. This is frame 1 of a run cycle.',
  run_up_2:
    'The character is running away from the viewer (back view), both feet close together mid-bounce. This is frame 2 of a run cycle.',
  run_up_3:
    'The character is running away from the viewer (back view), right foot forward in a long stride. This is frame 3 of a run cycle.',
  run_up_4:
    'The character is running away from the viewer (back view), both feet close together mid-bounce. This is frame 4 of a run cycle.',

  run_left_1:
    'The character is running to the left (left profile view), left foot forward in a long stride, body leaning forward. This is frame 1 of a run cycle.',
  run_left_2:
    'The character is running to the left (left profile view), both feet close together mid-bounce. This is frame 2 of a run cycle.',
  run_left_3:
    'The character is running to the left (left profile view), right foot forward in a long stride. This is frame 3 of a run cycle.',
  run_left_4:
    'The character is running to the left (left profile view), both feet close together mid-bounce. This is frame 4 of a run cycle.',

  run_right_1:
    'The character is running to the right (right profile view), left foot forward in a long stride, body leaning forward. This is frame 1 of a run cycle.',
  run_right_2:
    'The character is running to the right (right profile view), both feet close together mid-bounce. This is frame 2 of a run cycle.',
  run_right_3:
    'The character is running to the right (right profile view), right foot forward in a long stride. This is frame 3 of a run cycle.',
  run_right_4:
    'The character is running to the right (right profile view), both feet close together mid-bounce. This is frame 4 of a run cycle.',

  // Phase 5 — Attack (4 directions x 3 frames)
  attack_down_1:
    'Front view. The character is winding up to attack, pulling their weapon back. This is frame 1 of a 3-frame attack animation.',
  attack_down_2:
    'Front view. The character is mid-swing, attacking with weapon extended. This is frame 2 of a 3-frame attack animation.',
  attack_down_3:
    'Front view. The character is in the follow-through of the attack. This is frame 3 of a 3-frame attack animation.',

  attack_up_1:
    'Back view. The character is winding up to attack, pulling their weapon back. This is frame 1 of a 3-frame attack animation.',
  attack_up_2:
    'Back view. The character is mid-swing, attacking with weapon extended. This is frame 2 of a 3-frame attack animation.',
  attack_up_3:
    'Back view. The character is in the follow-through of the attack. This is frame 3 of a 3-frame attack animation.',

  attack_left_1:
    'Left profile view. The character is winding up to attack, pulling their weapon back. This is frame 1 of a 3-frame attack animation.',
  attack_left_2:
    'Left profile view. The character is mid-swing, attacking with weapon extended. This is frame 2 of a 3-frame attack animation.',
  attack_left_3:
    'Left profile view. The character is in the follow-through of the attack. This is frame 3 of a 3-frame attack animation.',

  attack_right_1:
    'Right profile view. The character is winding up to attack, pulling their weapon back. This is frame 1 of a 3-frame attack animation.',
  attack_right_2:
    'Right profile view. The character is mid-swing, attacking with weapon extended. This is frame 2 of a 3-frame attack animation.',
  attack_right_3:
    'Right profile view. The character is in the follow-through of the attack. This is frame 3 of a 3-frame attack animation.',

  // Phase 6 — Cast/Tech Charge (3 frames)
  cast_charge_1:
    'Front view. The character is beginning to charge a tech or spell, crouching slightly with energy gathering around them. This is frame 1 of a 3-frame charge animation.',
  cast_charge_2:
    'Front view. The character is actively charging energy, arms raised with visible energy swirling around them. This is frame 2 of a 3-frame charge animation.',
  cast_charge_3:
    'Front view. The character is releasing the tech or spell, arms thrust outward with energy bursting forth. This is frame 3 of a 3-frame charge animation.',

  // Phase 7 — Damage + KO (4 frames)
  action_damage_1:
    'Front view. The character has been struck, recoiling backward with a pained expression. This is frame 1 of a 4-frame damage animation.',
  action_damage_2:
    'Front view. The character is staggering, nearly falling. This is frame 2 of a 4-frame damage animation.',
  action_ko_1:
    'Front view. The character is collapsing to the ground. This is frame 3 (KO frame 1) of a 4-frame damage/KO animation.',
  action_ko_2:
    'Front view. The character is lying on the ground, defeated. This is frame 4 (KO frame 2) of a 4-frame damage/KO animation.',

  // Phase 8 — Emotes
  emote_sit:
    'Front view. The character is sitting on the ground with legs crossed, in a relaxed resting position.',
  emote_sleep:
    'Side view. The character is lying down asleep with a small Zzz indicator, in a peaceful resting position.',

  // ===== SIDE_SCROLLER poses =====

  // Phase 1 — Base Idle (side-facing, 2 frames)
  side_idle_1:
    'Side view facing right. The character is standing in a ready idle pose, alert and balanced. This is frame 1 of a 2-frame idle animation.',
  side_idle_2:
    'Side view facing right. The character is in a slight breathing motion idle pose, nearly identical to frame 1 with subtle movement. This is frame 2 of a 2-frame idle animation.',

  // Phase 2 — Run Cycle (6 frames)
  side_run_1:
    'Side view facing right. The character is running, left foot striking the ground, arms in countermotion. This is frame 1 of a 6-frame run cycle.',
  side_run_2:
    'Side view facing right. The character is running, pushing off with left foot, body rising. This is frame 2 of a 6-frame run cycle.',
  side_run_3:
    'Side view facing right. The character is running, airborne between strides with both feet off the ground. This is frame 3 of a 6-frame run cycle.',
  side_run_4:
    'Side view facing right. The character is running, right foot striking the ground, arms in countermotion. This is frame 4 of a 6-frame run cycle.',
  side_run_5:
    'Side view facing right. The character is running, pushing off with right foot, body rising. This is frame 5 of a 6-frame run cycle.',
  side_run_6:
    'Side view facing right. The character is running, airborne between strides with both feet off the ground. This is frame 6 of a 6-frame run cycle.',

  // Phase 3 — Jump (2 frames)
  side_jump_rise:
    'Side view facing right. The character is jumping upward, legs tucked, arms up, at the peak of a rising jump arc.',
  side_jump_fall:
    'Side view facing right. The character is falling from a jump, legs extending downward, arms adjusting for landing.',

  // Phase 4 — Attack Standing (3 frames)
  side_attack_1:
    'Side view facing right. The character is winding up for a standing attack, weapon pulled back. This is frame 1 of a 3-frame attack animation.',
  side_attack_2:
    'Side view facing right. The character is mid-swing, weapon extended forward in an attack. This is frame 2 of a 3-frame attack animation.',
  side_attack_3:
    'Side view facing right. The character is in the follow-through of the attack, weapon extended past center. This is frame 3 of a 3-frame attack animation.',

  // Phase 5 — Attack Aerial (2 frames)
  side_aerial_attack_1:
    'Side view facing right. The character is in mid-air performing an aerial attack, weapon raised and body angled downward. This is frame 1 of a 2-frame aerial attack.',
  side_aerial_attack_2:
    'Side view facing right. The character is completing an aerial attack in mid-air, weapon slashing downward. This is frame 2 of a 2-frame aerial attack.',

  // Phase 6 — Crouch + Crouch Attack (3 frames)
  side_crouch:
    'Side view facing right. The character is crouching low, knees bent, compact posture, ready for action.',
  side_crouch_attack_1:
    'Side view facing right. The character is attacking from a crouched position, winding up. This is frame 1 of a 2-frame crouch attack.',
  side_crouch_attack_2:
    'Side view facing right. The character is attacking from a crouched position, weapon extended forward low. This is frame 2 of a 2-frame crouch attack.',

  // Phase 7 — Damage + Death (4 frames)
  side_damage_1:
    'Side view facing right. The character has been hit, recoiling backward with a flash effect. This is frame 1 of a damage animation.',
  side_damage_2:
    'Side view facing right. The character is staggering from damage, knocked back further. This is frame 2 of a damage animation.',
  side_death_1:
    'Side view facing right. The character is collapsing from defeat, falling to their knees. This is frame 1 of a 2-frame death animation.',
  side_death_2:
    'Side view facing right. The character has fallen to the ground in defeat, lying flat. This is frame 2 of a 2-frame death animation.',

  // Phase 8 — Climb/Ladder (2 frames)
  side_climb_1:
    'Front view. The character is climbing a ladder, left hand and right foot raised. This is frame 1 of a 2-frame climb animation.',
  side_climb_2:
    'Front view. The character is climbing a ladder, right hand and left foot raised. This is frame 2 of a 2-frame climb animation.',

  // ===== CREATURE poses =====

  // Phase 1 — Base Idle (2 frames)
  creature_idle_1:
    'Front view. The creature is in its neutral idle stance, body centered, alert. This is frame 1 of a 2-frame idle animation.',
  creature_idle_2:
    'Front view. The creature is in its idle stance with a subtle breathing or movement animation. This is frame 2 of a 2-frame idle animation.',

  // Phase 2 — Attack (3 frames)
  creature_attack_1:
    'Front view. The creature is winding up for an attack, rearing back or gathering energy. This is frame 1 of a 3-frame attack animation.',
  creature_attack_2:
    'Front view. The creature is mid-attack, lunging forward or striking with full force. This is frame 2 of a 3-frame attack animation.',
  creature_attack_3:
    'Front view. The creature is in the follow-through of its attack, returning toward rest. This is frame 3 of a 3-frame attack animation.',

  // Phase 3 — Damage (2 frames)
  creature_damage_1:
    'Front view. The creature has been struck, recoiling with a hit flash effect. This is frame 1 of a 2-frame damage animation.',
  creature_damage_2:
    'Front view. The creature is recovering from the hit, shaking off the blow. This is frame 2 of a 2-frame damage animation.',

  // Phase 4 — Death/Dissolve (3 frames)
  creature_death_1:
    'Front view. The creature is beginning to collapse or dissolve, body flickering. This is frame 1 of a 3-frame death animation.',
  creature_death_2:
    'Front view. The creature is mid-collapse, partially dissolved or broken apart. This is frame 2 of a 3-frame death animation.',
  creature_death_3:
    'Front view. The creature has fully collapsed or dissolved, only faint remnants remain. This is frame 3 of a 3-frame death animation.',

  // Phase 5 — Overworld Movement (4 directions x 3 frames, optional)
  creature_walk_down_1:
    'The creature is moving toward the viewer (front view), mid-stride. This is frame 1 of a 3-frame movement cycle.',
  creature_walk_down_2:
    'The creature is moving toward the viewer (front view), neutral mid-step. This is frame 2 of a 3-frame movement cycle.',
  creature_walk_down_3:
    'The creature is moving toward the viewer (front view), opposite stride. This is frame 3 of a 3-frame movement cycle.',

  creature_walk_up_1:
    'The creature is moving away from the viewer (back view), mid-stride. This is frame 1 of a 3-frame movement cycle.',
  creature_walk_up_2:
    'The creature is moving away from the viewer (back view), neutral mid-step. This is frame 2 of a 3-frame movement cycle.',
  creature_walk_up_3:
    'The creature is moving away from the viewer (back view), opposite stride. This is frame 3 of a 3-frame movement cycle.',

  creature_walk_left_1:
    'The creature is moving to the left (left profile view), mid-stride. This is frame 1 of a 3-frame movement cycle.',
  creature_walk_left_2:
    'The creature is moving to the left (left profile view), neutral mid-step. This is frame 2 of a 3-frame movement cycle.',
  creature_walk_left_3:
    'The creature is moving to the left (left profile view), opposite stride. This is frame 3 of a 3-frame movement cycle.',

  creature_walk_right_1:
    'The creature is moving to the right (right profile view), mid-stride. This is frame 1 of a 3-frame movement cycle.',
  creature_walk_right_2:
    'The creature is moving to the right (right profile view), neutral mid-step. This is frame 2 of a 3-frame movement cycle.',
  creature_walk_right_3:
    'The creature is moving to the right (right profile view), opposite stride. This is frame 3 of a 3-frame movement cycle.',
};

// ---------------------------------------------------------------------------
// Game type display names (for CREATURE template)
// ---------------------------------------------------------------------------

const GAME_TYPE_NAMES = {
  TOP_DOWN_RPG: 'top-down RPG',
  ACTION_RPG: 'action RPG',
  SIDE_SCROLLER: 'side-scrolling action',
  CREATURE: 'role-playing',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the super/system prompt for a given game type and sprite dimensions.
 * @param {string} gameTypeId - One of TOP_DOWN_RPG, ACTION_RPG, SIDE_SCROLLER, CREATURE
 * @param {{ w: number, h: number }} spriteSize
 * @returns {string}
 */
export function buildSuperPrompt(gameTypeId, spriteSize) {
  const builder = SUPER_PROMPTS[gameTypeId];
  if (!builder) {
    throw new Error(`Unknown game type: ${gameTypeId}`);
  }
  return builder(spriteSize.w, spriteSize.h);
}

/**
 * Build the character description prompt fragment.
 * @param {{ name: string, description: string, equipment?: string, colorNotes?: string }} characterConfig
 * @returns {string}
 */
export function buildCharacterPrompt(characterConfig) {
  const { name, description, equipment, colorNotes } = characterConfig;
  let prompt = `The character is ${name}: ${description}.`;
  if (equipment) {
    prompt += ` ${equipment}.`;
  }
  if (colorNotes) {
    prompt += ` ${colorNotes}.`;
  }
  return prompt;
}

/**
 * Build the pose-specific prompt fragment.
 * Accepts either a pose object (with an .id property) or a plain string ID.
 * @param {object|string} pose - Pose object from poses.js or a pose ID string
 * @returns {string}
 */
export function buildPosePrompt(pose) {
  const poseId = typeof pose === 'string' ? pose : pose.id;
  const fragment = POSE_PROMPTS[poseId];
  if (!fragment) {
    throw new Error(`No prompt fragment for pose: ${poseId}`);
  }
  return fragment;
}

/**
 * Build the reference image context string.
 * Returns an empty string when there are no approved references.
 * @param {number} approvedCount - Number of approved reference images
 * @returns {string}
 */
export function buildReferenceContext(approvedCount) {
  if (!approvedCount || approvedCount <= 0) {
    return '';
  }
  return `I am providing ${approvedCount} reference image(s) of this same character in other poses. Maintain EXACT consistency with these references — same character design, same colors, same proportions, same pixel art style, same level of detail. The new sprite must look like it belongs on the same sprite sheet.`;
}

/**
 * Combine all prompt layers into one complete prompt string.
 * Order: super prompt + character prompt + reference context (if any) + pose prompt
 * @param {string} gameTypeId
 * @param {{ w: number, h: number }} spriteSize
 * @param {{ name: string, description: string, equipment?: string, colorNotes?: string }} characterConfig
 * @param {object|string} pose
 * @param {number} approvedCount
 * @returns {string}
 */
export function buildFullPrompt(gameTypeId, spriteSize, characterConfig, pose, approvedCount) {
  const parts = [
    buildSuperPrompt(gameTypeId, spriteSize),
    buildCharacterPrompt(characterConfig),
  ];

  const refContext = buildReferenceContext(approvedCount);
  if (refContext) {
    parts.push(refContext);
  }

  parts.push(buildPosePrompt(pose));

  return parts.join('\n\n');
}

/**
 * Convenience lookup: given a pose ID and game type, returns the pose-specific
 * prompt text. The gameTypeId parameter is accepted for interface consistency
 * but the pose prompts are shared across game types (the same pose ID always
 * maps to the same description).
 * @param {string} poseId
 * @param {string} _gameTypeId - Currently unused; reserved for future per-type overrides
 * @returns {string}
 */
export function getPromptForPose(poseId, _gameTypeId) {
  const fragment = POSE_PROMPTS[poseId];
  if (!fragment) {
    throw new Error(`No prompt fragment for pose: ${poseId}`);
  }
  return fragment;
}

/**
 * Returns a list of all pose IDs that have prompt fragments defined.
 * Useful for validation against poses.js.
 * @returns {string[]}
 */
export function getAvailablePoseIds() {
  return Object.keys(POSE_PROMPTS);
}
