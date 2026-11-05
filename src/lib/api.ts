import type {
  AdminAccount,
  AdminOverviewStats,
  AdminTicketRow,
  AdminUserRow,
  BusinessProfile,
  LanguagePreference,
  StoreData,
  SupportTicketItem,
  SystemBroadcastItem,
  UserNotificationItem,
  UserProfile
} from '../types';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || '/api'
).replace(/\/$/, '');

const CSRF_KEY = 'ojaflow:csrf';
const SESSION_TOKEN_KEY = 'ojaflow:session_token';
const ADMIN_CSRF_KEY = 'ojaflow:admin:csrf';
const ADMIN_TOKEN_KEY = 'ojaflow:admin:session_token';

let csrfToken =
  sessionStorage.getItem(CSRF_KEY) || '';
let sessionToken =
  sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
let adminCsrfToken =
  sessionStorage.getItem(ADMIN_CSRF_KEY) || '';
let adminSessionToken =
  sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';

function rememberCsrf(value?: string) {
  if (!value) return;

  csrfToken = value;
  sessionStorage.setItem(CSRF_KEY, value);
}

function rememberSessionToken(value?: string) {
  if (!value) return;

  sessionToken = value;
  sessionStorage.setItem(SESSION_TOKEN_KEY, value);
}

function rememberAdminCsrf(value?: string) {
  if (!value) return;

  adminCsrfToken = value;
  sessionStorage.setItem(ADMIN_CSRF_KEY, value);
}

function rememberAdminToken(value?: string) {
  if (!value) return;

  adminSessionToken = value;
  sessionStorage.setItem(ADMIN_TOKEN_KEY, value);
}

export function clearCsrf() {
  csrfToken = '';
  sessionToken = '';
  sessionStorage.removeItem(CSRF_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

export function clearAdminCsrf() {
  adminCsrfToken = '';
  adminSessionToken = '';
  sessionStorage.removeItem(ADMIN_CSRF_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return Boolean(adminSessionToken || sessionStorage.getItem(ADMIN_TOKEN_KEY));
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  csrf = false
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const isAdminPath = path.startsWith('/admin');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (isAdminPath) {
    if (adminSessionToken && !headers.has('X-Admin-Authorization')) {
      headers.set('X-Admin-Authorization', `Bearer ${adminSessionToken}`);
    }
  } else if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
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
      'OjaFlow could not connect right now. Check your internet connection and try again.'
    );
  }

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    let message = 'Request failed.';
    if (typeof data.detail === 'string') {
      message = data.detail;
    } else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
      message = String(data.detail[0].msg).replace(/^Value error,\s*/i, '');
    } else if (typeof data.error === 'string') {
      message = data.error;
    }

    throw new Error(message);
  }

  if (!isAdminPath && data.csrfToken) {
    rememberCsrf(data.csrfToken);
  }
  if (!isAdminPath && data.accessToken) {
    rememberSessionToken(data.accessToken);
  }

  return data as T;
}

export type RemoteStoreSnapshot = {
  data: StoreData;
  version: number;
  updatedAt?: string | null;
};

export type AuthResult = {
  profile: UserProfile;
  business: BusinessProfile | null;
  store?: RemoteStoreSnapshot;
  csrfToken: string;
};

export const api = {
  health: () =>
    request<{ ok: boolean }>('/health'),

  session: () =>
    request<AuthResult>('/auth/session'),

  loginPassword: (
    identifier: string,
    pin: string
  ) =>
    request<AuthResult>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          phone: identifier,
          pin,
          password: pin
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

  register: (payload: {
    phone: string;
    firstName: string;
    lastName: string;
    otherName?: string;
    pin?: string;
    password?: string;
    securityQuestion: string;
    securityAnswer: string;
    preferredLanguage: string;
  }) => {
    const pin = payload.pin || payload.password || '';
    return request<AuthResult>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          pin,
          password: pin
        })
      }
    );
  },

  recoveryQuestions: (lang = 'en') =>
    request<{
      questions: string[];
      byLanguage?: Record<string, string[]>;
    }>(`/auth/recovery/questions?lang=${encodeURIComponent(lang)}`),

  recoveryQuestion: (
    identifier: string,
    preferredLanguage: LanguagePreference = 'en'
  ) =>
    request<{
      securityQuestion: string;
      preferredLanguage?: LanguagePreference;
    }>(
      '/auth/recovery/question',
      {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          phone: identifier,
          preferredLanguage
        })
      }
    ),

  recoveryVerifyAnswer: (
    identifier: string,
    securityAnswer: string
  ) =>
    request<{ ok: boolean; recoveryToken: string }>(
      '/auth/recovery/verify-answer',
      {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          phone: identifier,
          securityAnswer
        })
      }
    ),

  recoveryResetPin: (payload: {
    recoveryToken?: string;
    identifier?: string;
    securityAnswer?: string;
    newPin: string;
  }) =>
    request<AuthResult>(
      '/auth/recovery/reset-pin',
      {
        method: 'POST',
        body: JSON.stringify({
          recoveryToken: payload.recoveryToken,
          identifier: payload.identifier,
          phone: payload.identifier,
          securityAnswer: payload.securityAnswer,
          newPin: payload.newPin,
          newPassword: payload.newPin
        })
      }
    ),

  updateSecurityQuestion: (payload: {
    currentPin: string;
    securityQuestion: string;
    securityAnswer: string;
    preferredLanguage?: LanguagePreference;
  }) =>
    request<{ ok: boolean; profile: UserProfile }>(
      '/account/security-question',
      {
        method: 'POST',
        body: JSON.stringify({
          currentPin: payload.currentPin,
          currentPassword: payload.currentPin,
          securityQuestion: payload.securityQuestion,
          securityAnswer: payload.securityAnswer,
          ...(payload.preferredLanguage
            ? { preferredLanguage: payload.preferredLanguage }
            : {})
        })
      },
      true
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
    newPin: string
  ) =>
    request<{ ok: boolean }>(
      '/auth/forgot/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          challengeId,
          code,
          newPin,
          newPassword: newPin
        })
      }
    ),

  verifyPassword: (
    pin: string
  ) =>
    request<{ ok: boolean }>(
      '/account/verify-password',
      {
        method: 'POST',
        body: JSON.stringify({
          pin,
          password: pin
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
    currentPin: string,
    newPin: string
  ) =>
    request<{ ok: boolean; csrfToken?: string }>(
      '/account/change-password',
      {
        method: 'POST',
        body: JSON.stringify({
          currentPin,
          currentPassword: currentPin,
          newPin,
          newPassword: newPin
        })
      },
      true
    ),

  deleteAccount: async (
    pin: string,
    confirmation: string
  ) => {
    const result = await request<{ ok: boolean }>(
      '/account/delete',
      {
        method: 'POST',
        body: JSON.stringify({
          pin,
          password: pin,
          confirmation
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
            ? { preferredLanguage: language }
            : {})
        })
      },
      true
    ),

  transcribeAudio: (
    audioBase64: string,
    mimeType: string,
    preferredLanguage: LanguagePreference = 'en'
  ) =>
    request<{ transcript: string }>(
      '/chat/transcribe',
      {
        method: 'POST',
        body: JSON.stringify({
          audioBase64,
          mimeType,
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
    request<{
      ok: boolean;
      ticketId: string;
      ticket?: SupportTicketItem;
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
    ),

  mySupportTickets: () =>
    request<{ tickets: SupportTicketItem[] }>('/support/tickets'),

  myNotifications: () =>
    request<{
      unreadCount: number;
      notifications: UserNotificationItem[];
    }>('/support/notifications'),

  markNotificationRead: (notificationId: string) =>
    request<{ ok: boolean }>(
      `/support/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: 'POST',
        body: '{}'
      },
      true
    ),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>(
      '/support/notifications/read-all',
      {
        method: 'POST',
        body: '{}'
      },
      true
    ),

  adminLogin: async (email: string, password: string) => {
    const res = await request<{
      admin: AdminAccount;
      csrfToken: string;
      accessToken?: string;
    }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim(),
        password: password.trim()
      })
    });
    rememberAdminCsrf(res.csrfToken);
    if (res.accessToken) {
      rememberAdminToken(res.accessToken);
    }
    return res;
  },

  adminSession: async () => {
    const res = await request<{
      admin: AdminAccount;
      csrfToken: string;
    }>('/admin/session');
    rememberAdminCsrf(res.csrfToken);
    return res;
  },

  adminLogout: async () => {
    const res = await request<{ ok: boolean }>(
      '/admin/logout',
      {
        method: 'POST',
        headers: adminCsrfToken
          ? { 'X-Admin-CSRF-Token': adminCsrfToken }
          : undefined,
        body: '{}'
      }
    );
    clearAdminCsrf();
    return res;
  },

  adminOverview: () =>
    request<{
      stats: AdminOverviewStats;
      users: AdminUserRow[];
      tickets: AdminTicketRow[];
    }>('/admin/overview'),

  adminListUsers: (q = '') =>
    request<{ users: AdminUserRow[] }>(
      `/admin/users?q=${encodeURIComponent(q)}`
    ),

  adminUnlockUser: (userId: string) =>
    request<{ ok: boolean; user: AdminUserRow }>(
      `/admin/users/${encodeURIComponent(userId)}/unlock`,
      {
        method: 'POST',
        headers: adminCsrfToken
          ? { 'X-Admin-CSRF-Token': adminCsrfToken }
          : undefined,
        body: '{}'
      }
    ),

  adminResetUserPin: (userId: string, newPin: string) =>
    request<{ ok: boolean; user: AdminUserRow }>(
      `/admin/users/${encodeURIComponent(userId)}/reset-pin`,
      {
        method: 'POST',
        headers: adminCsrfToken
          ? { 'X-Admin-CSRF-Token': adminCsrfToken }
          : undefined,
        body: JSON.stringify({ newPin })
      }
    ),

  adminUpdateUserStatus: (userId: string, isActive: boolean) =>
    request<{ ok: boolean; user: AdminUserRow }>(
      `/admin/users/${encodeURIComponent(userId)}/status`,
      {
        method: 'POST',
        headers: adminCsrfToken
          ? { 'X-Admin-CSRF-Token': adminCsrfToken }
          : undefined,
        body: JSON.stringify({ isActive })
      }
    ),

  adminDeleteUser: (userId: string) =>
    request<{ ok: boolean; deletedUserId: string }>(
      `/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: adminCsrfToken
          ? { 'X-Admin-CSRF-Token': adminCsrfToken }
          : undefined
      }
    ),

  adminListTickets: (status = '') =>
    request<{ tickets: AdminTicketRow[] }>(
      `/admin/tickets?status=${encodeURIComponent(status)}`
    ),

  adminReplyTicket: (
    ticketId: string,
    reply: string,
    status: 'open' | 'answered' | 'closed' = 'answered'
  ) =>
    request<{ ok: boolean; ticket: AdminTicketRow }>(
      `/admin/tickets/${encodeURIComponent(ticketId)}/reply`,
      {
        method: 'POST',
        headers: adminCsrfToken
          ? { 'X-Admin-CSRF-Token': adminCsrfToken }
          : undefined,
        body: JSON.stringify({ reply, status })
      }
    ),

  activeBroadcast: () =>
    request<{ broadcast: SystemBroadcastItem | null }>('/support/broadcast'),

  adminGetBroadcast: () =>
    request<{ broadcast: SystemBroadcastItem | null }>('/admin/broadcast'),

  adminSaveBroadcast: (payload: {
    kind: 'info' | 'update' | 'maintenance';
    title: string;
    message: string;
    isActive: boolean;
  }) =>
    request<{ ok: boolean; broadcast: SystemBroadcastItem | null }>(
      '/admin/broadcast',
      {
        method: 'POST',
        headers: adminCsrfToken
          ? { 'X-Admin-CSRF-Token': adminCsrfToken }
          : undefined,
        body: JSON.stringify(payload)
      }
    )
};
