import { Router } from 'express';

export function createAdminRouter(db) {
  const router = Router();

  // === Character Presets ===

  // POST /api/admin/characters — create character
  router.post('/admin/characters', (req, res) => {
    const { name, gameType, genre, description, equipment, colorNotes } = req.body;
    if (!name || !gameType) {
      return res.status(400).json({ error: 'name and gameType are required' });
    }

    const id = `custom-${Date.now()}`;
    db.prepare(
      `INSERT INTO character_presets (id, name, game_type, genre, description, equipment, color_notes, is_preset)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(id, name, gameType, genre || null, description || '', equipment || '', colorNotes || '');

    res.json({ id });
  });

  // PUT /api/admin/characters/:id — update character
  router.put('/admin/characters/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM character_presets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Character not found' });

    const { name, gameType, genre, description, equipment, colorNotes } = req.body;

    db.prepare(
      `UPDATE character_presets SET
        name = COALESCE(?, name),
        game_type = COALESCE(?, game_type),
        genre = COALESCE(?, genre),
        description = COALESCE(?, description),
        equipment = COALESCE(?, equipment),
        color_notes = COALESCE(?, color_notes),
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(name, gameType, genre, description, equipment, colorNotes, req.params.id);

    res.json({ success: true });
  });

  // DELETE /api/admin/characters/:id — delete character
  router.delete('/admin/characters/:id', (req, res) => {
    const result = db.prepare('DELETE FROM character_presets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Character not found' });
    res.json({ success: true });
  });

  // === Poses ===

  // PUT /api/admin/poses/:gameType/:poseId — update pose metadata
  router.put('/admin/poses/:gameType/:poseId', (req, res) => {
    const existing = db.prepare('SELECT * FROM poses WHERE pose_id = ? AND game_type = ?').get(req.params.poseId, req.params.gameType);
    if (!existing) return res.status(404).json({ error: 'Pose not found' });

    const { name, description, direction, animGroup, frameIndex, spriteWidth, spriteHeight, required } = req.body;

    db.prepare(
      `UPDATE poses SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        direction = COALESCE(?, direction),
        anim_group = COALESCE(?, anim_group),
        frame_index = COALESCE(?, frame_index),
        sprite_width = COALESCE(?, sprite_width),
        sprite_height = COALESCE(?, sprite_height),
        required = COALESCE(?, required)
       WHERE pose_id = ? AND game_type = ?`
    ).run(name, description, direction, animGroup, frameIndex, spriteWidth, spriteHeight, required, req.params.poseId, req.params.gameType);

    res.json({ success: true });
  });

  // === Pose Prompts ===

  // PUT /api/admin/pose-prompts/:poseId — update pose prompt
  router.put('/admin/pose-prompts/:poseId', (req, res) => {
    const { promptText } = req.body;
    if (!promptText) return res.status(400).json({ error: 'promptText is required' });

    const result = db.prepare(
      `INSERT INTO pose_prompts (pose_id, prompt_text) VALUES (?, ?)
       ON CONFLICT(pose_id) DO UPDATE SET prompt_text = ?`
    ).run(req.params.poseId, promptText, promptText);

    res.json({ success: true });
  });

  // === Super Prompts ===

  // PUT /api/admin/super-prompts/:gameType — update super prompt
  router.put('/admin/super-prompts/:gameType', (req, res) => {
    const { promptTemplate } = req.body;
    if (!promptTemplate) return res.status(400).json({ error: 'promptTemplate is required' });

    const result = db.prepare(
      `INSERT INTO super_prompts (game_type, prompt_template) VALUES (?, ?)
       ON CONFLICT(game_type) DO UPDATE SET prompt_template = ?`
    ).run(req.params.gameType, promptTemplate, promptTemplate);

    res.json({ success: true });
  });

  // === Phases ===

  // PUT /api/admin/phases/:gameType/:phaseId — update phase
  router.put('/admin/phases/:gameType/:phaseId', (req, res) => {
    const { name, description, required } = req.body;

    const result = db.prepare(
      `UPDATE phases SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        required = COALESCE(?, required)
       WHERE game_type = ? AND phase_id = ?`
    ).run(name, description, required, req.params.gameType, req.params.phaseId);

    if (result.changes === 0) return res.status(404).json({ error: 'Phase not found' });
    res.json({ success: true });
  });

  return router;
}
