import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAnimationEditor } from '../../hooks/useAnimationEditor';
import FrameEditorPanel from './FrameEditorPanel';
import PreviewPanel from './PreviewPanel';

interface Props {
  onClose: () => void;
}

export default function AnimationEditorModal({ onClose }: Props) {
  const api = useAnimationEditor();

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const hasFrames = api.animGroups.length > 0;
  const { imagesReady, loadProgress } = api;

  return createPortal(
    <div
      className="modal-overlay anim-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-content anim-modal-content"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="anim-modal-header">
          <h2 className="anim-modal-title">Animation Preview</h2>
          <button className="modal-close" onClick={onClose}>&#x2715;</button>
        </div>

        {/* Body */}
        {!hasFrames ? (
          <div className="anim-empty-state">
            <p className="empty-state-text">
              Approve some sprites in the workflow first, then come back to preview animations.
            </p>
          </div>
        ) : !imagesReady ? (
          <div className="anim-empty-state">
            <div className="anim-load-progress-center">
              <div className="anim-load-bar-lg">
                <div
                  className="anim-load-fill"
                  style={{ width: loadProgress.total > 0
                    ? `${(loadProgress.loaded / loadProgress.total) * 100}%`
                    : '0%' }}
                />
              </div>
              <span className="anim-load-text-lg">
                Loading sprites{loadProgress.total > 0
                  ? ` (${loadProgress.loaded}/${loadProgress.total})`
                  : '...'}
              </span>
            </div>
          </div>
        ) : (
          <div className="anim-editor-layout">
            <FrameEditorPanel api={api} />
            <PreviewPanel api={api} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
