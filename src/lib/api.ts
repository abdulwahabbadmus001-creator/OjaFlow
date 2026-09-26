import type { BusinessProfile, StoreData, UserProfile } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const CSRF_KEY = 'ojaflow:csrf';

let csrfToken = sessionStorage.getItem(CSRF_KEY) || '';

function rememberCsrf(value?: string) {
  if (!value) return;
  csrfToken = value;
  sessionStorage.setItem(CSRF_KEY, value);
}

function clearCsrf() {
  csrfToken = '';
  sessionStorage.removeItem(CSRF_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  csrf = false
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (csrf && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include'
    });
  } catch {
    throw new Error(
      'OjaFlow could not reach the backend. Make sure the FastAPI server is running.'
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.detail || data.error || 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }

  if (data.csrfToken) {
    rememberCsrf(data.csrfToken);
  }

  return data as T;
}

export type AuthResult = {
  profile: UserProfile;
  business: BusinessProfile | null;
  csrfToken: string;
};

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  session: () => request<AuthResult>('/auth/session'),

  loginPassword: (phone: string, password: string) =>
    request<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    }),

  logout: async () => {
    const result = await request<{ ok: boolean }>(
      '/auth/logout',
      {
        method: 'POST',
        body: '{}'
      },
      true
    );

    clearCsrf();
    return result;
  },

  register: (payload: {
    phone: string;
    firstName: string;
    lastName: string;
    otherName?: string;
    password: string;
    preferredLanguage: string;
  }) =>
    request<AuthResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  verifyPassword: (password: string) =>
    request<{ ok: boolean }>(
      '/account/verify-password',
      {
        method: 'POST',
        body: JSON.stringify({ password })
      },
      true
    ),

  saveProfile: (profile: UserProfile, business?: BusinessProfile) =>
    request<{ profile: UserProfile; business: BusinessProfile | null }>(
      '/account/profile',
      {
        method: 'PUT',
        body: JSON.stringify({ profile, business })
      },
      true
    ),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>(
      '/account/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      },
      true
    ),

  deleteAccount: async (
    password: string,
    confirmation: string
  ) => {
    const result = await request<{ ok: boolean }>(
      '/account/delete',
      {
        method: 'POST',
        body: JSON.stringify({ password, confirmation })
      },
      true
    );

    clearCsrf();
    return result;
  },

  loadStore: () =>
    request<{ data: StoreData; version: number; updatedAt?: string }>(
      '/store'
    ),

  saveStore: (data: StoreData, version: number) =>
    request<{ data: StoreData; version: number; updatedAt?: string }>(
      '/store',
      {
        method: 'PUT',
        body: JSON.stringify({ data, version })
      },
      true
    ),

  ojaChat: (
    message: string,
    context: unknown,
    business: unknown,
    history: Array<{ role: 'user' | 'assistant'; text: string }>,
    preferredLanguage: string
  ) =>
    request<{ reply: string }>(
      '/chat',
      {
        method: 'POST',
        body: JSON.stringify({
          message,
          context,
          business,
          history,
          preferredLanguage
        })
      },
      true
    ),

  supportTicket: (
    category: string,
    subject: string,
    message: string
  ) =>
    request<{ ok: boolean; ticketId: string }>(
      '/support/ticket',
      {
        method: 'POST',
        body: JSON.stringify({
          category,
          subject,
          message
        })
      },
      true
    )
};
