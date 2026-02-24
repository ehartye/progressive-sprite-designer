/**
 * UI Manager for Progressive Sprite Designer
 * Handles all DOM manipulation, event binding, and rendering.
 * Contains no business logic — receives data and fires callbacks.
 */

const STATUS_AUTO_HIDE_MS = 5000;
const SPRITE_DISPLAY_SCALE = 4;
const SPRITE_MODAL_SCALE = 8;

// Pose status icons
const POSE_ICONS = Object.freeze({
  pending: '\u25CB',    // ○
  current: '\u25C9',    // ◉
  approved: '\u2713',   // ✓
  skipped: '\u2014',    // —
});

/**
 * Manages all UI rendering and event wiring for the sprite designer.
 */
export default class UIManager {
  /**
   * @param {object} callbacks
   * @param {function} callbacks.onStartWorkflow
   * @param {function} callbacks.onGenerate
   * @param {function} callbacks.onApprove
   * @param {function} callbacks.onSkip
   * @param {function} callbacks.onNextPose
   * @param {function} callbacks.onPrevPose
   * @param {function} callbacks.onPoseSelect
   * @param {function} callbacks.onTestConnection
   * @param {function} callbacks.onImageSelect
   * @param {function} callbacks.onRegenerateOne
   * @param {function} callbacks.onDownloadAll
   * @param {function} callbacks.onDownloadSheet
   */
  constructor(callbacks = {}) {
    this.cb = callbacks;
    this.els = {};
    this.selectedImageIndex = -1;
    this._statusTimer = null;
    this._modal = null;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Query all DOM elements, bind events, set initial state.
   */
  init() {
    this._queryElements();
    this._bindEvents();
    this._initCollapsibles();
    this._enableStartButtonWhenReady();
  }

  /** Cache references to all relevant DOM elements. */
  _queryElements() {
    this.els = {
      // Header
      modelSelect: document.getElementById('model-select'),
      apiKeyInput: document.getElementById('api-key-input'),
      btnTestConnection: document.getElementById('btn-test-connection'),

      // Config form
      gameTypeSelect: document.getElementById('game-type-select'),
      charName: document.getElementById('char-name'),
      charDescription: document.getElementById('char-description'),
      charEquipment: document.getElementById('char-equipment'),
      charColors: document.getElementById('char-colors'),
      startWorkflowBtn: document.getElementById('start-workflow-btn'),

      // Pose tree
      workflowProgress: document.getElementById('workflow-progress'),
      poseTreeContainer: document.getElementById('pose-tree-container'),

      // Center panel
      statusMessage: document.getElementById('status-message'),
      currentPoseHeader: document.getElementById('current-pose-header'),
      customInstructions: document.getElementById('custom-instructions'),
      generationGrid: document.getElementById('generation-grid'),
      promptPreview: document.getElementById('prompt-preview'),

      // Action buttons
      btnPrev: document.getElementById('btn-prev'),
      btnGenerate: document.getElementById('btn-generate'),
      btnApprove: document.getElementById('btn-approve'),
      btnSkip: document.getElementById('btn-skip'),
      btnNext: document.getElementById('btn-next'),

      // Gallery & export
      approvedGallery: document.getElementById('approved-gallery'),
      btnDownloadAll: document.getElementById('btn-download-all'),
      btnDownloadSheet: document.getElementById('btn-download-sheet'),
    };
  }

  /** Bind all event listeners. */
  _bindEvents() {
    const { els, cb } = this;

    els.btnTestConnection?.addEventListener('click', () => cb.onTestConnection?.());

    els.startWorkflowBtn?.addEventListener('click', () => {
      cb.onStartWorkflow?.(this.getConfig());
    });

    els.btnGenerate?.addEventListener('click', () => cb.onGenerate?.());
    els.btnApprove?.addEventListener('click', () => cb.onApprove?.(this.selectedImageIndex));
    els.btnSkip?.addEventListener('click', () => cb.onSkip?.());
    els.btnNext?.addEventListener('click', () => cb.onNextPose?.());
    els.btnPrev?.addEventListener('click', () => cb.onPrevPose?.());

    els.btnDownloadAll?.addEventListener('click', () => cb.onDownloadAll?.());
    els.btnDownloadSheet?.addEventListener('click', () => cb.onDownloadSheet?.());

    // Enable Start button when required fields have values
    const configInputs = [
      els.apiKeyInput, els.gameTypeSelect, els.charName, els.charDescription,
    ];
    for (const input of configInputs) {
      input?.addEventListener('input', () => this._enableStartButtonWhenReady());
      input?.addEventListener('change', () => this._enableStartButtonWhenReady());
    }
  }

  /** Setup collapsible section headers. */
  _initCollapsibles() {
    const headers = document.querySelectorAll('.collapsible-header');
    for (const header of headers) {
      header.addEventListener('click', () => {
        const targetId = header.dataset.target;
        const target = document.getElementById(targetId);
        if (!target) return;

        const isCollapsed = target.classList.toggle('collapsed');
        const chevron = header.querySelector('.chevron');
        if (chevron) {
          chevron.textContent = isCollapsed ? '\u25B6' : '\u25BE'; // ▶ or ▾
        }
      });
    }
  }

  /** Enable the Start Workflow button only when required fields are filled. */
  _enableStartButtonWhenReady() {
    const { apiKeyInput, gameTypeSelect, charName, charDescription, startWorkflowBtn } = this.els;
    const ready =
      apiKeyInput?.value.trim() &&
      gameTypeSelect?.value &&
      charName?.value.trim() &&
      charDescription?.value.trim();

    if (startWorkflowBtn) {
      startWorkflowBtn.disabled = !ready;
    }
  }

  // ---------------------------------------------------------------------------
  // Config Accessors
  // ---------------------------------------------------------------------------

  /**
   * Read form values and return config object.
   * @returns {{ apiKey: string, model: string, gameType: string, name: string, description: string, equipment: string, colorNotes: string }}
   */
  getConfig() {
    return {
      apiKey: this.els.apiKeyInput?.value.trim() || '',
      model: this.els.modelSelect?.value || '',
      gameType: this.els.gameTypeSelect?.value || '',
      name: this.els.charName?.value.trim() || '',
      description: this.els.charDescription?.value.trim() || '',
      equipment: this.els.charEquipment?.value.trim() || '',
      colorNotes: this.els.charColors?.value.trim() || '',
    };
  }

  /** @returns {string} */
  getCustomInstructions() {
    return this.els.customInstructions?.value || '';
  }

  /** @param {string} text */
  setCustomInstructions(text) {
    if (this.els.customInstructions) {
      this.els.customInstructions.value = text;
    }
  }

  // ---------------------------------------------------------------------------
  // Pose Tree Rendering
  // ---------------------------------------------------------------------------

  /**
   * Render the collapsible pose tree.
   * @param {Array<{name: string, poses: Array<{id: string, name: string}>}>} hierarchy
   * @param {Set<string>|Array<string>} completedPoseIds - ids of approved/skipped poses
   * @param {number} currentPhaseIndex
   * @param {number} currentPoseIndex
   */
  renderPoseTree(hierarchy, completedPoseIds, currentPhaseIndex, currentPoseIndex) {
    const container = this.els.poseTreeContainer;
    if (!container) return;

    const completedSet = completedPoseIds instanceof Set
      ? completedPoseIds
      : new Set(completedPoseIds);

    container.innerHTML = '';

    hierarchy.forEach((phase, phaseIdx) => {
      const phaseEl = document.createElement('div');
      phaseEl.className = 'pose-tree-phase';

      // Phase header
      const phaseHeader = document.createElement('div');
      phaseHeader.className = 'pose-tree-phase-header';
      const isCurrentPhase = phaseIdx === currentPhaseIndex;
      const chevron = isCurrentPhase ? '\u25BE' : '\u25B6'; // ▾ or ▶
      phaseHeader.innerHTML = `<span class="chevron">${chevron}</span> ${this._escapeHtml(phase.name)}`;

      // Pose list
      const poseList = document.createElement('div');
      poseList.className = 'pose-tree-pose-list';
      if (!isCurrentPhase) {
        poseList.classList.add('collapsed');
      }

      phaseHeader.addEventListener('click', () => {
        const collapsed = poseList.classList.toggle('collapsed');
        const chev = phaseHeader.querySelector('.chevron');
        if (chev) chev.textContent = collapsed ? '\u25B6' : '\u25BE';
      });

      phase.poses.forEach((pose, poseIdx) => {
        const poseEl = document.createElement('div');
        poseEl.className = 'pose-tree-pose';

        // Determine status
        const isCurrent = phaseIdx === currentPhaseIndex && poseIdx === currentPoseIndex;
        let icon;
        if (isCurrent) {
          icon = POSE_ICONS.current;
          poseEl.classList.add('pose-current');
        } else if (completedSet.has(pose.id + ':approved')) {
          icon = POSE_ICONS.approved;
          poseEl.classList.add('pose-approved');
        } else if (completedSet.has(pose.id + ':skipped')) {
          icon = POSE_ICONS.skipped;
          poseEl.classList.add('pose-skipped');
        } else if (completedSet.has(pose.id)) {
          icon = POSE_ICONS.approved;
          poseEl.classList.add('pose-approved');
        } else {
          icon = POSE_ICONS.pending;
          poseEl.classList.add('pose-pending');
        }

        poseEl.innerHTML = `<span class="pose-icon">${icon}</span> ${this._escapeHtml(pose.name)}`;
        poseEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.cb.onPoseSelect?.(phaseIdx, poseIdx);
        });

        poseList.appendChild(poseEl);
      });

      phaseEl.appendChild(phaseHeader);
      phaseEl.appendChild(poseList);
      container.appendChild(phaseEl);
    });
  }

  // ---------------------------------------------------------------------------
  // Current Pose Header
  // ---------------------------------------------------------------------------

  /**
   * Update the current pose display.
   * @param {object} phase - { name }
   * @param {object} pose - { name, description }
   * @param {number} phaseIndex - zero-based
   * @param {number} totalPhases
   * @param {number} poseIndex - zero-based
   * @param {number} totalPosesInPhase
   */
  renderCurrentPose(phase, pose, phaseIndex, totalPhases, poseIndex, totalPosesInPhase) {
    const header = this.els.currentPoseHeader;
    if (!header) return;

    header.innerHTML = `
      <div class="pose-header-title">
        Phase ${phaseIndex + 1}/${totalPhases} &mdash; ${this._escapeHtml(phase.name)}
        &nbsp;|&nbsp; Pose ${poseIndex + 1}/${totalPosesInPhase}: ${this._escapeHtml(pose.name)}
      </div>
      ${pose.description ? `<div class="pose-header-desc">${this._escapeHtml(pose.description)}</div>` : ''}
    `;
  }

  // ---------------------------------------------------------------------------
  // Generation Grid
  // ---------------------------------------------------------------------------

  /**
   * Render generation results (up to 4 images).
   * @param {Array<{image?: {data: string, mimeType: string}, text?: string, error?: string}>} results
   */
  renderGenerationResults(results) {
    const grid = this.els.generationGrid;
    if (!grid) return;

    grid.innerHTML = '';
    this.selectedImageIndex = -1;

    results.forEach((result, idx) => {
      const card = document.createElement('div');
      card.className = 'image-card';

      if (result.error) {
        card.classList.add('error-card');
        card.innerHTML = `
          <div class="image-card-inner error-inner">
            <span class="error-icon">&#9888;</span>
            <span class="error-text">${this._escapeHtml(result.error)}</span>
          </div>
          <div class="image-card-meta"><span class="image-dim">Error</span></div>
        `;
      } else if (result.image) {
        const src = `data:${result.image.mimeType};base64,${result.image.data}`;
        card.innerHTML = `
          <div class="image-card-inner">
            <img src="${src}" class="sprite-image" alt="Generated sprite option ${idx + 1}">
            <button class="regen-btn" title="Regenerate this image">&circlearrowright;</button>
          </div>
          <div class="image-card-meta">
            <span class="image-dim">Loading...</span>
          </div>
        `;

        // Show pixel dimensions once image loads
        const img = card.querySelector('img');
        img.addEventListener('load', () => {
          const dimLabel = card.querySelector('.image-dim');
          if (dimLabel) {
            dimLabel.textContent = `${img.naturalWidth} x ${img.naturalHeight}`;
          }
          // Apply scaled size
          img.style.width = `${img.naturalWidth * SPRITE_DISPLAY_SCALE}px`;
          img.style.height = `${img.naturalHeight * SPRITE_DISPLAY_SCALE}px`;
        });

        // Click to select
        card.addEventListener('click', (e) => {
          if (e.target.closest('.regen-btn')) return;
          this.setSelectedImage(idx);
          this.cb.onImageSelect?.(idx);
        });

        // Regenerate button
        const regenBtn = card.querySelector('.regen-btn');
        regenBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.cb.onRegenerateOne?.(idx);
        });
      } else {
        card.classList.add('placeholder-card');
        card.innerHTML = `
          <div class="image-card-inner shimmer"></div>
          <div class="image-card-meta"><span class="image-dim">--</span></div>
        `;
      }

      grid.appendChild(card);
    });
  }

  /**
   * Show or hide loading shimmer in the generation grid.
   * @param {boolean} isLoading
   */
  renderLoading(isLoading) {
    const grid = this.els.generationGrid;
    if (!grid) return;

    if (isLoading) {
      grid.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const card = document.createElement('div');
        card.className = 'image-card placeholder-card';
        card.innerHTML = `
          <div class="image-card-inner shimmer"></div>
          <div class="image-card-meta"><span class="image-dim">Generating...</span></div>
        `;
        grid.appendChild(card);
      }
      this._setActionButtonsDisabled(true);
    } else {
      this._setActionButtonsDisabled(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Approved Gallery
  // ---------------------------------------------------------------------------

  /**
   * Render the approved sprites gallery.
   * @param {Array<{poseId: string, poseName: string, imageData: string, mimeType: string, timestamp: number, prompt: string, modelId: string}>} approvedSprites
   */
  renderApprovedGallery(approvedSprites) {
    const gallery = this.els.approvedGallery;
    if (!gallery) return;

    if (!approvedSprites || approvedSprites.length === 0) {
      gallery.innerHTML = '<p class="empty-state-text">No approved sprites yet.</p>';
      this.enableButton('btn-download-all', false);
      this.enableButton('btn-download-sheet', false);
      return;
    }

    gallery.innerHTML = '';
    this.enableButton('btn-download-all', true);
    this.enableButton('btn-download-sheet', true);

    for (const sprite of approvedSprites) {
      const thumb = document.createElement('div');
      thumb.className = 'gallery-thumb';

      const src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
      const timeStr = new Date(sprite.timestamp).toLocaleTimeString();

      thumb.innerHTML = `
        <img src="${src}" class="gallery-thumb-img" alt="${this._escapeHtml(sprite.poseName)}">
        <div class="gallery-thumb-info">
          <span class="gallery-thumb-name">${this._escapeHtml(sprite.poseName)}</span>
          <span class="gallery-thumb-time">${timeStr}</span>
        </div>
      `;

      thumb.addEventListener('click', () => this._showSpriteModal(sprite));
      gallery.appendChild(thumb);
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt Preview
  // ---------------------------------------------------------------------------

  /** @param {string} promptText */
  renderPromptPreview(promptText) {
    if (this.els.promptPreview) {
      this.els.promptPreview.value = promptText;
    }
  }

  // ---------------------------------------------------------------------------
  // Progress Bar
  // ---------------------------------------------------------------------------

  /**
   * Update the workflow progress bar.
   * @param {number} completed
   * @param {number} total
   */
  renderProgress(completed, total) {
    const container = this.els.workflowProgress;
    if (!container) return;

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const fill = container.querySelector('.progress-bar-fill');
    const label = container.querySelector('.progress-label');

    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${completed} / ${total} poses completed`;
  }

  // ---------------------------------------------------------------------------
  // Status Messages
  // ---------------------------------------------------------------------------

  /**
   * Show a status message banner.
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'} [type='info']
   */
  renderStatus(message, type = 'info') {
    const el = this.els.statusMessage;
    if (!el) return;

    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }

    el.textContent = message;
    el.className = `status-message status-${type}`;
    el.classList.remove('hidden');

    if (type === 'info' || type === 'success') {
      this._statusTimer = setTimeout(() => {
        el.classList.add('hidden');
        this._statusTimer = null;
      }, STATUS_AUTO_HIDE_MS);
    }
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  /**
   * Highlight the selected image card.
   * @param {number} index
   */
  setSelectedImage(index) {
    this.selectedImageIndex = index;
    const grid = this.els.generationGrid;
    if (!grid) return;

    const cards = grid.querySelectorAll('.image-card');
    cards.forEach((card, i) => {
      card.classList.toggle('selected', i === index);
    });

    // Enable approve button when an image is selected
    this.enableButton('btn-approve', index >= 0);
  }

  // ---------------------------------------------------------------------------
  // Button State
  // ---------------------------------------------------------------------------

  /**
   * Enable or disable a button by its element ID.
   * @param {string} buttonId
   * @param {boolean} enabled
   */
  enableButton(buttonId, enabled) {
    const btn = document.getElementById(buttonId);
    if (btn) btn.disabled = !enabled;
  }

  /** Disable/enable all action bar buttons at once. */
  _setActionButtonsDisabled(disabled) {
    const ids = ['btn-prev', 'btn-generate', 'btn-approve', 'btn-skip', 'btn-next'];
    for (const id of ids) {
      this.enableButton(id, !disabled);
    }
  }

  // ---------------------------------------------------------------------------
  // UI State Transitions
  // ---------------------------------------------------------------------------

  /** Transition from config screen to workflow screen. */
  showWorkflowUI() {
    const header = this.els.currentPoseHeader;
    if (header) {
      const emptyState = header.querySelector('.center-empty-state');
      if (emptyState) emptyState.remove();
    }

    // Enable workflow action buttons
    this.enableButton('btn-generate', true);
    this.enableButton('btn-skip', true);
    this.enableButton('btn-prev', true);
    this.enableButton('btn-next', true);

    // Disable start button to prevent re-triggering
    if (this.els.startWorkflowBtn) {
      this.els.startWorkflowBtn.disabled = true;
      this.els.startWorkflowBtn.textContent = 'Workflow Active';
    }
  }

  /**
   * Show the result of an API key connection test.
   * @param {boolean} success
   * @param {string} message
   */
  showConnectionResult(success, message) {
    this.renderStatus(message, success ? 'success' : 'error');
  }

  // ---------------------------------------------------------------------------
  // Sprite Modal / Lightbox
  // ---------------------------------------------------------------------------

  /**
   * Show a modal with a large view of an approved sprite.
   * @param {object} sprite
   */
  _showSpriteModal(sprite) {
    this._closeModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
    const timeStr = new Date(sprite.timestamp).toLocaleString();

    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.innerHTML = `
      <button class="modal-close" title="Close">&times;</button>
      <div class="modal-sprite-container">
        <img src="${src}" class="modal-sprite-img sprite-image" alt="${this._escapeHtml(sprite.poseName)}">
      </div>
      <div class="modal-info">
        <h3 class="modal-title">${this._escapeHtml(sprite.poseName)}</h3>
        <p class="modal-time">${timeStr}</p>
        <details class="modal-prompt-details">
          <summary>Prompt</summary>
          <pre class="modal-prompt-text">${this._escapeHtml(sprite.prompt || 'N/A')}</pre>
        </details>
        <button class="btn btn-danger btn-sm modal-remove-btn">Remove from Approved</button>
      </div>
    `;

    // Scale the modal image once loaded
    const img = modal.querySelector('.modal-sprite-img');
    img.addEventListener('load', () => {
      img.style.width = `${img.naturalWidth * SPRITE_MODAL_SCALE}px`;
      img.style.height = `${img.naturalHeight * SPRITE_MODAL_SCALE}px`;
    });

    // Close handlers
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => this._closeModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeModal();
    });

    // Remove button
    const removeBtn = modal.querySelector('.modal-remove-btn');
    removeBtn.addEventListener('click', () => {
      this._closeModal();
      // Fire a custom event that the app can listen for
      document.dispatchEvent(
        new CustomEvent('sprite:remove', { detail: { poseId: sprite.poseId } })
      );
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this._modal = overlay;

    // Escape key to close
    this._modalKeyHandler = (e) => {
      if (e.key === 'Escape') this._closeModal();
    };
    document.addEventListener('keydown', this._modalKeyHandler);
  }

  /** Close the sprite modal if open. */
  _closeModal() {
    if (this._modal) {
      this._modal.remove();
      this._modal = null;
    }
    if (this._modalKeyHandler) {
      document.removeEventListener('keydown', this._modalKeyHandler);
      this._modalKeyHandler = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Escape HTML to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
