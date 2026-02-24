import { useState, useEffect, useCallback } from 'react';
import { fetchGallery, deleteGalleryEntry, type GalleryEntry } from '../../api/dataClient';
import { useWorkflow } from '../../hooks/useWorkflow';

interface Props {
  onSwitchToDesigner: () => void;
}

export default function GalleryPage({ onSwitchToDesigner }: Props) {
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { resumeFromGallery, setStatus } = useWorkflow();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGallery();
      setEntries(data);
    } catch (err) {
      console.error('Failed to load gallery:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleResume = async (entry: GalleryEntry) => {
    await resumeFromGallery(entry.id);
    onSwitchToDesigner();
  };

  const handleDelete = async (entry: GalleryEntry) => {
    try {
      await deleteGalleryEntry(entry.id);
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      setStatus(`Deleted "${entry.characterName}"`, 'info');
    } catch {
      setStatus('Failed to delete entry', 'error');
    }
  };

  if (loading) {
    return (
      <div className="gallery-page">
        <p className="empty-state-text">Loading gallery...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="gallery-page">
        <div className="center-empty-state">
          No generations yet. Start a workflow to create your first sprite set!
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-page">
      <div className="gallery-grid">
        {entries.map(entry => (
          <GalleryCard
            key={entry.id}
            entry={entry}
            onResume={() => handleResume(entry)}
            onDelete={() => handleDelete(entry)}
          />
        ))}
      </div>
    </div>
  );
}

function GalleryCard({ entry, onResume, onDelete }: {
  entry: GalleryEntry;
  onResume: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const keyImgSrc = entry.keyImage
    ? `data:${entry.keyImage.mimeType};base64,${entry.keyImage.data}`
    : null;

  const dateStr = new Date(entry.createdAt).toLocaleDateString();
  const timeStr = new Date(entry.updatedAt).toLocaleTimeString();

  return (
    <div className="gallery-card">
      <div className="gallery-card-image">
        {keyImgSrc ? (
          <img src={keyImgSrc} alt={entry.characterName} className="sprite-image" />
        ) : (
          <div className="gallery-card-placeholder">?</div>
        )}
      </div>
      <div className="gallery-card-body">
        <h3 className="gallery-card-name">{entry.characterName}</h3>
        <div className="gallery-card-meta">
          <span>{entry.gameType.replace(/_/g, ' ')}</span>
          <span>{entry.spriteCount} sprite{entry.spriteCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="gallery-card-date">{dateStr} {timeStr}</div>
        <div className="gallery-card-actions">
          <button className="btn btn-primary btn-sm" onClick={onResume}>
            Resume
          </button>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-danger btn-sm" onClick={() => { onDelete(); setConfirmDelete(false); }}>
                Confirm
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
