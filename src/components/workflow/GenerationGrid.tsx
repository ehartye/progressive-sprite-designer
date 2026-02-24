import { useWorkflow } from '../../hooks/useWorkflow';
import ImageCard from './ImageCard';

export default function GenerationGrid() {
  const { state, selectImage, regenerateOne } = useWorkflow();

  // Show shimmer placeholders while generating or when no results
  if (state.isGenerating) {
    return (
      <div className="generation-grid">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="image-card placeholder-card">
            <div className="image-card-inner shimmer" />
            <div className="image-card-meta"><span className="image-dim">Generating...</span></div>
          </div>
        ))}
      </div>
    );
  }

  if (state.generatedOptions.length === 0) {
    return (
      <div className="generation-grid">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="image-card placeholder-card">
            <div className="image-card-inner shimmer" />
            <div className="image-card-meta"><span className="image-dim">--</span></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="generation-grid">
      {state.generatedOptions.map((option, idx) => (
        <ImageCard
          key={idx}
          option={option}
          index={idx}
          isSelected={state.selectedIndex === idx}
          onSelect={() => selectImage(idx)}
          onRegenerate={() => regenerateOne(idx)}
        />
      ))}
    </div>
  );
}
