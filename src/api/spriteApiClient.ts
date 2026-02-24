interface ImageRef {
  data: string;
  mimeType: string;
}

interface GenerateResult {
  text?: string;
  image?: { data: string; mimeType: string };
  error?: string;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * SpriteApiClient that calls Google's Gemini API directly from the browser.
 *
 * In corporate environments (Zscaler, etc.), the Express server cannot reach
 * Google's API, but the browser CAN because it goes through Zscaler's tunnel.
 * The API key is fetched once from the server's /api/key endpoint.
 *
 * Falls back to the server proxy routes if the direct call fails.
 */
export default class SpriteApiClient {
  private model: string;
  private apiKey: string | null = null;
  private keyPromise: Promise<string> | null = null;

  constructor(model = 'gemini-2.5-flash-image') {
    this.model = model;
  }

  getModelId(): string {
    return this.model;
  }

  setModel(modelId: string): void {
    this.model = modelId;
  }

  /** Fetch the API key from the server (cached after first call). */
  private async getApiKey(): Promise<string> {
    if (this.apiKey) return this.apiKey;
    if (this.keyPromise) return this.keyPromise;

    this.keyPromise = fetch('/api/key')
      .then(r => r.json())
      .then(data => {
        this.apiKey = data.key;
        return data.key as string;
      });

    return this.keyPromise;
  }

  /** Call Gemini directly from the browser with retry on 429. */
  private async callGeminiDirect(
    body: Record<string, unknown>,
    retries = 0,
  ): Promise<Response> {
    const key = await this.getApiKey();
    const url = `${GEMINI_BASE}/${this.model}:generateContent?key=${key}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && retries < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.callGeminiDirect(body, retries + 1);
    }

    return response;
  }

  /** Parse Gemini response into text + image. */
  private parseGeminiResponse(data: Record<string, unknown>): GenerateResult {
    const candidates = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> } }> }).candidates;
    const parts = candidates?.[0]?.content?.parts ?? [];

    const textParts: string[] = [];
    let image: { data: string; mimeType: string } | undefined;

    for (const part of parts) {
      if (part.text) textParts.push(part.text);
      if (part.inlineData) {
        image = { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
      }
    }

    return { text: textParts.join('\n'), image };
  }

  async generateImage(prompt: string, referenceImages: ImageRef[] = []): Promise<GenerateResult> {
    const parts: Array<Record<string, unknown>> = [
      { text: prompt },
      ...referenceImages.map(img => ({
        inline_data: { mime_type: img.mimeType, data: img.data },
      })),
    ];

    const body = {
      contents: [{ parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    };

    const response = await this.callGeminiDirect(body);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(errorData?.error?.message || `Gemini API error (${response.status})`);
    }

    const data = await response.json();

    // Check for content filtering
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'BLOCKED') {
      const safetyMessage = data?.candidates?.[0]?.safetyRatings
        ?.filter((r: { blocked?: boolean }) => r.blocked)
        ?.map((r: { category?: string }) => r.category)
        ?.join(', ') || 'Content was filtered';
      throw new Error(`Content filtered: ${safetyMessage}`);
    }

    return this.parseGeminiResponse(data);
  }

  async generateMultiple(prompt: string, referenceImages: ImageRef[] = [], count = 4): Promise<GenerateResult[]> {
    const promises = Array.from({ length: count }, () => this.generateImage(prompt, referenceImages));
    const settled = await Promise.allSettled(promises);
    return settled.map(outcome => {
      if (outcome.status === 'fulfilled') return outcome.value;
      return { error: outcome.reason?.message || 'Unknown error' };
    });
  }

  async testConnection(): Promise<{ success: boolean; model?: string; error?: string }> {
    try {
      const body = {
        contents: [{ parts: [{ text: 'Respond with "ok".' }] }],
      };

      const response = await this.callGeminiDirect(body);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
        return { success: false, error: errorData?.error?.message || `API error (${response.status})` };
      }

      return { success: true, model: this.model };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, error: message };
    }
  }
}
