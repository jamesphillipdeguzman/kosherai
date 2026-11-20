/**
 * Centralized Gemini 3.8 Flash configuration & error classification.
 * Shared across serverless API routes and client services.
 */

export const GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
export const GEMINI_FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash'];
export const GEMINI_MODELS = [GEMINI_PRIMARY_MODEL, ...GEMINI_FALLBACK_MODELS];

export const VALID_THINKING_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

/**
 * Builds a Gemini 3.8-compatible generationConfig object.
 * Uses thinking_level (LOW/MEDIUM/HIGH) and omits unsupported legacy parameters
 * (temperature, top_p, top_k, candidate_count, frequency_penalty, presence_penalty, thinking_budget, MINIMAL).
 *
 * @param {Object} [options]
 * @param {'LOW'|'MEDIUM'|'HIGH'} [options.thinkingLevel='LOW']
 * @param {number} [options.maxOutputTokens=1024]
 * @param {string} [options.responseMimeType='application/json']
 * @returns {Object}
 */
export function buildGeminiRequestConfig(options = {}) {
  const {
    thinkingLevel = 'LOW',
    maxOutputTokens = 1024,
    responseMimeType = 'application/json'
  } = options;

  const normalizedLevel = VALID_THINKING_LEVELS.includes(String(thinkingLevel).toUpperCase())
    ? String(thinkingLevel).toUpperCase()
    : 'LOW';

  return {
    responseMimeType,
    maxOutputTokens,
    thinkingConfig: {
      thinkingLevel: normalizedLevel
    }
  };
}

/**
 * Classifies Gemini / fetch failures into actionable categories and HTTP status codes.
 */
export function classifyGeminiError(status, message = '', errName = '') {
  const msg = String(message || '').toLowerCase();

  if (errName === 'AbortError' || msg.includes('timed out') || msg.includes('timeout')) {
    return {
      errorType: 'TIMEOUT',
      httpStatus: 504,
      retryable: true,
      userMessage: 'AI analysis timed out. Please retry with the captured image.'
    };
  }
  if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('permission') || msg.includes('unauthorized')) {
    return {
      errorType: 'AUTH_ERROR',
      httpStatus: 401,
      retryable: false,
      userMessage: 'Gemini API authentication failed. Please check server API key configuration.'
    };
  }
  if (status === 404 || msg.includes('no longer available') || msg.includes('not found')) {
    return {
      errorType: 'MODEL_UNAVAILABLE',
      httpStatus: 502,
      retryable: true,
      userMessage: 'Selected AI model is temporarily unavailable.'
    };
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('quota') || msg.includes('resource_exhausted')) {
    return {
      errorType: 'RATE_LIMIT',
      httpStatus: 429,
      retryable: true,
      userMessage: 'AI service rate limit reached. Please wait a moment and retry.'
    };
  }
  if (status === 400 || msg.includes('invalid argument') || msg.includes('unable to process input image')) {
    return {
      errorType: 'INVALID_IMAGE',
      httpStatus: 400,
      retryable: false,
      userMessage: 'Image could not be processed. Please try a clearer photo or enter the food manually.'
    };
  }
  if (status === 503 || msg.includes('high demand') || msg.includes('unavailable')) {
    return {
      errorType: 'SERVICE_UNAVAILABLE',
      httpStatus: 503,
      retryable: true,
      userMessage: 'AI service is experiencing high demand. Please retry in a few seconds.'
    };
  }
  if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('econnreset')) {
    return {
      errorType: 'NETWORK_ERROR',
      httpStatus: 502,
      retryable: true,
      userMessage: 'Network error while contacting AI service. Check your connection and retry.'
    };
  }

  return {
    errorType: 'UPSTREAM_ERROR',
    httpStatus: 502,
    retryable: true,
    userMessage: 'AI service returned an unexpected response. Please retry or use Manual Food Entry.'
  };
}
