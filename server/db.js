import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (db) return db;

  const dataDir = join(__dirname, '..', 'data');
  mkdirSync(dataDir, { recursive: true });

  const dbPath = join(dataDir, 'sprite-forge.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createSchema(db);
  seedIfEmpty(db);

  return db;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      default_sprite_width INTEGER NOT NULL DEFAULT 16,
      default_sprite_height INTEGER NOT NULL DEFAULT 24
    );

    CREATE TABLE IF NOT EXISTS phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_type TEXT NOT NULL,
      phase_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      depends_on TEXT,
      required INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(game_type, phase_id),
      FOREIGN KEY(game_type) REFERENCES game_types(id)
    );

    CREATE TABLE IF NOT EXISTS poses (
      pose_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      phase_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      direction TEXT,
      anim_group TEXT NOT NULL DEFAULT '',
      frame_index INTEGER NOT NULL DEFAULT 0,
      sprite_width INTEGER NOT NULL DEFAULT 16,
      sprite_height INTEGER NOT NULL DEFAULT 24,
      required INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(pose_id, game_type),
      FOREIGN KEY(game_type) REFERENCES game_types(id)
    );

    CREATE TABLE IF NOT EXISTS super_prompts (
      game_type TEXT PRIMARY KEY,
      prompt_template TEXT NOT NULL,
      FOREIGN KEY(game_type) REFERENCES game_types(id)
    );

    CREATE TABLE IF NOT EXISTS pose_prompts (
      pose_id TEXT PRIMARY KEY,
      prompt_text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS character_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game_type TEXT NOT NULL,
      genre TEXT,
      description TEXT NOT NULL DEFAULT '',
      equipment TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      is_preset INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(game_type) REFERENCES game_types(id)
    );

    CREATE TABLE IF NOT EXISTS generation_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_name TEXT NOT NULL,
      game_type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      equipment TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
      custom_instructions TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sprites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generation_set_id INTEGER NOT NULL,
      pose_id TEXT NOT NULL,
      pose_name TEXT NOT NULL,
      image_data TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'image/png',
      prompt TEXT NOT NULL DEFAULT '',
      model_id TEXT NOT NULL DEFAULT '',
      custom_instructions TEXT NOT NULL DEFAULT '',
      reference_image_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(generation_set_id) REFERENCES generation_sets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sprites_generation_set ON sprites(generation_set_id);
    CREATE INDEX IF NOT EXISTS idx_sprites_pose ON sprites(pose_id);
    CREATE INDEX IF NOT EXISTS idx_poses_game_type ON poses(game_type, phase_id);
    CREATE INDEX IF NOT EXISTS idx_phases_game_type ON phases(game_type);
  `);
}

function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM game_types').get();
  if (count.c > 0) return;

  console.log('[DB] Seeding database from JSON files...');

  const srcData = join(__dirname, '..', 'src', 'data');

  const posesData = JSON.parse(readFileSync(join(srcData, 'poses.json'), 'utf-8'));
  const promptsData = JSON.parse(readFileSync(join(srcData, 'prompts.json'), 'utf-8'));
  const charactersData = JSON.parse(readFileSync(join(srcData, 'characters.json'), 'utf-8'));

  const insertGameType = db.prepare(
    'INSERT INTO game_types (id, name, description, default_sprite_width, default_sprite_height) VALUES (?, ?, ?, ?, ?)'
  );
  const insertPhase = db.prepare(
    'INSERT INTO phases (game_type, phase_id, name, description, depends_on, required, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertPose = db.prepare(
    'INSERT INTO poses (pose_id, game_type, phase_id, name, description, direction, anim_group, frame_index, sprite_width, sprite_height, required, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertSuperPrompt = db.prepare(
    'INSERT INTO super_prompts (game_type, prompt_template) VALUES (?, ?)'
  );
  const insertPosePrompt = db.prepare(
    'INSERT INTO pose_prompts (pose_id, prompt_text) VALUES (?, ?)'
  );
  const insertCharacter = db.prepare(
    'INSERT INTO character_presets (id, name, game_type, genre, description, equipment, color_notes, is_preset) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  );

  const seedAll = db.transaction(() => {
    for (const [id, gt] of Object.entries(posesData.gameTypes)) {
      insertGameType.run(id, gt.name, gt.description, gt.defaultSpriteSize.w, gt.defaultSpriteSize.h);
    }

    for (const [gameType, phases] of Object.entries(posesData.hierarchies)) {
      phases.forEach((phase, phaseIdx) => {
        insertPhase.run(gameType, phase.id, phase.name, phase.description || '', phase.dependsOn, phase.required ? 1 : 0, phaseIdx);

        phase.poses.forEach((pose, poseIdx) => {
          insertPose.run(
            pose.id, gameType, phase.id, pose.name, pose.description || '',
            pose.direction, pose.animGroup, pose.frameIndex,
            pose.spriteSize.w, pose.spriteSize.h, pose.required ? 1 : 0, poseIdx
          );
        });
      });
    }

    for (const [gameType, template] of Object.entries(promptsData.superPrompts)) {
      insertSuperPrompt.run(gameType, template);
    }

    for (const [poseId, text] of Object.entries(promptsData.posePrompts)) {
      insertPosePrompt.run(poseId, text);
    }

    for (const char of charactersData.presets) {
      insertCharacter.run(char.id, char.name, char.gameType, char.genre || null, char.description, char.equipment || '', char.colorNotes || '');
    }
  });

  seedAll();
  console.log('[DB] Seeding complete.');
}
