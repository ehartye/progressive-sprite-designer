import { downsampleImage } from '../lib/imageUtils';

interface ImageRef {
  data: string;
  mimeType: string;
}

interface GenerateResult {
  text?: string;
  image?: { data: string; mimeType: string };
  error?: string;
}

const REF_MAX_DIM = 256;

/**
 * SpriteApiClient that proxies all requests through the Express server.
 * The API key never leaves the server.
 */
export default class SpriteApiClient {
  private model: string;

  constructor(model = 'gemini-2.5-flash-image') {
    this.model = model;
  }

  getModelId(): string {
    return this.model;
  }

  setModel(modelId: string): void {
    this.model = modelId;
  }

  async generateImage(prompt: string, referenceImages: ImageRef[] = [], seed?: number, aspectRatio?: string): Promise<GenerateResult> {
    const shrunkRefs = await Promise.all(
      referenceImages.map(ref => downsampleImage(ref.data, ref.mimeType, REF_MAX_DIM))
    );

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, referenceImages: shrunkRefs, seed, aspectRatio }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(errorData?.error || `Server error (${response.status})`);
    }

    return response.json();
  }

  async generateMultiple(prompt: string, referenceImages: ImageRef[] = [], count = 4, aspectRatio?: string): Promise<GenerateResult[]> {
    const promises = Array.from({ length: count }, () =>
      this.generateImage(prompt, referenceImages, Math.floor(Math.random() * 2147483647), aspectRatio)
    );
    const settled = await Promise.allSettled(promises);
    return settled.map(outcome => {
      if (outcome.status === 'fulfilled') return outcome.value;
      return { error: outcome.reason?.message || 'Unknown error' };
    });
  }

  async testConnection(): Promise<{ success: boolean; model?: string; error?: string }> {
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model }),
      });

      return response.json();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, error: message };
    }
  }
}
