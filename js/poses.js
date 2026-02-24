/**
 * Pose hierarchy definitions for the Progressive Sprite Designer.
 * IDs match prompts.js exactly for seamless prompt lookup.
 */

export const GAME_TYPES = {
  TOP_DOWN_RPG: {
    id: 'TOP_DOWN_RPG',
    name: 'Top-Down RPG',
    description: 'Classic FF6 / RPG Maker style with 4-directional movement and separate battle scenes',
    defaultSpriteSize: { w: 16, h: 24 }
  },
  ACTION_RPG: {
    id: 'ACTION_RPG',
    name: 'Action RPG',
    description: 'Chrono Trigger style with real-time combat on the overworld map',
    defaultSpriteSize: { w: 16, h: 24 }
  },
  SIDE_SCROLLER: {
    id: 'SIDE_SCROLLER',
    name: 'Side-Scroller',
    description: 'Mega Man X style platformer with fluid run-and-gun action',
    defaultSpriteSize: { w: 24, h: 32 }
  },
  CREATURE: {
    id: 'CREATURE',
    name: 'Creature / NPC',
    description: 'Enemies, bosses, or NPCs with variable dimensions',
    defaultSpriteSize: { w: 16, h: 16 }
  }
};

function p(id, name, desc, dir, group, frame, size, required = true) {
  return { id, name, description: desc, direction: dir, animGroup: group, frameIndex: frame, spriteSize: size, required };
}

const S16 = { w: 16, h: 24 };
const S24 = { w: 24, h: 32 };
const S16C = { w: 16, h: 16 };

// ---------------------------------------------------------------------------
// TOP_DOWN_RPG
// ---------------------------------------------------------------------------
const TOP_DOWN_RPG_PHASES = [
  {
    id: 'base_idle', name: 'Base Idle',
    description: 'The foundation pose — all other poses derive from this',
    dependsOn: null, required: true,
    poses: [
      p('idle_front', 'Front-Facing Idle', 'Standing facing viewer, relaxed', 'down', 'idle', 0, S16),
    ]
  },
  {
    id: 'directional_idles', name: 'Directional Idles',
    description: 'Idle poses for every cardinal direction',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('idle_left', 'Left-Facing Idle', 'Standing facing left', 'left', 'idle', 0, S16),
      p('idle_right', 'Right-Facing Idle', 'Standing facing right', 'right', 'idle', 0, S16),
      p('idle_back', 'Back-Facing Idle', 'Standing facing away', 'up', 'idle', 0, S16),
    ]
  },
  {
    id: 'walk_cycles', name: 'Walk Cycles',
    description: '4-directional walk animations (3 frames each)',
    dependsOn: 'directional_idles', required: true,
    poses: [
      p('walk_down_1', 'Walk Down – Left Step', 'Walking toward viewer, left foot forward', 'down', 'walk_down', 0, S16),
      p('walk_down_2', 'Walk Down – Passing', 'Walking toward viewer, feet together', 'down', 'walk_down', 1, S16),
      p('walk_down_3', 'Walk Down – Right Step', 'Walking toward viewer, right foot forward', 'down', 'walk_down', 2, S16),
      p('walk_up_1', 'Walk Up – Left Step', 'Walking away, left foot forward', 'up', 'walk_up', 0, S16),
      p('walk_up_2', 'Walk Up – Passing', 'Walking away, feet together', 'up', 'walk_up', 1, S16),
      p('walk_up_3', 'Walk Up – Right Step', 'Walking away, right foot forward', 'up', 'walk_up', 2, S16),
      p('walk_left_1', 'Walk Left – Left Step', 'Walking left, left foot forward', 'left', 'walk_left', 0, S16),
      p('walk_left_2', 'Walk Left – Passing', 'Walking left, feet together', 'left', 'walk_left', 1, S16),
      p('walk_left_3', 'Walk Left – Right Step', 'Walking left, right foot forward', 'left', 'walk_left', 2, S16),
      p('walk_right_1', 'Walk Right – Left Step', 'Walking right, left foot forward', 'right', 'walk_right', 0, S16),
      p('walk_right_2', 'Walk Right – Passing', 'Walking right, feet together', 'right', 'walk_right', 1, S16),
      p('walk_right_3', 'Walk Right – Right Step', 'Walking right, right foot forward', 'right', 'walk_right', 2, S16),
    ]
  },
  {
    id: 'battle_idle', name: 'Battle Idle',
    description: 'Side-view battle stance animation (3 frames)',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('battle_idle_1', 'Battle Idle 1', 'Side-view battle stance, neutral', 'side', 'battle_idle', 0, S16),
      p('battle_idle_2', 'Battle Idle 2', 'Side-view battle stance, breathing', 'side', 'battle_idle', 1, S16),
      p('battle_idle_3', 'Battle Idle 3', 'Side-view battle stance, returning', 'side', 'battle_idle', 2, S16),
    ]
  },
  {
    id: 'battle_attack', name: 'Battle Attack',
    description: 'Melee attack in battle (3 frames)',
    dependsOn: 'battle_idle', required: true,
    poses: [
      p('battle_attack_1', 'Battle Attack – Windup', 'Pulling back to strike', 'side', 'battle_attack', 0, S16),
      p('battle_attack_2', 'Battle Attack – Strike', 'Full swing forward', 'side', 'battle_attack', 1, S16),
      p('battle_attack_3', 'Battle Attack – Follow-through', 'Recovering from swing', 'side', 'battle_attack', 2, S16),
    ]
  },
  {
    id: 'battle_cast', name: 'Battle Cast / Magic',
    description: 'Spellcasting in battle (3 frames)',
    dependsOn: 'battle_idle', required: false,
    poses: [
      p('battle_cast_1', 'Battle Cast – Charge', 'Gathering magic', 'side', 'battle_cast', 0, S16, false),
      p('battle_cast_2', 'Battle Cast – Release', 'Releasing spell', 'side', 'battle_cast', 1, S16, false),
      p('battle_cast_3', 'Battle Cast – Recover', 'Recovering', 'side', 'battle_cast', 2, S16, false),
    ]
  },
  {
    id: 'battle_damage', name: 'Battle Damage',
    description: 'Taking damage in battle (3 frames)',
    dependsOn: 'battle_idle', required: true,
    poses: [
      p('battle_damage_1', 'Battle Damage – Impact', 'Recoiling from hit', 'side', 'battle_damage', 0, S16),
      p('battle_damage_2', 'Battle Damage – Stagger', 'Staggering backward', 'side', 'battle_damage', 1, S16),
      p('battle_damage_3', 'Battle Damage – Recover', 'Regaining footing', 'side', 'battle_damage', 2, S16),
    ]
  },
  {
    id: 'battle_ko', name: 'Battle KO / Dead',
    description: 'Knocked out in battle (2 frames)',
    dependsOn: 'battle_damage', required: true,
    poses: [
      p('battle_ko_1', 'Battle KO – Collapsing', 'Falling to ground', 'side', 'battle_ko', 0, S16),
      p('battle_ko_2', 'Battle KO – Down', 'Lying defeated', 'side', 'battle_ko', 1, S16),
    ]
  },
  {
    id: 'battle_victory', name: 'Battle Victory',
    description: 'Victory celebration (3 frames)',
    dependsOn: 'battle_idle', required: false,
    poses: [
      p('battle_victory_1', 'Victory – Raise', 'Raising weapon/fist', 'side', 'battle_victory', 0, S16, false),
      p('battle_victory_2', 'Victory – Pose', 'Holding pose', 'side', 'battle_victory', 1, S16, false),
      p('battle_victory_3', 'Victory – Settle', 'Relaxing', 'side', 'battle_victory', 2, S16, false),
    ]
  },
  {
    id: 'emotes', name: 'Emotes',
    description: 'Expressive single-frame emote poses',
    dependsOn: 'base_idle', required: false,
    poses: [
      p('emote_surprise', 'Surprise', 'Startled, arms raised', 'down', 'emotes', 0, S16, false),
      p('emote_sad', 'Sad', 'Downcast, head bowed', 'down', 'emotes', 1, S16, false),
      p('emote_laugh', 'Laugh', 'Joyful, leaning back', 'down', 'emotes', 2, S16, false),
    ]
  }
];

// ---------------------------------------------------------------------------
// ACTION_RPG
// ---------------------------------------------------------------------------
const ACTION_RPG_PHASES = [
  {
    id: 'base_idle', name: 'Base Idle',
    description: 'The foundation pose',
    dependsOn: null, required: true,
    poses: [
      p('idle_front', 'Front-Facing Idle', 'Standing facing viewer, relaxed', 'down', 'idle', 0, S16),
    ]
  },
  {
    id: 'directional_idles', name: 'Directional Idles',
    description: 'Idle for every direction',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('idle_left', 'Left-Facing Idle', 'Standing facing left', 'left', 'idle', 0, S16),
      p('idle_right', 'Right-Facing Idle', 'Standing facing right', 'right', 'idle', 0, S16),
      p('idle_back', 'Back-Facing Idle', 'Standing facing away', 'up', 'idle', 0, S16),
    ]
  },
  {
    id: 'walk_cycles', name: 'Walk Cycles',
    description: '4-directional walk (4 frames each)',
    dependsOn: 'directional_idles', required: true,
    poses: [
      p('walk_down_1', 'Walk Down 1', 'Toward viewer, left foot', 'down', 'walk_down', 0, S16),
      p('walk_down_2', 'Walk Down 2', 'Toward viewer, passing', 'down', 'walk_down', 1, S16),
      p('walk_down_3', 'Walk Down 3', 'Toward viewer, right foot', 'down', 'walk_down', 2, S16),
      p('walk_down_4', 'Walk Down 4', 'Toward viewer, returning', 'down', 'walk_down', 3, S16),
      p('walk_left_1', 'Walk Left 1', 'Left, left foot', 'left', 'walk_left', 0, S16),
      p('walk_left_2', 'Walk Left 2', 'Left, passing', 'left', 'walk_left', 1, S16),
      p('walk_left_3', 'Walk Left 3', 'Left, right foot', 'left', 'walk_left', 2, S16),
      p('walk_left_4', 'Walk Left 4', 'Left, returning', 'left', 'walk_left', 3, S16),
      p('walk_right_1', 'Walk Right 1', 'Right, left foot', 'right', 'walk_right', 0, S16),
      p('walk_right_2', 'Walk Right 2', 'Right, passing', 'right', 'walk_right', 1, S16),
      p('walk_right_3', 'Walk Right 3', 'Right, right foot', 'right', 'walk_right', 2, S16),
      p('walk_right_4', 'Walk Right 4', 'Right, returning', 'right', 'walk_right', 3, S16),
      p('walk_up_1', 'Walk Up 1', 'Away, left foot', 'up', 'walk_up', 0, S16),
      p('walk_up_2', 'Walk Up 2', 'Away, passing', 'up', 'walk_up', 1, S16),
      p('walk_up_3', 'Walk Up 3', 'Away, right foot', 'up', 'walk_up', 2, S16),
      p('walk_up_4', 'Walk Up 4', 'Away, returning', 'up', 'walk_up', 3, S16),
    ]
  },
  {
    id: 'run_cycles', name: 'Run Cycles',
    description: '4-directional run (4 frames each)',
    dependsOn: 'walk_cycles', required: true,
    poses: [
      p('run_down_1', 'Run Down 1', 'Toward viewer, push off', 'down', 'run_down', 0, S16),
      p('run_down_2', 'Run Down 2', 'Toward viewer, airborne', 'down', 'run_down', 1, S16),
      p('run_down_3', 'Run Down 3', 'Toward viewer, landing', 'down', 'run_down', 2, S16),
      p('run_down_4', 'Run Down 4', 'Toward viewer, recovery', 'down', 'run_down', 3, S16),
      p('run_left_1', 'Run Left 1', 'Left, push off', 'left', 'run_left', 0, S16),
      p('run_left_2', 'Run Left 2', 'Left, airborne', 'left', 'run_left', 1, S16),
      p('run_left_3', 'Run Left 3', 'Left, landing', 'left', 'run_left', 2, S16),
      p('run_left_4', 'Run Left 4', 'Left, recovery', 'left', 'run_left', 3, S16),
      p('run_right_1', 'Run Right 1', 'Right, push off', 'right', 'run_right', 0, S16),
      p('run_right_2', 'Run Right 2', 'Right, airborne', 'right', 'run_right', 1, S16),
      p('run_right_3', 'Run Right 3', 'Right, landing', 'right', 'run_right', 2, S16),
      p('run_right_4', 'Run Right 4', 'Right, recovery', 'right', 'run_right', 3, S16),
      p('run_up_1', 'Run Up 1', 'Away, push off', 'up', 'run_up', 0, S16),
      p('run_up_2', 'Run Up 2', 'Away, airborne', 'up', 'run_up', 1, S16),
      p('run_up_3', 'Run Up 3', 'Away, landing', 'up', 'run_up', 2, S16),
      p('run_up_4', 'Run Up 4', 'Away, recovery', 'up', 'run_up', 3, S16),
    ]
  },
  {
    id: 'attack', name: 'Attack',
    description: '4-directional attack (3 frames each)',
    dependsOn: 'directional_idles', required: true,
    poses: [
      p('attack_down_1', 'Attack Down – Windup', 'Facing viewer, pulling back', 'down', 'attack_down', 0, S16),
      p('attack_down_2', 'Attack Down – Strike', 'Facing viewer, swinging', 'down', 'attack_down', 1, S16),
      p('attack_down_3', 'Attack Down – Follow', 'Facing viewer, recovering', 'down', 'attack_down', 2, S16),
      p('attack_left_1', 'Attack Left – Windup', 'Facing left, pulling back', 'left', 'attack_left', 0, S16),
      p('attack_left_2', 'Attack Left – Strike', 'Facing left, swinging', 'left', 'attack_left', 1, S16),
      p('attack_left_3', 'Attack Left – Follow', 'Facing left, recovering', 'left', 'attack_left', 2, S16),
      p('attack_right_1', 'Attack Right – Windup', 'Facing right, pulling back', 'right', 'attack_right', 0, S16),
      p('attack_right_2', 'Attack Right – Strike', 'Facing right, swinging', 'right', 'attack_right', 1, S16),
      p('attack_right_3', 'Attack Right – Follow', 'Facing right, recovering', 'right', 'attack_right', 2, S16),
      p('attack_up_1', 'Attack Up – Windup', 'Facing away, pulling back', 'up', 'attack_up', 0, S16),
      p('attack_up_2', 'Attack Up – Strike', 'Facing away, swinging', 'up', 'attack_up', 1, S16),
      p('attack_up_3', 'Attack Up – Follow', 'Facing away, recovering', 'up', 'attack_up', 2, S16),
    ]
  },
  {
    id: 'cast_tech', name: 'Cast / Tech Charge',
    description: 'Spell or tech charge-up (3 frames)',
    dependsOn: 'base_idle', required: false,
    poses: [
      p('cast_charge_1', 'Cast – Charge', 'Gathering energy', 'down', 'cast', 0, S16, false),
      p('cast_charge_2', 'Cast – Peak', 'Energy at full', 'down', 'cast', 1, S16, false),
      p('cast_charge_3', 'Cast – Release', 'Energy burst', 'down', 'cast', 2, S16, false),
    ]
  },
  {
    id: 'damage_ko', name: 'Damage + KO',
    description: 'Taking damage and knocked out (4 frames)',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('action_damage_1', 'Damage – Impact', 'Recoiling from hit', 'down', 'damage', 0, S16),
      p('action_damage_2', 'Damage – Stagger', 'Staggering backward', 'down', 'damage', 1, S16),
      p('action_ko_1', 'KO – Collapsing', 'Falling to ground', 'down', 'ko', 0, S16),
      p('action_ko_2', 'KO – Down', 'Lying defeated', 'down', 'ko', 1, S16),
    ]
  },
  {
    id: 'emotes', name: 'Emotes',
    description: 'Expressive emote poses',
    dependsOn: 'base_idle', required: false,
    poses: [
      p('emote_surprise', 'Surprise', 'Startled, arms raised', 'down', 'emotes', 0, S16, false),
      p('emote_laugh', 'Laugh', 'Joyful, leaning back', 'down', 'emotes', 1, S16, false),
      p('emote_sit', 'Sit', 'Seated on ground', 'down', 'emotes', 2, S16, false),
      p('emote_sleep', 'Sleep', 'Lying down asleep', 'down', 'emotes', 3, S16, false),
    ]
  }
];

// ---------------------------------------------------------------------------
// SIDE_SCROLLER (prefixed with side_)
// ---------------------------------------------------------------------------
const SIDE_SCROLLER_PHASES = [
  {
    id: 'base_idle', name: 'Base Idle',
    description: 'Side-facing idle with breathing (2 frames)',
    dependsOn: null, required: true,
    poses: [
      p('side_idle_1', 'Idle 1', 'Side-facing ready stance', 'side', 'idle', 0, S24),
      p('side_idle_2', 'Idle 2', 'Slight breathing motion', 'side', 'idle', 1, S24),
    ]
  },
  {
    id: 'run_cycle', name: 'Run Cycle',
    description: 'Full run animation (6 frames)',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('side_run_1', 'Run 1 – Contact', 'Front foot touching ground', 'side', 'run', 0, S24),
      p('side_run_2', 'Run 2 – Down', 'Body at lowest point', 'side', 'run', 1, S24),
      p('side_run_3', 'Run 3 – Passing', 'Back leg swings forward', 'side', 'run', 2, S24),
      p('side_run_4', 'Run 4 – Up', 'Body at highest point', 'side', 'run', 3, S24),
      p('side_run_5', 'Run 5 – Flight', 'Both feet off ground', 'side', 'run', 4, S24),
      p('side_run_6', 'Run 6 – Reach', 'Front leg extends', 'side', 'run', 5, S24),
    ]
  },
  {
    id: 'jump', name: 'Jump',
    description: 'Jump arc (2 frames)',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('side_jump_rise', 'Jump – Rise', 'Ascending, legs tucked', 'side', 'jump', 0, S24),
      p('side_jump_fall', 'Jump – Fall', 'Descending, legs extended', 'side', 'jump', 1, S24),
    ]
  },
  {
    id: 'attack_standing', name: 'Attack Standing',
    description: 'Standing attack (3 frames)',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('side_attack_1', 'Attack – Windup', 'Arm pulled back', 'side', 'attack_standing', 0, S24),
      p('side_attack_2', 'Attack – Strike', 'Arm extended', 'side', 'attack_standing', 1, S24),
      p('side_attack_3', 'Attack – Recover', 'Returning to idle', 'side', 'attack_standing', 2, S24),
    ]
  },
  {
    id: 'attack_aerial', name: 'Attack Aerial',
    description: 'Mid-air attack (2 frames)',
    dependsOn: 'jump', required: true,
    poses: [
      p('side_aerial_attack_1', 'Aerial Attack – Windup', 'Mid-air, arm back', 'side', 'attack_aerial', 0, S24),
      p('side_aerial_attack_2', 'Aerial Attack – Strike', 'Mid-air, slashing down', 'side', 'attack_aerial', 1, S24),
    ]
  },
  {
    id: 'crouch', name: 'Crouch + Crouch Attack',
    description: 'Crouching and crouch attack (3 frames)',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('side_crouch', 'Crouch – Idle', 'Ducking low', 'side', 'crouch', 0, S24),
      p('side_crouch_attack_1', 'Crouch Attack – Windup', 'Crouching, arm back', 'side', 'crouch_attack', 0, S24),
      p('side_crouch_attack_2', 'Crouch Attack – Strike', 'Crouching, arm extended', 'side', 'crouch_attack', 1, S24),
    ]
  },
  {
    id: 'damage_death', name: 'Damage + Death',
    description: 'Damage and death animations (4 frames)',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('side_damage_1', 'Damage – Impact', 'Flinching, knocked back', 'side', 'damage', 0, S24),
      p('side_damage_2', 'Damage – Recover', 'Returning to stance', 'side', 'damage', 1, S24),
      p('side_death_1', 'Death – Explode', 'Breaking apart', 'side', 'death', 0, S24),
      p('side_death_2', 'Death – Fade', 'Fading out', 'side', 'death', 1, S24),
    ]
  },
  {
    id: 'climb', name: 'Climb / Ladder',
    description: 'Ladder climbing (2 frames)',
    dependsOn: 'base_idle', required: false,
    poses: [
      p('side_climb_1', 'Climb – Left Reach', 'Left hand up', null, 'climb', 0, S24, false),
      p('side_climb_2', 'Climb – Right Reach', 'Right hand up', null, 'climb', 1, S24, false),
    ]
  }
];

// ---------------------------------------------------------------------------
// CREATURE (prefixed with creature_)
// ---------------------------------------------------------------------------
const CREATURE_PHASES = [
  {
    id: 'base_idle', name: 'Base Idle',
    description: 'Front-facing idle (2 frames)',
    dependsOn: null, required: true,
    poses: [
      p('creature_idle_1', 'Idle 1', 'Neutral stance, alert', 'down', 'idle', 0, S16C),
      p('creature_idle_2', 'Idle 2', 'Subtle breathing motion', 'down', 'idle', 1, S16C),
    ]
  },
  {
    id: 'attack', name: 'Attack',
    description: 'Attack animation (3 frames)',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('creature_attack_1', 'Attack – Telegraph', 'Rearing back', 'down', 'attack', 0, S16C),
      p('creature_attack_2', 'Attack – Strike', 'Lunging forward', 'down', 'attack', 1, S16C),
      p('creature_attack_3', 'Attack – Recover', 'Returning to neutral', 'down', 'attack', 2, S16C),
    ]
  },
  {
    id: 'damage', name: 'Damage',
    description: 'Taking damage (2 frames)',
    dependsOn: 'base_idle', required: true,
    poses: [
      p('creature_damage_1', 'Damage – Flash', 'Hit flash, recoils', 'down', 'damage', 0, S16C),
      p('creature_damage_2', 'Damage – Recover', 'Returning to stance', 'down', 'damage', 1, S16C),
    ]
  },
  {
    id: 'death', name: 'Death / Dissolve',
    description: 'Death or dissolve (3 frames)',
    dependsOn: 'damage', required: true,
    poses: [
      p('creature_death_1', 'Death – Begin', 'Starting to dissolve', 'down', 'death', 0, S16C),
      p('creature_death_2', 'Death – Mid', 'Halfway dissolved', 'down', 'death', 1, S16C),
      p('creature_death_3', 'Death – End', 'Fully dissolved', 'down', 'death', 2, S16C),
    ]
  },
  {
    id: 'overworld_movement', name: 'Overworld Movement',
    description: '4-directional movement (3 frames each)',
    dependsOn: 'base_idle', required: false,
    poses: [
      p('creature_walk_down_1', 'Move Down 1', 'Toward viewer, step 1', 'down', 'move_down', 0, S16C, false),
      p('creature_walk_down_2', 'Move Down 2', 'Toward viewer, step 2', 'down', 'move_down', 1, S16C, false),
      p('creature_walk_down_3', 'Move Down 3', 'Toward viewer, step 3', 'down', 'move_down', 2, S16C, false),
      p('creature_walk_up_1', 'Move Up 1', 'Away, step 1', 'up', 'move_up', 0, S16C, false),
      p('creature_walk_up_2', 'Move Up 2', 'Away, step 2', 'up', 'move_up', 1, S16C, false),
      p('creature_walk_up_3', 'Move Up 3', 'Away, step 3', 'up', 'move_up', 2, S16C, false),
      p('creature_walk_left_1', 'Move Left 1', 'Left, step 1', 'left', 'move_left', 0, S16C, false),
      p('creature_walk_left_2', 'Move Left 2', 'Left, step 2', 'left', 'move_left', 1, S16C, false),
      p('creature_walk_left_3', 'Move Left 3', 'Left, step 3', 'left', 'move_left', 2, S16C, false),
      p('creature_walk_right_1', 'Move Right 1', 'Right, step 1', 'right', 'move_right', 0, S16C, false),
      p('creature_walk_right_2', 'Move Right 2', 'Right, step 2', 'right', 'move_right', 1, S16C, false),
      p('creature_walk_right_3', 'Move Right 3', 'Right, step 3', 'right', 'move_right', 2, S16C, false),
    ]
  }
];

// ---------------------------------------------------------------------------
// Hierarchy index
// ---------------------------------------------------------------------------
export const POSE_HIERARCHIES = {
  TOP_DOWN_RPG: TOP_DOWN_RPG_PHASES,
  ACTION_RPG: ACTION_RPG_PHASES,
  SIDE_SCROLLER: SIDE_SCROLLER_PHASES,
  CREATURE: CREATURE_PHASES
};

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

export function getPoseHierarchy(gameTypeId) {
  return POSE_HIERARCHIES[gameTypeId] ?? null;
}

export function getPhaseById(gameTypeId, phaseId) {
  const phases = POSE_HIERARCHIES[gameTypeId];
  if (!phases) return null;
  return phases.find(ph => ph.id === phaseId) ?? null;
}

export function getNextPhase(gameTypeId, completedPhaseIds = []) {
  const phases = POSE_HIERARCHIES[gameTypeId];
  if (!phases) return null;
  const done = new Set(completedPhaseIds);
  for (const phase of phases) {
    if (done.has(phase.id)) continue;
    if (phase.dependsOn === null || done.has(phase.dependsOn)) return phase;
  }
  return null;
}

export function getTotalPoseCount(gameTypeId) {
  const phases = POSE_HIERARCHIES[gameTypeId];
  if (!phases) return 0;
  return phases.reduce((s, ph) => s + ph.poses.length, 0);
}

export function getRequiredPoseCount(gameTypeId) {
  const phases = POSE_HIERARCHIES[gameTypeId];
  if (!phases) return 0;
  return phases.reduce((s, ph) => s + ph.poses.filter(po => po.required).length, 0);
}
