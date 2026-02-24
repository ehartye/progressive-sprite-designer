/**
 * Gemini API Client for Progressive Sprite Designer
 * Handles image generation via Google's Gemini API.
 */

// Error code constants
export const ErrorCodes = Object.freeze({
  API_KEY_INVALID: 'API_KEY_INVALID',
  RATE_LIMITED: 'RATE_LIMITED',
  CONTENT_FILTERED: 'CONTENT_FILTERED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
});

/**
 * Structured API error with code, message, and retryable flag.
 */
export class GeminiApiError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = 'GeminiApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Client for Google Gemini image generation API.
 */
export default class GeminiClient {
  /**
   * @param {string} apiKey - Google API key
   * @param {object} [options]
   * @param {string} [options.model] - Model ID (default: gemini-2.5-flash-image)
   * @param {string} [options.aspectRatio] - Aspect ratio (default: '1:1')
   */
  constructor(apiKey, options = {}) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new GeminiApiError(
        ErrorCodes.API_KEY_INVALID,
        'A valid API key string is required',
        false
      );
    }
    this.apiKey = apiKey;
    this.model = options.model || DEFAULT_MODEL;
    this.aspectRatio = options.aspectRatio || '1:1';
    this.baseUrl = BASE_URL;
  }

  /** @returns {string} The current model identifier */
  getModelId() {
    return this.model;
  }

  /**
   * Switch the model used for generation.
   * @param {string} modelId - e.g. 'gemini-2.5-flash-image' or 'gemini-3-pro-image-preview'
   */
  setModel(modelId) {
    this.model = modelId;
  }

  /**
   * Build the full API endpoint URL for the current model.
   * @returns {string}
   */
  _buildEndpoint() {
    return `${this.baseUrl}/${this.model}:generateContent`;
  }

  /**
   * Build the request body for image generation.
   * @param {string} prompt
   * @param {Array<{data: string, mimeType: string}>} referenceImages
   * @returns {object}
   */
  _buildRequestBody(prompt, referenceImages = []) {
    const parts = [{ text: prompt }];

    for (const img of referenceImages) {
      parts.push({
        inline_data: {
          mime_type: img.mimeType || 'image/png',
          data: img.data,
        },
      });
    }

    return {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };
  }

  /**
   * Parse the API response into a structured result.
   * @param {object} responseJson
   * @returns {{ text: string|null, image: { data: string, mimeType: string }|null, raw: object }}
   */
  _parseResponse(responseJson) {
    const result = { text: null, image: null, raw: responseJson };

    const candidate = responseJson.candidates?.[0];
    if (!candidate?.content?.parts) {
      return result;
    }

    for (const part of candidate.content.parts) {
      if (part.text && result.text === null) {
        result.text = part.text;
      }
      if (part.inlineData && result.image === null) {
        result.image = {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }

    return result;
  }

  /**
   * Classify an HTTP error response into a structured GeminiApiError.
   * @param {Response} response
   * @param {object|null} body
   * @returns {GeminiApiError}
   */
  _classifyError(response, body) {
    const status = response.status;
    const serverMessage = body?.error?.message || response.statusText || 'Unknown error';

    if (status === 400 && serverMessage.toLowerCase().includes('api key')) {
      return new GeminiApiError(ErrorCodes.API_KEY_INVALID, serverMessage, false);
    }
    if (status === 401 || status === 403) {
      return new GeminiApiError(ErrorCodes.API_KEY_INVALID, serverMessage, false);
    }
    if (status === 429) {
      return new GeminiApiError(ErrorCodes.RATE_LIMITED, serverMessage, true);
    }
    if (status === 400 && serverMessage.toLowerCase().includes('safety')) {
      return new GeminiApiError(ErrorCodes.CONTENT_FILTERED, serverMessage, false);
    }
    // Check for content filtering in other status codes
    if (body?.promptFeedback?.blockReason) {
      return new GeminiApiError(
        ErrorCodes.CONTENT_FILTERED,
        `Content blocked: ${body.promptFeedback.blockReason}`,
        false
      );
    }

    return new GeminiApiError(
      ErrorCodes.UNKNOWN_ERROR,
      `API error ${status}: ${serverMessage}`,
      status >= 500
    );
  }

  /**
   * Sleep for a given number of milliseconds.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate an image from a prompt, with optional reference images.
   * Includes retry logic with exponential backoff for rate-limited requests.
   *
   * @param {string} prompt - The full combined prompt text
   * @param {Array<{data: string, mimeType: string}>} [referenceImages] - Base64-encoded reference images
   * @returns {Promise<{ text: string|null, image: { data: string, mimeType: string }|null, raw: object }>}
   * @throws {GeminiApiError}
   */
  async generateImage(prompt, referenceImages = []) {
    const endpoint = this._buildEndpoint();
    const body = this._buildRequestBody(prompt, referenceImages);
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(body),
        });

        let responseBody = null;
        try {
          responseBody = await response.json();
        } catch {
          // Response may not be valid JSON
        }

        if (!response.ok) {
          const apiError = this._classifyError(response, responseBody);

          // Only retry on rate-limited (429) responses
          if (apiError.code === ErrorCodes.RATE_LIMITED && attempt < MAX_RETRIES) {
            const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            console.warn(
              `Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${backoff}ms...`
            );
            await this._sleep(backoff);
            lastError = apiError;
            continue;
          }

          throw apiError;
        }

        // Check for content filtering in a successful response
        if (responseBody?.promptFeedback?.blockReason) {
          throw new GeminiApiError(
            ErrorCodes.CONTENT_FILTERED,
            `Content blocked: ${responseBody.promptFeedback.blockReason}`,
            false
          );
        }

        return this._parseResponse(responseBody);
      } catch (error) {
        // Re-throw GeminiApiErrors directly (unless retryable and we have attempts left)
        if (error instanceof GeminiApiError) {
          if (error.retryable && attempt < MAX_RETRIES) {
            const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            console.warn(
              `Retryable error (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${backoff}ms...`
            );
            await this._sleep(backoff);
            lastError = error;
            continue;
          }
          throw error;
        }

        // Network or other unexpected errors
        const networkError = new GeminiApiError(
          ErrorCodes.NETWORK_ERROR,
          `Network error: ${error.message}`,
          true
        );

        if (attempt < MAX_RETRIES) {
          const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(
            `Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${backoff}ms...`
          );
          await this._sleep(backoff);
          lastError = networkError;
          continue;
        }

        throw networkError;
      }
    }

    // Should not reach here, but safety fallback
    throw lastError || new GeminiApiError(ErrorCodes.UNKNOWN_ERROR, 'Max retries exceeded', false);
  }

  /**
   * Generate multiple images in parallel.
   *
   * @param {string} prompt
   * @param {Array<{data: string, mimeType: string}>} [referenceImages]
   * @param {number} [count=4] - Number of parallel generation attempts
   * @returns {Promise<Array<{ text: string|null, image: object|null, raw: object }|{ error: string }>>}
   */
  async generateMultiple(prompt, referenceImages = [], count = 4) {
    console.log(`Starting ${count} parallel image generations...`);

    const promises = Array.from({ length: count }, (_, i) => {
      console.log(`  Generation ${i + 1}/${count} started`);
      return this.generateImage(prompt, referenceImages);
    });

    const settled = await Promise.allSettled(promises);

    const results = settled.map((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        console.log(`  Generation ${i + 1}/${count} succeeded`);
        return outcome.value;
      }
      const errorMsg = outcome.reason?.message || 'Unknown error';
      console.warn(`  Generation ${i + 1}/${count} failed: ${errorMsg}`);
      return { error: errorMsg };
    });

    const successCount = results.filter((r) => !r.error).length;
    console.log(`Completed: ${successCount}/${count} succeeded`);

    return results;
  }
}
