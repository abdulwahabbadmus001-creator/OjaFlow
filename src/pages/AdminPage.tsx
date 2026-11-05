import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  MessageSquareReply,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserX,
  Users
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { api, clearAdminCsrf } from '../lib/api';
import type {
  AdminAccount,
  AdminOverviewStats,
  AdminTicketRow,
  AdminUserRow
} from '../types';

const PIN_REGEX = /^\d{4}$/;

export default function AdminPage({
  onExitAdmin
}: {
  onExitAdmin: () => void;
}) {
  const [admin, setAdmin] = useState<AdminAccount | null>(null);
  const [checking, setChecking] = useState(true);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [tab, setTab] = useState<'users' | 'tickets'>('users');
  const [stats, setStats] = useState<AdminOverviewStats>({
    totalUsers: 0,
    activeUsers: 0,
    deactivatedUsers: 0,
    lockedUsers: 0,
    totalTickets: 0,
    openTickets: 0,
    answeredTickets: 0
  });
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketFilter, setTicketFilter] = useState<
    'all' | 'open' | 'answered' | 'closed'
  >('all');
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  // Per-user PIN reset state
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(
    null
  );

  // Per-ticket reply state
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingTicketId, setSendingTicketId] = useState<string | null>(null);

  useEffect(() => {
    void api
      .adminSession()
      .then(async res => {
        setAdmin(res.admin);
        await loadDashboard();
      })
      .catch(() => {
        clearAdminCsrf();
        setAdmin(null);
      })
      .finally(() => setChecking(false));
  }, []);

  async function loadDashboard() {
    setRefreshing(true);
    try {
      const overview = await api.adminOverview();
      setStats(overview.stats);
      setUsers(overview.users);
      setTickets(overview.tickets);
    } catch (e) {
      setFeedback({
        kind: 'error',
        text:
          e instanceof Error
            ? e.message
            : 'Could not load admin dashboard data.'
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');

    setLoginBusy(true);
    setLoginError('');

    try {
      const res = await api.adminLogin(email, password);
      setAdmin(res.admin);
      await loadDashboard();
    } catch (e) {
      setLoginError(
        e instanceof Error ? e.message : 'Admin authentication failed.'
      );
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await api.adminLogout();
    } catch {
      /* ignore */
    }
    clearAdminCsrf();
    setAdmin(null);
  }

  async function handleUnlockUser(user: AdminUserRow) {
    setFeedback(null);
    try {
      const res = await api.adminUnlockUser(user.uid);
      setUsers(prev =>
        prev.map(item => (item.uid === user.uid ? res.user : item))
      );
      setFeedback({
        kind: 'success',
        text: `Unlocked ${user.firstName} ${user.lastName} (${user.ojaTag || user.phoneNumber}).`
      });
      await loadDashboard();
    } catch (e) {
      setFeedback({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Could not unlock account.'
      });
    }
  }

  async function handleResetPin(user: AdminUserRow) {
    if (!PIN_REGEX.test(newPinValue)) {
      setFeedback({
        kind: 'error',
        text: 'New PIN must be exactly 4 digits (0-9).'
      });
      return;
    }
    setFeedback(null);
    try {
      const res = await api.adminResetUserPin(user.uid, newPinValue);
      setUsers(prev =>
        prev.map(item => (item.uid === user.uid ? res.user : item))
      );
      setResettingUserId(null);
      setNewPinValue('');
      setFeedback({
        kind: 'success',
        text: `Reset 4-digit PIN for ${user.firstName} ${user.lastName} and notified their dashboard.`
      });
    } catch (e) {
      setFeedback({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Could not reset PIN.'
      });
    }
  }

  async function handleToggleActive(user: AdminUserRow) {
    setFeedback(null);
    try {
      const res = await api.adminUpdateUserStatus(user.uid, !user.isActive);
      setUsers(prev =>
        prev.map(item => (item.uid === user.uid ? res.user : item))
      );
      setFeedback({
        kind: 'success',
        text: `${res.user.isActive ? 'Activated' : 'Deactivated'} ${user.firstName} ${user.lastName}.`
      });
      await loadDashboard();
    } catch (e) {
      setFeedback({
        kind: 'error',
        text:
          e instanceof Error ? e.message : 'Could not update account status.'
      });
    }
  }

  async function handleDeleteUser(user: AdminUserRow) {
    setFeedback(null);
    try {
      await api.adminDeleteUser(user.uid);
      setConfirmDeleteUserId(null);
      setFeedback({
        kind: 'success',
        text: `Permanently deleted account ${user.firstName} ${user.lastName} (${user.ojaTag || user.phoneNumber}).`
      });
      await loadDashboard();
    } catch (e) {
      setFeedback({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Could not delete account.'
      });
    }
  }

  async function handleReplyTicket(
    ticket: AdminTicketRow,
    nextStatus: 'answered' | 'closed' = 'answered'
  ) {
    const draft = (replyDrafts[ticket.id] ?? ticket.adminReply ?? '').trim();
    if (draft.length < 2) {
      setFeedback({
        kind: 'error',
        text: 'Type a response of at least 2 characters before sending.'
      });
      return;
    }

    setSendingTicketId(ticket.id);
    setFeedback(null);
    try {
      const res = await api.adminReplyTicket(ticket.id, draft, nextStatus);
      setTickets(prev =>
        prev.map(item => (item.id === ticket.id ? res.ticket : item))
      );
      setFeedback({
        kind: 'success',
        text: `Reply sent to ${ticket.userName}. It will appear as an instant notification banner on their OjaFlow screen.`
      });
      await loadDashboard();
    } catch (e) {
      setFeedback({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Could not send support reply.'
      });
    } finally {
      setSendingTicketId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      u =>
        u.phoneNumber.toLowerCase().includes(q) ||
        u.ojaTag.toLowerCase().includes(q) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.businessName || '').toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const filteredTickets = useMemo(() => {
    if (ticketFilter === 'all') return tickets;
    return tickets.filter(t => t.status === ticketFilter);
  }, [tickets, ticketFilter]);

  if (checking) {
    return (
      <div className="splash">
        <BrandLogo />
        <small>Verifying OjaFlow Admin Console session…</small>
      </div>
    );
  }

  if (!admin) {
    return (
      <main className="admin-login-screen">
        <div className="admin-login-card">
          <button
            type="button"
            className="back-btn"
            onClick={onExitAdmin}
          >
            <ArrowLeft size={17} /> Back to Trader App
          </button>

          <div className="admin-login-header">
            <div className="admin-shield-badge">
              <ShieldCheck size={24} />
            </div>
            <span className="eyebrow">ENTERPRISE SYSTEM CONSOLE</span>
            <h1>OjaFlow Admin Portal</h1>
            <p className="muted">
              Sign in with your environment-provisioned system administrator
              credentials (<code>ADMIN_EMAIL</code> &amp;{' '}
              <code>ADMIN_PASSWORD</code>).
            </p>
          </div>

          <form className="form-stack" onSubmit={handleLogin}>
            <label>
              System Admin Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="admin@system.ojaflow.internal"
                required
              />
            </label>

            <label>
              System Admin Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                required
              />
            </label>

            {loginError && <div className="form-error">{loginError}</div>}

            <button
              type="submit"
              disabled={loginBusy}
              className="primary-btn full"
            >
              <Lock size={17} />
              {loginBusy ? 'Authenticating…' : 'Sign in to Admin Console'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="admin-console-shell">
      <header className="admin-console-topbar">
        <div className="admin-console-brand">
          <BrandLogo compact subtitle="Enterprise Administration Suite" />
          <span className="admin-role-pill">
            <ShieldCheck size={14} /> ROLE: {admin.role.toUpperCase()}
          </span>
        </div>

        <div className="admin-console-actions">
          <span className="admin-email-tag">{admin.email}</span>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => void loadDashboard()}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={onExitAdmin}
          >
            <ArrowLeft size={16} /> Trader View
          </button>

          <button
            type="button"
            className="secondary-btn danger-text"
            onClick={() => void handleLogout()}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </header>

      <main className="admin-console-main">
        <section className="admin-kpi-grid">
          <article className="admin-kpi-card">
            <span>Total Registered Traders</span>
            <strong>{stats.totalUsers}</strong>
            <small>{stats.activeUsers} active accounts</small>
          </article>

          <article className="admin-kpi-card">
            <span>Locked Trader Accounts</span>
            <strong className={stats.lockedUsers > 0 ? 'danger-text' : ''}>
              {stats.lockedUsers}
            </strong>
            <small>PIN or security-answer lockouts</small>
          </article>

          <article className="admin-kpi-card">
            <span>Open Support Requests</span>
            <strong className={stats.openTickets > 0 ? 'amber-text' : ''}>
              {stats.openTickets}
            </strong>
            <small>{stats.answeredTickets} answered tickets</small>
          </article>

          <article className="admin-kpi-card">
            <span>Deactivated Accounts</span>
            <strong>{stats.deactivatedUsers}</strong>
            <small>Flagged or suspended traders</small>
          </article>
        </section>

        {feedback && (
          <div
            className={
              feedback.kind === 'error' ? 'form-error' : 'inline-status'
            }
            role="status"
          >
            {feedback.text}
          </div>
        )}

        <div className="admin-tabs">
          <button
            type="button"
            className={tab === 'users' ? 'active' : ''}
            onClick={() => setTab('users')}
          >
            <Users size={17} /> Trader Accounts ({users.length})
          </button>

          <button
            type="button"
            className={tab === 'tickets' ? 'active' : ''}
            onClick={() => setTab('tickets')}
          >
            <MessageSquareReply size={17} /> Help &amp; Support Tickets (
            {tickets.length})
          </button>
        </div>

        {tab === 'users' ? (
          <section className="panel admin-panel">
            <div className="admin-toolbar">
              <div>
                <h2>Registered Market Traders</h2>
                <p className="muted">
                  Search by phone number, OjaTag, trader name, or shop name.
                  Unlock locked accounts, reset 4-digit PINs, or manage account
                  access.
                </p>
              </div>

              <div className="admin-search-box">
                <Search size={17} />
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search phone (+234...), OJA-XXXX-XXXX, or name…"
                />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="empty-state">
                No trader accounts match your search.
              </div>
            ) : (
              <div className="admin-user-list">
                {filteredUsers.map(u => {
                  const isLocked = u.isPinLocked || u.isRecoveryLocked;
                  return (
                    <article key={u.uid} className="admin-user-card">
                      <div className="admin-user-main">
                        <div className="admin-user-title">
                          <strong>
                            {u.firstName} {u.lastName}
                          </strong>
                          <span className="admin-code-chip">
                            {u.ojaTag || 'No OjaTag'}
                          </span>
                          <span className="admin-code-chip">
                            {u.phoneNumber}
                          </span>
                          <span
                            className={`status-badge ${
                              u.isActive ? 'green' : 'amber'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                          {isLocked && (
                            <span className="status-badge red">
                              <ShieldAlert size={13} /> Locked
                            </span>
                          )}
                        </div>

                        <div className="admin-user-meta">
                          <span>
                            Shop:{' '}
                            <b>{u.businessName || 'Onboarding incomplete'}</b>
                          </span>
                          <span>
                            Language: <b>{u.preferredLanguage.toUpperCase()}</b>
                          </span>
                          <span>
                            Failed PIN attempts: <b>{u.failedPinAttempts}</b>
                          </span>
                          <span>
                            Failed Recovery attempts:{' '}
                            <b>{u.failedRecoveryAttempts}</b>
                          </span>
                        </div>

                        {u.securityQuestion && (
                          <small className="muted">
                            Security Question: &ldquo;{u.securityQuestion}&rdquo;
                          </small>
                        )}
                      </div>

                      <div className="admin-user-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => void handleUnlockUser(u)}
                          title="Clear PIN and recovery lockouts"
                        >
                          <Unlock size={15} /> Unlock
                        </button>

                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            setResettingUserId(
                              resettingUserId === u.uid ? null : u.uid
                            );
                            setNewPinValue('');
                          }}
                        >
                          <KeyRound size={15} /> Reset PIN
                        </button>

                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => void handleToggleActive(u)}
                        >
                          {u.isActive ? (
                            <>
                              <UserX size={15} /> Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck size={15} /> Activate
                            </>
                          )}
                        </button>

                        {confirmDeleteUserId === u.uid ? (
                          <div className="admin-inline-confirm">
                            <button
                              type="button"
                              className="primary-btn danger-btn"
                              onClick={() => void handleDeleteUser(u)}
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => setConfirmDeleteUserId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="secondary-btn danger-text"
                            onClick={() => setConfirmDeleteUserId(u.uid)}
                          >
                            <Trash2 size={15} /> Delete
                          </button>
                        )}
                      </div>

                      {resettingUserId === u.uid && (
                        <div className="admin-pin-reset-drawer">
                          <label>
                            New 4-digit PIN for {u.firstName} ({u.phoneNumber})
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="\d{4}"
                              maxLength={4}
                              placeholder="e.g. 2468"
                              value={newPinValue}
                              onChange={event =>
                                setNewPinValue(
                                  event.target.value
                                    .replace(/\D/g, '')
                                    .slice(0, 4)
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="primary-btn"
                            disabled={newPinValue.length !== 4}
                            onClick={() => void handleResetPin(u)}
                          >
                            Save 4-Digit PIN
                          </button>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => setResettingUserId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="panel admin-panel">
            <div className="admin-toolbar">
              <div>
                <h2>Trader Support Requests &amp; Direct Notifications</h2>
                <p className="muted">
                  Reply directly to any trader&apos;s question or complaint. Your
                  response is delivered immediately as a notification banner on
                  their OjaFlow screen.
                </p>
              </div>

              <div className="admin-filter-pills">
                {(['all', 'open', 'answered', 'closed'] as const).map(
                  statusOption => (
                    <button
                      type="button"
                      key={statusOption}
                      className={
                        ticketFilter === statusOption ? 'active' : ''
                      }
                      onClick={() => setTicketFilter(statusOption)}
                    >
                      {statusOption.toUpperCase()}
                    </button>
                  )
                )}
              </div>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="empty-state">
                No support tickets in this view.
              </div>
            ) : (
              <div className="admin-ticket-list">
                {filteredTickets.map(ticket => {
                  const draftValue =
                    replyDrafts[ticket.id] ?? ticket.adminReply ?? '';
                  return (
                    <article key={ticket.id} className="admin-ticket-card">
                      <div className="admin-ticket-top">
                        <div>
                          <span className="eyebrow">{ticket.category}</span>
                          <h3>{ticket.subject}</h3>
                          <small className="muted">
                            From <strong>{ticket.userName}</strong> •{' '}
                            {ticket.userPhone} •{' '}
                            {ticket.userOjaTag || 'No OjaTag'}
                            {ticket.businessName
                              ? ` • Shop: ${ticket.businessName}`
                              : ''}
                          </small>
                        </div>

                        <span
                          className={`status-badge ${
                            ticket.status === 'answered'
                              ? 'green'
                              : ticket.status === 'closed'
                                ? 'neutral'
                                : 'amber'
                          }`}
                        >
                          {ticket.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="admin-ticket-message">
                        {ticket.message}
                      </div>

                      <div className="admin-ticket-reply-box">
                        <label>
                          Direct Admin Response (pushes instant banner to{' '}
                          {ticket.userName}&apos;s OjaFlow dashboard)
                          <textarea
                            rows={3}
                            value={draftValue}
                            onChange={event =>
                              setReplyDrafts(prev => ({
                                ...prev,
                                [ticket.id]: event.target.value
                              }))
                            }
                            placeholder="Type your helpful response to this trader…"
                          />
                        </label>

                        <div className="admin-ticket-actions">
                          <button
                            type="button"
                            className="primary-btn"
                            disabled={sendingTicketId === ticket.id}
                            onClick={() =>
                              void handleReplyTicket(ticket, 'answered')
                            }
                          >
                            <CheckCircle2 size={16} />
                            {sendingTicketId === ticket.id
                              ? 'Sending…'
                              : 'Send Reply & Notify Trader'}
                          </button>

                          <button
                            type="button"
                            className="secondary-btn"
                            disabled={sendingTicketId === ticket.id}
                            onClick={() =>
                              void handleReplyTicket(ticket, 'closed')
                            }
                          >
                            Reply &amp; Close Ticket
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

