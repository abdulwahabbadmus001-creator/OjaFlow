import type {
  BusinessProfile,
  StoreData,
  UserProfile
} from '../types';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || '/api'
).replace(/\/$/, '');

const CSRF_KEY = 'ojaflow:csrf';

let csrfToken =
  sessionStorage.getItem(CSRF_KEY) || '';

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

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const message =
      data.detail ||
      data.error ||
      'Request failed.';

    throw new Error(
      typeof message === 'string'
        ? message
        : 'Request failed.'
    );
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
  health: () =>
    request<{ ok: boolean }>('/health'),

  session: () =>
    request<AuthResult>('/auth/session'),

  loginPassword: (
    identifier: string,
    password: string
  ) =>
    request<AuthResult>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          phone: identifier,
          password
        })
      }
    ),

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


  registerStart: async (payload: {
    phone: string;
    firstName: string;
    lastName: string;
    otherName?: string;
    password: string;
    preferredLanguage: string;
  }) => {
    const result = await request<{
      challengeId?: string;
      challenge_id?: string;
      phone?: string;
      expiresIn?: number;
      expiresInSeconds?: number;
      message?: string;
    }>('/auth/register/request-otp', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const challengeId =
      result.challengeId ?? result.challenge_id;

    if (!challengeId) {
      throw new Error(
        result.message ||
          'The server did not return a verification challenge.'
      );
    }

    return {
      challengeId,
      phone: result.phone || payload.phone,
      expiresIn:
        result.expiresIn ?? result.expiresInSeconds
    };
  },

  registerVerify: (
    challengeId: string,
    code: string
  ) =>
    request<AuthResult>(
      '/auth/register/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          challengeId,
          code
        })
      }
    ),

  forgotStart: (
    phone: string
  ) =>
    request<{
      challengeId: string;
      phone: string;
    }>(
      '/auth/forgot/request-otp',
      {
        method: 'POST',
        body: JSON.stringify({
          phone
        })
      }
    ),

  forgotVerify: (
    challengeId: string,
    code: string,
    newPassword: string
  ) =>
    request<{ ok: boolean }>(
      '/auth/forgot/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          challengeId,
          code,
          newPassword
        })
      }
    ),

  verifyPassword: (
    password: string
  ) =>
    request<{ ok: boolean }>(
      '/account/verify-password',
      {
        method: 'POST',
        body: JSON.stringify({
          password
        })
      },
      true
    ),

  saveProfile: (
    profile: UserProfile,
    business?: BusinessProfile
  ) =>
    request<{
      profile: UserProfile;
      business: BusinessProfile | null;
    }>(
      '/account/profile',
      {
        method: 'PUT',
        body: JSON.stringify({
          profile,
          business
        })
      },
      true
    ),

  changePassword: (
    currentPassword: string,
    newPassword: string
  ) =>
    request<{ ok: boolean }>(
      '/account/change-password',
      {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      },
      true
    ),

  requestDeleteOtp: (
    password: string
  ) =>
    request<{ challengeId: string }>(
      '/account/delete/request-otp',
      {
        method: 'POST',
        body: JSON.stringify({
          password
        })
      },
      true
    ),

  verifyDeleteOtp: (
    challengeId: string,
    code: string
  ) =>
    request<{ deletionToken: string }>(
      '/account/delete/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({
          challengeId,
          code
        })
      },
      true
    ),

  deleteAccount: async (
    deletionToken: string,
    confirmation?: string
  ) => {
    const result = await request<{ ok: boolean }>(
      '/account/delete/confirm',
      {
        method: 'POST',
        body: JSON.stringify({
          deletionToken,
          ...(confirmation
            ? { confirmation }
            : {})
        })
      },
      true
    );

    clearCsrf();

    return result;
  },

  loadStore: () =>
    request<{
      data: StoreData;
      version: number;
      updatedAt?: string;
    }>('/store'),

  saveStore: (
    data: StoreData,
    version: number
  ) =>
    request<{
      data: StoreData;
      version: number;
      updatedAt?: string;
    }>(
      '/store',
      {
        method: 'PUT',
        body: JSON.stringify({
          data,
          version
        })
      },
      true
    ),

  ojaChat: (
    message: string,
    context: unknown,
    business: unknown,
    history: Array<{
      role: 'user' | 'assistant';
      text: string;
    }>,
    language?: string
  ) =>
    request<{
      reply?: string;
      text?: string;
    }>(
      '/chat',
      {
        method: 'POST',
        body: JSON.stringify({
          message,
          context,
          business,
          history,
          ...(language
            ? { language }
            : {})
        })
      },
      true
    ),

  supportTicket: (
    category: string,
    subject: string,
    message: string
  ) =>
    request<{
      ok: boolean;
      ticketId: string;
    }>(
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