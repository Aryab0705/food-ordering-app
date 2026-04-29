const rawApiUrl =
  (import.meta.env.VITE_API_URL || 'https://food-ordering-backend-g9ff.onrender.com')
    .replace(/\/$/, '');
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

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
  const timeoutId = window.setTimeout(() => controller.abort(), 25000);

  let response;

  try {
    response = await fetch(requestUrl, {
      method,
      headers: buildHeaders(token, Boolean(body)),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The server is taking too long to respond. Please try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
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
