const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://food-ordering-backend-g9ff.onrender.com';

const rawApiUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, '');
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000);
const DEBUG_API = import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true';

const normalizeEndpoint = (endpoint = '') => {
  const trimmedEndpoint = String(endpoint).trim();

  if (!trimmedEndpoint) {
    return '';
  }

  return trimmedEndpoint
    .replace(/^\/+/, '')
    .replace(/^api\/+/, '');
};
const buildHeaders = (token, hasBody = false) => {
  const headers = {};

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export const apiRequest = async (endpoint, { method = 'GET', body, token } = {}) => {
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const requestUrl = normalizedEndpoint ? `${API_URL}/${normalizedEndpoint}` : API_URL;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = performance.now();

  let response;

  try {
    if (DEBUG_API) {
      console.info(`[api] ${method} ${requestUrl}`);
    }

    response = await fetch(requestUrl, {
      method,
      headers: buildHeaders(token, Boolean(body)),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `The server is taking too long to respond after ${Math.round(
          REQUEST_TIMEOUT_MS / 1000,
        )} seconds. Please try again.`,
      );
    }

    throw new Error(
      `Unable to reach the server at ${API_URL}. Make sure the backend is running and CORS allows this app.`,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (DEBUG_API) {
    console.info(
      `[api] ${method} ${requestUrl} -> ${response.status} in ${Math.round(
        performance.now() - startedAt,
      )}ms`,
    );
  }

  const rawText = await response.text();
  let data = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  if (!response.ok) {
    const errorMessage =
      data.message ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
};

export { API_URL };
