/**
 * Progressive Sprite Designer — Main Application Controller
 * Entry point that wires together all modules.
 */

import GeminiClient from './api.js';
import { GAME_TYPES, getPoseHierarchy, getTotalPoseCount } from './poses.js';
import { buildFullPrompt } from './prompts.js';
import UIManager from './ui.js';
import { WorkflowEngine } from './workflow.js';

let ui;
let workflow;
let client;
let characterConfig;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCompletedPoseIds() {
  if (!workflow) return new Set();
  const ids = new Set();
  for (const poseId of workflow.approvedSprites.keys()) {
    ids.add(poseId);
  }
  for (const poseId of workflow.skippedPoses) {
    ids.add(poseId + ':skipped');
  }
  return ids;
}

function refreshTree() {
  if (!workflow) return;
  ui.renderPoseTree(
    workflow.hierarchy,
    getCompletedPoseIds(),
    workflow.currentPhaseIndex,
    workflow.currentPoseIndex
  );
  const progress = workflow.getProgress();
  ui.renderProgress(progress.completed, progress.total);
}

function showCurrentPose() {
  if (!workflow) return;
  const phase = workflow.getCurrentPhase();
  const pose = workflow.getCurrentPose();
  if (!phase || !pose) return;

  ui.renderCurrentPose(
    phase, pose,
    workflow.currentPhaseIndex,
    workflow.hierarchy.length,
    workflow.currentPoseIndex,
    phase.poses.length
  );

  // Build and show prompt preview
  try {
    let prompt = buildFullPrompt(
      workflow.gameTypeId,
      workflow.spriteSize,
      characterConfig,
      pose,
      workflow.approvedSprites.size
    );
    const custom = ui.getCustomInstructions();
    if (custom.trim()) {
      prompt += `\n\nAdditional instructions: ${custom.trim()}`;
    }
    ui.renderPromptPreview(prompt);
  } catch {
    ui.renderPromptPreview('(prompt preview unavailable for this pose)');
  }

  refreshTree();

  // Reset generation state for this pose
  ui.enableButton('btn-generate', true);
  ui.enableButton('btn-approve', false);
  ui.enableButton('btn-skip', true);
}

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

async function onTestConnection() {
  const config = ui.getConfig();
  if (!config.apiKey) {
    ui.showConnectionResult(false, 'Please enter an API key.');
    return;
  }
  ui.renderStatus('Testing connection...', 'info');
  try {
    const testClient = new GeminiClient(config.apiKey, { model: config.model });
    // Simple text-only request to verify the key
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "ok" in one word.' }] }],
      }),
    });
    if (resp.ok) {
      ui.showConnectionResult(true, `Connected to ${config.model}`);
    } else {
      const body = await resp.json().catch(() => null);
      ui.showConnectionResult(false, body?.error?.message || `HTTP ${resp.status}`);
    }
  } catch (err) {
    ui.showConnectionResult(false, `Connection failed: ${err.message}`);
  }
}

function onStartWorkflow(config) {
  if (!config.apiKey || !config.gameType || !config.name || !config.description) {
    ui.renderStatus('Please fill in all required fields.', 'warning');
    return;
  }

  characterConfig = {
    name: config.name,
    description: config.description,
    equipment: config.equipment,
    colorNotes: config.colorNotes,
  };

  client = new GeminiClient(config.apiKey, { model: config.model });
  workflow = new WorkflowEngine(client, config.gameType);

  ui.showWorkflowUI();
  showCurrentPose();
  ui.renderStatus(`Workflow started — ${GAME_TYPES[config.gameType].name} (${getTotalPoseCount(config.gameType)} poses)`, 'success');
}

async function onGenerate() {
  if (!workflow || workflow.isGenerating) return;

  ui.renderLoading(true);
  ui.renderStatus('Generating 4 options...', 'info');

  try {
    const custom = ui.getCustomInstructions();
    const results = await workflow.generateCurrentPose(characterConfig, custom);
    ui.renderGenerationResults(results);
    ui.renderPromptPreview(workflow.getLastPrompt());

    const successCount = results.filter(r => r.image).length;
    if (successCount > 0) {
      ui.renderStatus(`Generated ${successCount} option(s). Click one to select.`, 'success');
    } else {
      ui.renderStatus('All generations failed. Try again or adjust your prompt.', 'error');
    }
  } catch (err) {
    ui.renderStatus(`Generation failed: ${err.message}`, 'error');
    ui.renderGenerationResults([
      { error: err.message },
      { error: 'Failed' },
      { error: 'Failed' },
      { error: 'Failed' },
    ]);
  } finally {
    ui.renderLoading(false);
    ui.enableButton('btn-generate', true);
    ui.enableButton('btn-skip', true);
  }
}

function onImageSelect(index) {
  workflow.selectOption(index);
  ui.setSelectedImage(index);
}

function onApprove() {
  if (!workflow) return;
  const data = workflow.approveSelected();
  if (!data) {
    ui.renderStatus('No image selected to approve.', 'warning');
    return;
  }

  ui.renderApprovedGallery(workflow.getApprovedSprites());
  refreshTree();
  ui.renderStatus('Sprite approved!', 'success');
  ui.enableButton('btn-next', true);
}

function onSkip() {
  if (!workflow) return;
  workflow.skipCurrentPose();
  const { phase, pose, done } = workflow.advanceToNextPose();
  if (done) {
    onWorkflowComplete();
  } else {
    ui.setCustomInstructions('');
    showCurrentPose();
    ui.renderStatus('Pose skipped.', 'info');
  }
}

function onNextPose() {
  if (!workflow) return;
  const { phase, pose, done } = workflow.advanceToNextPose();
  if (done) {
    onWorkflowComplete();
  } else {
    ui.setCustomInstructions('');
    showCurrentPose();
    // Clear grid
    ui.renderGenerationResults([{}, {}, {}, {}]);
  }
}

function onPrevPose() {
  if (!workflow) return;
  workflow.goToPreviousPose();
  ui.setCustomInstructions('');
  showCurrentPose();
  ui.renderGenerationResults([{}, {}, {}, {}]);
}

function onPoseSelect(phaseIndex, poseIndex) {
  if (!workflow) return;
  workflow.jumpToPose(phaseIndex, poseIndex);
  ui.setCustomInstructions('');
  showCurrentPose();
  ui.renderGenerationResults([{}, {}, {}, {}]);
}

async function onRegenerateOne(index) {
  if (!workflow) return;
  ui.renderStatus(`Regenerating option ${index + 1}...`, 'info');
  try {
    const custom = ui.getCustomInstructions();
    await workflow.regenerateOne(index, characterConfig, custom);
    ui.renderGenerationResults(workflow.generatedOptions);
    ui.renderStatus('Regenerated.', 'success');
  } catch (err) {
    ui.renderStatus(`Regeneration failed: ${err.message}`, 'error');
  }
}

function onWorkflowComplete() {
  const progress = workflow.getProgress();
  ui.renderStatus(
    `Workflow complete! ${progress.approved} sprites approved, ${progress.skipped} skipped.`,
    'success'
  );
  refreshTree();
  ui.enableButton('btn-generate', false);
  ui.enableButton('btn-skip', false);
  ui.enableButton('btn-next', false);
}

// ---------------------------------------------------------------------------
// Export / Download
// ---------------------------------------------------------------------------

function onDownloadAll() {
  if (!workflow) return;
  const sprites = workflow.getApprovedSprites();
  if (sprites.length === 0) return;

  for (const sprite of sprites) {
    downloadBase64(sprite.imageData, sprite.mimeType, `${sprite.poseId}.png`);
  }
  ui.renderStatus(`Downloading ${sprites.length} sprites...`, 'info');
}

function onDownloadSheet() {
  if (!workflow) return;
  const sprites = workflow.getApprovedSprites();
  if (sprites.length === 0) return;

  // Load all images, then arrange on canvas
  const images = [];
  let loaded = 0;

  for (const sprite of sprites) {
    const img = new Image();
    img.onload = () => {
      loaded++;
      if (loaded === sprites.length) {
        buildSpriteSheet(images);
      }
    };
    img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
    images.push(img);
  }
}

function buildSpriteSheet(images) {
  if (images.length === 0) return;

  // Find max dimensions
  const maxW = Math.max(...images.map(i => i.naturalWidth));
  const maxH = Math.max(...images.map(i => i.naturalHeight));
  const cols = Math.ceil(Math.sqrt(images.length));
  const rows = Math.ceil(images.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * maxW;
  canvas.height = rows * maxH;
  const ctx = canvas.getContext('2d');

  // Fill with magenta background
  ctx.fillStyle = '#FF00FF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Disable image smoothing for pixel art
  ctx.imageSmoothingEnabled = false;

  images.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * maxW + Math.floor((maxW - img.naturalWidth) / 2);
    const y = row * maxH + Math.floor((maxH - img.naturalHeight) / 2);
    ctx.drawImage(img, x, y);
  });

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sprite_sheet.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');

  ui.renderStatus('Sprite sheet downloaded!', 'success');
}

function downloadBase64(data, mimeType, filename) {
  const byteChars = atob(data);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Sprite removal from gallery modal
// ---------------------------------------------------------------------------

document.addEventListener('sprite:remove', (e) => {
  const { poseId } = e.detail;
  if (!workflow) return;
  workflow.removeApproval(poseId);
  ui.renderApprovedGallery(workflow.getApprovedSprites());
  refreshTree();
  ui.renderStatus('Sprite removed from approved.', 'info');
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  ui = new UIManager({
    onTestConnection,
    onStartWorkflow,
    onGenerate,
    onApprove,
    onSkip,
    onNextPose,
    onPrevPose,
    onPoseSelect,
    onImageSelect,
    onRegenerateOne,
    onDownloadAll,
    onDownloadSheet,
  });

  ui.init();
});
