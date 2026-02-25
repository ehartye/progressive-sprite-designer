import { Router } from 'express';

export function createGalleryRouter(db) {
  const router = Router();

  // GET /api/gallery — list all generation sets with key image
  router.get('/gallery', (req, res) => {
    const rows = db.prepare(
      `SELECT
         gs.id,
         gs.character_name,
         gs.game_type,
         gs.description,
         gs.equipment,
         gs.color_notes,
         gs.model,
         gs.created_at,
         gs.updated_at,
         COALESCE(sc.sprite_count, 0) AS sprite_count,
         key_sprite.image_data AS key_image_data,
         key_sprite.mime_type AS key_image_mime_type,
         key_sprite.pose_name AS key_image_pose_name
       FROM generation_sets AS gs
       LEFT JOIN (
         SELECT generation_set_id, COUNT(*) AS sprite_count
         FROM sprites
         GROUP BY generation_set_id
       ) AS sc ON sc.generation_set_id = gs.id
       LEFT JOIN sprites AS key_sprite
         ON key_sprite.id = (
           SELECT s2.id
           FROM sprites AS s2
           WHERE s2.generation_set_id = gs.id
           ORDER BY (s2.pose_id LIKE '%idle%') DESC, s2.created_at ASC
           LIMIT 1
         )
       ORDER BY gs.updated_at DESC`
    ).all();

    const result = rows.map(row => ({
      id: row.id,
      characterName: row.character_name,
      gameType: row.game_type,
      description: row.description,
      equipment: row.equipment,
      colorNotes: row.color_notes,
      model: row.model,
      spriteCount: row.sprite_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      keyImage: row.key_image_data != null
        ? {
            data: row.key_image_data,
            mimeType: row.key_image_mime_type,
            poseName: row.key_image_pose_name,
          }
        : null,
    }));

    res.json(result);
  });

  // GET /api/gallery/:id — single generation set with all sprites
  router.get('/gallery/:id', (req, res) => {
    const set = db.prepare('SELECT * FROM generation_sets WHERE id = ?').get(req.params.id);
    if (!set) return res.status(404).json({ error: 'Generation set not found' });

    const sprites = db.prepare(
      'SELECT * FROM sprites WHERE generation_set_id = ? ORDER BY created_at ASC'
    ).all(set.id);

    res.json({
      id: set.id,
      characterName: set.character_name,
      gameType: set.game_type,
      description: set.description,
      equipment: set.equipment,
      colorNotes: set.color_notes,
      model: set.model,
      customInstructions: set.custom_instructions,
      createdAt: set.created_at,
      updatedAt: set.updated_at,
      sprites: sprites.map(s => ({
        id: s.id,
        poseId: s.pose_id,
        poseName: s.pose_name,
        imageData: s.image_data,
        mimeType: s.mime_type,
        prompt: s.prompt,
        modelId: s.model_id,
        customInstructions: s.custom_instructions,
        referenceImageIds: JSON.parse(s.reference_image_ids),
        createdAt: s.created_at,
      })),
    });
  });

  // POST /api/gallery — create new generation set
  router.post('/gallery', (req, res) => {
    const { characterName, gameType, description, equipment, colorNotes, model } = req.body;

    if (!characterName || !gameType) {
      return res.status(400).json({ error: 'characterName and gameType are required' });
    }

    const result = db.prepare(
      `INSERT INTO generation_sets (character_name, game_type, description, equipment, color_notes, model)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(characterName, gameType, description || '', equipment || '', colorNotes || '', model || 'gemini-2.5-flash-image');

    res.json({ id: result.lastInsertRowid });
  });

  // PUT /api/gallery/:id — update generation set metadata
  router.put('/gallery/:id', (req, res) => {
    const set = db.prepare('SELECT * FROM generation_sets WHERE id = ?').get(req.params.id);
    if (!set) return res.status(404).json({ error: 'Generation set not found' });

    const { characterName, description, equipment, colorNotes, model } = req.body;

    db.prepare(
      `UPDATE generation_sets SET
        character_name = COALESCE(?, character_name),
        description = COALESCE(?, description),
        equipment = COALESCE(?, equipment),
        color_notes = COALESCE(?, color_notes),
        model = COALESCE(?, model),
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(characterName, description, equipment, colorNotes, model, req.params.id);

    res.json({ success: true });
  });

  // DELETE /api/gallery/:id — delete generation set and all sprites
  router.delete('/gallery/:id', (req, res) => {
    const result = db.prepare('DELETE FROM generation_sets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Generation set not found' });
    res.json({ success: true });
  });

  // POST /api/gallery/:id/sprites — add sprite to generation set
  router.post('/gallery/:id/sprites', (req, res) => {
    const set = db.prepare('SELECT * FROM generation_sets WHERE id = ?').get(req.params.id);
    if (!set) return res.status(404).json({ error: 'Generation set not found' });

    const { poseId, poseName, imageData, mimeType, prompt, modelId, customInstructions, referenceImageIds } = req.body;

    if (!poseId || !imageData) {
      return res.status(400).json({ error: 'poseId and imageData are required' });
    }

    // Remove existing sprite for this pose in this set (replace on re-approve)
    db.prepare(
      'DELETE FROM sprites WHERE generation_set_id = ? AND pose_id = ?'
    ).run(req.params.id, poseId);

    const result = db.prepare(
      `INSERT INTO sprites (generation_set_id, pose_id, pose_name, image_data, mime_type, prompt, model_id, custom_instructions, reference_image_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.params.id, poseId, poseName || '', imageData, mimeType || 'image/png',
      prompt || '', modelId || '', customInstructions || '',
      JSON.stringify(referenceImageIds || [])
    );

    // Update the generation set's updated_at
    db.prepare('UPDATE generation_sets SET updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

    res.json({ id: result.lastInsertRowid });
  });

  // DELETE /api/gallery/:id/sprites/:spriteId — remove sprite
  router.delete('/gallery/:id/sprites/:spriteId', (req, res) => {
    const result = db.prepare(
      'DELETE FROM sprites WHERE id = ? AND generation_set_id = ?'
    ).run(req.params.spriteId, req.params.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Sprite not found' });

    db.prepare('UPDATE generation_sets SET updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

    res.json({ success: true });
  });

  return router;
}
