import { Router } from 'express';

export function createDataRouter(db) {
  const router = Router();

  // GET /api/data/game-types
  router.get('/data/game-types', (req, res) => {
    const rows = db.prepare('SELECT * FROM game_types').all();
    const gameTypes = {};
    for (const row of rows) {
      gameTypes[row.id] = {
        id: row.id,
        name: row.name,
        description: row.description,
        defaultSpriteSize: { w: row.default_sprite_width, h: row.default_sprite_height },
      };
    }
    res.json(gameTypes);
  });

  // GET /api/data/hierarchy/:gameType
  router.get('/data/hierarchy/:gameType', (req, res) => {
    const { gameType } = req.params;

    const phases = db.prepare(
      'SELECT * FROM phases WHERE game_type = ? ORDER BY sort_order'
    ).all(gameType);

    const poses = db.prepare(
      'SELECT * FROM poses WHERE game_type = ? ORDER BY sort_order'
    ).all(gameType);

    const posesByPhase = {};
    for (const pose of poses) {
      if (!posesByPhase[pose.phase_id]) posesByPhase[pose.phase_id] = [];
      posesByPhase[pose.phase_id].push({
        id: pose.pose_id,
        name: pose.name,
        description: pose.description,
        direction: pose.direction,
        animGroup: pose.anim_group,
        frameIndex: pose.frame_index,
        spriteSize: { w: pose.sprite_width, h: pose.sprite_height },
        required: !!pose.required,
      });
    }

    const hierarchy = phases.map(ph => ({
      id: ph.phase_id,
      name: ph.name,
      description: ph.description,
      dependsOn: ph.depends_on,
      required: !!ph.required,
      poses: posesByPhase[ph.phase_id] || [],
    }));

    res.json(hierarchy);
  });

  // GET /api/data/prompts
  router.get('/data/prompts', (req, res) => {
    const superRows = db.prepare('SELECT * FROM super_prompts').all();
    const poseRows = db.prepare('SELECT * FROM pose_prompts').all();

    const superPrompts = {};
    for (const row of superRows) {
      superPrompts[row.game_type] = row.prompt_template;
    }

    const posePrompts = {};
    for (const row of poseRows) {
      posePrompts[row.pose_id] = row.prompt_text;
    }

    res.json({ superPrompts, posePrompts });
  });

  // GET /api/data/characters
  router.get('/data/characters', (req, res) => {
    const rows = db.prepare(
      'SELECT * FROM character_presets ORDER BY is_preset DESC, name'
    ).all();

    const characters = rows.map(row => ({
      id: row.id,
      name: row.name,
      gameType: row.game_type,
      genre: row.genre,
      description: row.description,
      equipment: row.equipment,
      colorNotes: row.color_notes,
      isPreset: !!row.is_preset,
      isCustom: !row.is_preset,
    }));

    res.json(characters);
  });

  return router;
}
