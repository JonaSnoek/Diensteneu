const BASE_API_URL = import.meta.env.VITE_API_URL || '';
const API_PREFIX = '/api';

type RequestOptions = {
  body?: any;
  headers?: Record<string, string>;
  [key: string]: any;
};

// Global event listener to notify App component about setup requirements or auth failures
export const apiEvents = {
  listeners: {} as Record<string, ((data?: any) => void)[]>,
  on(event: string, callback: (data?: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },
  emit(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
};

async function handleResponse(response: Response) {
  if (response.status === 503) {
    try {
      const data = await response.clone().json();
      if (data.detail === 'SETUP_REQUIRED') {
        apiEvents.emit('SETUP_REQUIRED');
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  } else if (response.status === 401) {
    // Session expired or unauthenticated
    apiEvents.emit('UNAUTHORIZED');
  }

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch (e) {
      // Ignore
    }
    throw new Error(errorMessage);
  }

  try {
    return await response.json();
  } catch (e) {
    return null; // Empty body
  }
}

export function resolveUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BASE_API_URL}${path}`;
}

export const api = {
  getUri(endpoint: string) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${BASE_API_URL}${cleanEndpoint}`;
  },

  async get(endpoint: string, options: RequestOptions = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      ...options.headers,
    } as Record<string, string>;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(this.getUri(API_PREFIX + endpoint), {
      method: 'GET',
      headers,
      ...options,
    });
    return handleResponse(response);
  },

  async post(endpoint: string, body: any = {}, options: RequestOptions = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    } as Record<string, string>;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(this.getUri(API_PREFIX + endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      ...options,
    });
    return handleResponse(response);
  },

  async put(endpoint: string, body: any = {}, options: RequestOptions = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    } as Record<string, string>;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(this.getUri(API_PREFIX + endpoint), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
      ...options,
    });
    return handleResponse(response);
  },

  async delete(endpoint: string, options: RequestOptions = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      ...options.headers,
    } as Record<string, string>;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(this.getUri(API_PREFIX + endpoint), {
      method: 'DELETE',
      headers,
      ...options,
    });
    return handleResponse(response);
  },

  async upload(endpoint: string, file: File, options: RequestOptions = {}) {
    const token = localStorage.getItem('access_token');
    const formData = new FormData();
    formData.append('file', file);

    const headers = {
      ...options.headers,
    } as Record<string, string>;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(this.getUri(API_PREFIX + endpoint), {
      method: 'POST',
      headers,
      body: formData,
      ...options,
    });
    return handleResponse(response);
  }
};
