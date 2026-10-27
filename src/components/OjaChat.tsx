import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  Bot,
  BriefcaseBusiness,
  Check,
  Copy,
  History,
  Lightbulb,
  MessageSquarePlus,
  Send,
  Sparkles,
  Store,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  WifiOff,
  X
} from 'lucide-react';

import type {
  BusinessProfile,
  StoreData
} from '../types';

import {
  localAnswer,
  businessSnapshot
} from '../lib/localChat';

import { copyText } from '../lib/clipboard';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

import './OjaChatMarkdown.css';
import './OjaChatHistory.css';

type Reaction =
  | 'like'
  | 'dislike'
  | null;

type Msg = {
  id: string;

  role:
    | 'user'
    | 'assistant';

  text: string;

  reaction?: Reaction;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Msg[];
};

const MAX_CONVERSATIONS = 25;
const MAX_MESSAGES_PER_CONVERSATION = 80;

function makeMessage(
  role: Msg['role'],
  text: string
): Msg {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    reaction: null
  };
}

function normalizeHref(
  href?: string
): string {
  if (!href) {
    return '#';
  }

  const value = href.trim();

  if (!value) {
    return '#';
  }

  if (
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('#')
  ) {
    return value;
  }

  if (
    value.startsWith('//')
  ) {
    return `https:${value}`;
  }

  if (
    value.startsWith('www.')
  ) {
    return `https://${value}`;
  }

  const domainPattern =
    /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+([/?#].*)?$/;

  if (
    domainPattern.test(value)
  ) {
    return `https://${value}`;
  }

  if (
    value.startsWith('/')
  ) {
    return value;
  }

  return value;
}

function createConversationTitle(
  question: string
): string {
  const cleaned =
    question
      .replace(/\s+/g, ' ')
      .trim();

  if (
    cleaned.length <= 48
  ) {
    return cleaned;
  }

  return `${cleaned
    .slice(0, 48)
    .trimEnd()}…`;
}

function hashStorageIdentity(
  value: string
): string {
  let hash = 2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^=
      value.charCodeAt(index);

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return (
    hash >>> 0
  ).toString(36);
}

function getStorageKey(
  business: BusinessProfile
): string {
  const identity = [
    business.businessName,
    business.phone,
    business.category
  ]
    .join('|')
    .toLowerCase()
    .trim();

  return `ojaflow:ojachat-history:v1:${hashStorageIdentity(
    identity
  )}`;
}

function isMessage(
  value: unknown
): value is Msg {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const message =
    value as Partial<Msg>;

  return (
    typeof message.id ===
      'string' &&
    (
      message.role ===
        'user' ||
      message.role ===
        'assistant'
    ) &&
    typeof message.text ===
      'string'
  );
}

function isConversation(
  value: unknown
): value is Conversation {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const conversation =
    value as Partial<Conversation>;

  return (
    typeof conversation.id ===
      'string' &&
    typeof conversation.title ===
      'string' &&
    typeof conversation.createdAt ===
      'string' &&
    typeof conversation.updatedAt ===
      'string' &&
    Array.isArray(
      conversation.messages
    )
  );
}

function loadConversations(
  storageKey: string
): Conversation[] {
  if (
    typeof window ===
    'undefined'
  ) {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        storageKey
      );

    if (!raw) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(raw);

    if (
      !Array.isArray(parsed)
    ) {
      return [];
    }

    return parsed
      .filter(isConversation)
      .map(conversation => ({
        ...conversation,

        messages:
          conversation.messages
            .filter(isMessage)
            .slice(
              -MAX_MESSAGES_PER_CONVERSATION
            )
      }))
      .sort(
        (a, b) =>
          new Date(
            b.updatedAt
          ).getTime() -
          new Date(
            a.updatedAt
          ).getTime()
      )
      .slice(
        0,
        MAX_CONVERSATIONS
      );
  } catch (error) {
    console.error(
      'Could not load OjaChat history',
      error
    );

    return [];
  }
}

function saveConversations(
  storageKey: string,
  conversations: Conversation[]
) {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(
        conversations
          .slice(
            0,
            MAX_CONVERSATIONS
          )
          .map(
            conversation => ({
              ...conversation,

              messages:
                conversation.messages
                  .slice(
                    -MAX_MESSAGES_PER_CONVERSATION
                  )
            })
          )
      )
    );
  } catch (error) {
    console.error(
      'Could not save OjaChat history',
      error
    );
  }
}

function formatConversationDate(
  value: string
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return date.toLocaleString(
    [],
    {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }
  );
}

const promptGroups = [
  {
    icon: Store,

    text:
      'How is my business doing today?'
  },

  {
    icon:
      BriefcaseBusiness,

    text:
      'Give me three practical ways to increase sales.'
  },

  {
    icon: Lightbulb,

    text:
      'Explain inflation simply.'
  },

  {
    icon: Sparkles,

    text:
      'Help me create a customer-retention plan.'
  }
];

export default function OjaChat({
  data,
  business,
  onClose
}: {
  data: StoreData;
  business: BusinessProfile;
  onClose: () => void;
}) {
  const {
    tr,
    language
  } = useI18n();

  const storageKey =
    useMemo(
      () =>
        getStorageKey(
          business
        ),

      [
        business.businessName,
        business.phone,
        business.category
      ]
    );

  function createGreeting() {
    return makeMessage(
      'assistant',

      tr(
        'Hi. I’m OjaChat, your intelligent assistant for {business}. Ask about your OjaFlow records, business strategy, or a general question.',
        {
          business:
            business.businessName
        }
      )
    );
  }

  const [
    conversations,
    setConversations
  ] =
    useState<
      Conversation[]
    >(
      () =>
        loadConversations(
          storageKey
        )
    );

  const [
    activeConversationId,
    setActiveConversationId
  ] =
    useState<
      string | null
    >(null);

  const [
    messages,
    setMessages
  ] =
    useState<Msg[]>(
      () => [
        createGreeting()
      ]
    );

  const [
    input,
    setInput
  ] =
    useState('');

  const [
    busy,
    setBusy
  ] =
    useState(false);

  const [
    copiedId,
    setCopiedId
  ] =
    useState<
      string | null
    >(null);

  const [
    historyOpen,
    setHistoryOpen
  ] =
    useState(false);

  const storageKeyRef =
    useRef(storageKey);

  const snapshot =
    useMemo(
      () =>
        businessSnapshot(
          data
        ),

      [data]
    );

  /*
   * If OjaChat is ever reused
   * for another business without
   * being unmounted, reload that
   * business's local chat history.
   */
  useEffect(
    () => {
      if (
        storageKeyRef.current ===
        storageKey
      ) {
        return;
      }

      storageKeyRef.current =
        storageKey;

      setConversations(
        loadConversations(
          storageKey
        )
      );

      setActiveConversationId(
        null
      );

      setMessages([
        createGreeting()
      ]);

      setHistoryOpen(
        false
      );

      setInput('');
    },

    [storageKey]
  );

  /*
   * Persist the conversation list
   * whenever it changes.
   */
  useEffect(
    () => {
      if (
        storageKeyRef.current !==
        storageKey
      ) {
        return;
      }

      saveConversations(
        storageKey,
        conversations
      );
    },

    [
      conversations,
      storageKey
    ]
  );

  /*
   * Keep the currently open
   * conversation synchronized
   * with its messages.
   */
  useEffect(
    () => {
      if (
        !activeConversationId
      ) {
        return;
      }

      setConversations(
        current => {
          const exists =
            current.some(
              conversation =>
                conversation.id ===
                activeConversationId
            );

          if (!exists) {
            return current;
          }

          const updated =
            current.map(
              conversation => {
                if (
                  conversation.id !==
                  activeConversationId
                ) {
                  return conversation;
                }

                return {
                  ...conversation,

                  updatedAt:
                    new Date()
                      .toISOString(),

                  messages:
                    messages.slice(
                      -MAX_MESSAGES_PER_CONVERSATION
                    )
                };
              }
            );

          return updated
            .sort(
              (a, b) =>
                new Date(
                  b.updatedAt
                ).getTime() -
                new Date(
                  a.updatedAt
                ).getTime()
            )
            .slice(
              0,
              MAX_CONVERSATIONS
            );
        }
      );
    },

    [
      messages,
      activeConversationId
    ]
  );

  async function copyMessage(
    message: Msg
  ) {
    try {
      await copyText(
        message.text
      );

      setCopiedId(
        message.id
      );

      window.setTimeout(
        () => {
          setCopiedId(
            current =>
              current ===
              message.id
                ? null
                : current
          );
        },

        1500
      );
    } catch (error) {
      console.error(
        'Copy failed',
        error
      );
    }
  }

  function reactTo(
    id: string,
    reaction: Exclude<
      Reaction,
      null
    >
  ) {
    setMessages(
      current =>
        current.map(
          message => {
            if (
              message.id !==
              id
            ) {
              return message;
            }

            return {
              ...message,

              reaction:
                message.reaction ===
                reaction
                  ? null
                  : reaction
            };
          }
        )
    );
  }

  function startNewChat() {
    if (busy) {
      return;
    }

    setActiveConversationId(
      null
    );

    setMessages([
      createGreeting()
    ]);

    setInput('');

    setHistoryOpen(
      false
    );

    setCopiedId(
      null
    );
  }

  function openConversation(
    conversation: Conversation
  ) {
    if (busy) {
      return;
    }

    setActiveConversationId(
      conversation.id
    );

    setMessages(
      conversation.messages
    );

    setInput('');

    setCopiedId(
      null
    );

    setHistoryOpen(
      false
    );
  }

  function deleteConversation(
    conversationId: string
  ) {
    const confirmed =
      window.confirm(
        tr(
          'Delete this OjaChat conversation?'
        )
      );

    if (!confirmed) {
      return;
    }

    setConversations(
      current =>
        current.filter(
          conversation =>
            conversation.id !==
            conversationId
        )
    );

    if (
      activeConversationId ===
      conversationId
    ) {
      setActiveConversationId(
        null
      );

      setMessages([
        createGreeting()
      ]);
    }
  }

  function clearHistory() {
    if (
      conversations.length ===
      0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        tr(
          'Delete all saved OjaChat conversations on this device?'
        )
      );

    if (!confirmed) {
      return;
    }

    setConversations([]);

    setActiveConversationId(
      null
    );

    setMessages([
      createGreeting()
    ]);

    setHistoryOpen(
      false
    );

    setCopiedId(
      null
    );
  }

  async function ask(
    text = input
  ) {
    const question =
      text.trim();

    if (
      !question ||
      busy
    ) {
      return;
    }

    const nextUser =
      makeMessage(
        'user',
        question
      );

    const historyBeforeQuestion =
      messages
        .slice(-8)
        .map(
          message => ({
            role:
              message.role,

            text:
              message.text
          })
        );

    let conversationId =
      activeConversationId;

    if (
      !conversationId
    ) {
      conversationId =
        crypto.randomUUID();

      const now =
        new Date()
          .toISOString();

      const newConversation:
        Conversation = {
        id:
          conversationId,

        title:
          createConversationTitle(
            question
          ),

        createdAt: now,
        updatedAt: now,

        messages: [
          ...messages,
          nextUser
        ].slice(
          -MAX_MESSAGES_PER_CONVERSATION
        )
      };

      setActiveConversationId(
        conversationId
      );

      setConversations(
        current => [
          newConversation,
          ...current
        ].slice(
          0,
          MAX_CONVERSATIONS
        )
      );
    }

    setMessages(
      current => [
        ...current,
        nextUser
      ]
    );

    setInput('');

    setHistoryOpen(
      false
    );

    setBusy(true);

    try {
      const local =
        localAnswer(
          question,
          data,
          language
        );

      if (local) {
        setMessages(
          current => [
            ...current,

            makeMessage(
              'assistant',
              local
            )
          ]
        );

        return;
      }

      if (
        !navigator.onLine
      ) {
        setMessages(
          current => [
            ...current,

            makeMessage(
              'assistant',

              tr(
                'You are offline. I can still answer questions calculated from records saved in OjaFlow. General questions need an internet connection.'
              )
            )
          ]
        );

        return;
      }

      const result =
        await api.ojaChat(
          question,
          snapshot,
          business,
          historyBeforeQuestion,
          language
        );

      setMessages(
        current => [
          ...current,

          makeMessage(
            'assistant',

            result.reply ||
              tr(
                'I could not generate a useful answer right now.'
              )
          )
        ]
      );
    } catch (error) {
      console.error(
        'OjaChat request failed',
        error
      );

      setMessages(
        current => [
          ...current,

          makeMessage(
            'assistant',

            tr(
              'I could not reach the online assistant right now. Questions about your saved OjaFlow records may still work, or you can try again shortly.'
            )
          )
        ]
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      className="chat-drawer"

      aria-label={tr(
        'OjaChat intelligent assistant'
      )}
    >
      <header className="chat-header">
        <div className="chat-title-wrap">
          <span className="chat-avatar">
            <Bot size={20} />
          </span>

          <div>
            <strong>
              OjaChat
            </strong>

            <small>
              {historyOpen
                ? tr(
                    'Conversation history'
                  )
                : tr(
                    'Store intelligence + general assistant'
                  )}
            </small>
          </div>
        </div>

        <div className="chat-header-actions">
          <button
            type="button"

            className={`icon-btn ${
              historyOpen
                ? 'active'
                : ''
            }`}

            onClick={() =>
              setHistoryOpen(
                current =>
                  !current
              )
            }

            title={tr(
              'Chat history'
            )}

            aria-label={tr(
              'Chat history'
            )}
          >
            <History
              size={19}
            />
          </button>

          <button
            type="button"

            className="icon-btn"

            onClick={
              startNewChat
            }

            disabled={busy}

            title={tr(
              'New chat'
            )}

            aria-label={tr(
              'Start a new OjaChat conversation'
            )}
          >
            <MessageSquarePlus
              size={19}
            />
          </button>

          <button
            type="button"

            className="icon-btn"

            onClick={
              onClose
            }

            aria-label={tr(
              'Close OjaChat'
            )}
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {historyOpen ? (
        <div className="ojachat-history">
          <div className="ojachat-history-head">
            <div>
              <strong>
                {tr(
                  'Your conversations'
                )}
              </strong>

              <small>
                {tr(
                  'Saved on this device'
                )}
              </small>
            </div>

            <button
              type="button"

              className="ojachat-new-chat"

              onClick={
                startNewChat
              }

              disabled={busy}
            >
              <MessageSquarePlus
                size={15}
              />

              <span>
                {tr(
                  'New chat'
                )}
              </span>
            </button>
          </div>

          {conversations.length ===
          0 ? (
            <div className="ojachat-history-empty">
              <History
                size={28}
              />

              <strong>
                {tr(
                  'No saved conversations yet'
                )}
              </strong>

              <p>
                {tr(
                  'Your OjaChat conversations will appear here after you start asking questions.'
                )}
              </p>

              <button
                type="button"

                className="primary-btn"

                onClick={
                  startNewChat
                }
              >
                <MessageSquarePlus
                  size={16}
                />

                {tr(
                  'Start a conversation'
                )}
              </button>
            </div>
          ) : (
            <>
              <div className="ojachat-history-list">
                {conversations.map(
                  conversation => {
                    const userMessages =
                      conversation.messages.filter(
                        message =>
                          message.role ===
                          'user'
                      ).length;

                    const isActive =
                      activeConversationId ===
                      conversation.id;

                    return (
                      <div
                        key={
                          conversation.id
                        }

                        className={`ojachat-history-item ${
                          isActive
                            ? 'active'
                            : ''
                        }`}
                      >
                        <button
                          type="button"

                          className="ojachat-history-open"

                          onClick={() =>
                            openConversation(
                              conversation
                            )
                          }
                        >
                          <span className="ojachat-history-title">
                            {
                              conversation.title
                            }
                          </span>

                          <span className="ojachat-history-meta">
                            {formatConversationDate(
                              conversation.updatedAt
                            )}

                            {' · '}

                            {userMessages}

                            {' '}

                            {userMessages ===
                            1
                              ? tr(
                                  'question'
                                )
                              : tr(
                                  'questions'
                                )}
                          </span>
                        </button>

                        <button
                          type="button"

                          className="ojachat-history-delete"

                          onClick={() =>
                            deleteConversation(
                              conversation.id
                            )
                          }

                          title={tr(
                            'Delete conversation'
                          )}

                          aria-label={tr(
                            'Delete conversation'
                          )}
                        >
                          <Trash2
                            size={15}
                          />
                        </button>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="ojachat-history-footer">
                <small>
                  {tr(
                    'OjaChat history is stored locally in this browser.'
                  )}
                </small>

                <button
                  type="button"

                  onClick={
                    clearHistory
                  }
                >
                  <Trash2
                    size={14}
                  />

                  {tr(
                    'Clear all'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="chat-mode-banner">
            <span className="online-dot" />

            <div>
              <strong>
                {activeConversationId
                  ? tr(
                      'Continuing saved conversation'
                    )
                  : tr(
                      'Ask naturally'
                    )}
              </strong>

              <small>
                {activeConversationId
                  ? tr(
                      'Previous messages in this conversation remain available as context.'
                    )
                  : tr(
                      'OjaChat can analyse your records or answer general questions online.'
                    )}
              </small>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map(
              message => (
                <div
                  key={
                    message.id
                  }

                  className={`message-wrap ${message.role}`}
                >
                  <div
                    className={`message ${message.role}`}
                  >
                    {message.role ===
                    'assistant' ? (
                      <div className="message-text ojachat-markdown">
                        <ReactMarkdown
                          remarkPlugins={[
                            remarkGfm
                          ]}

                          components={{
                            a: ({
                              children,
                              href,
                              ...props
                            }) => {
                              const safeHref =
                                normalizeHref(
                                  href
                                );

                              return (
                                <a
                                  {...props}

                                  href={
                                    safeHref
                                  }

                                  target="_blank"

                                  rel="noopener noreferrer"

                                  className="ojachat-link"

                                  title={
                                    safeHref
                                  }
                                >
                                  {
                                    children
                                  }
                                </a>
                              );
                            }
                          }}
                        >
                          {
                            message.text
                          }
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <span className="message-text">
                        {
                          message.text
                        }
                      </span>
                    )}
                  </div>

                  <div
                    className={`message-actions ${message.role}`}

                    aria-label={tr(
                      'Message actions'
                    )}
                  >
                    <button
                      type="button"

                      onClick={() =>
                        void copyMessage(
                          message
                        )
                      }

                      title={tr(
                        'Copy message'
                      )}

                      aria-label={tr(
                        'Copy message'
                      )}

                      className={
                        copiedId ===
                        message.id
                          ? 'active copied'
                          : ''
                      }
                    >
                      {copiedId ===
                      message.id ? (
                        <Check
                          size={14}
                        />
                      ) : (
                        <Copy
                          size={14}
                        />
                      )}

                      <span>
                        {copiedId ===
                        message.id
                          ? tr(
                              'Copied'
                            )
                          : tr(
                              'Copy'
                            )}
                      </span>
                    </button>

                    {message.role ===
                      'assistant' && (
                      <>
                        <button
                          type="button"

                          onClick={() =>
                            reactTo(
                              message.id,
                              'like'
                            )
                          }

                          className={
                            message.reaction ===
                            'like'
                              ? 'active'
                              : ''
                          }

                          title={tr(
                            'Helpful'
                          )}

                          aria-label={tr(
                            'Like OjaChat response'
                          )}
                        >
                          <ThumbsUp
                            size={14}
                          />
                        </button>

                        <button
                          type="button"

                          onClick={() =>
                            reactTo(
                              message.id,
                              'dislike'
                            )
                          }

                          className={
                            message.reaction ===
                            'dislike'
                              ? 'active'
                              : ''
                          }

                          title={tr(
                            'Not helpful'
                          )}

                          aria-label={tr(
                            'Dislike OjaChat response'
                          )}
                        >
                          <ThumbsDown
                            size={14}
                          />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            )}

            {busy && (
              <div className="message-wrap assistant">
                <div className="message assistant typing">
                  {tr(
                    'Thinking'
                  )}{' '}

                  <span>
                    •••
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="prompt-grid">
            {promptGroups.map(
              item => {
                const Icon =
                  item.icon;

                return (
                  <button
                    type="button"

                    key={
                      item.text
                    }

                    onClick={() =>
                      void ask(
                        tr(
                          item.text
                        )
                      )
                    }

                    disabled={
                      busy
                    }
                  >
                    <Icon
                      size={16}
                    />

                    <span>
                      {tr(
                        item.text
                      )}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          <form
            className="chat-input"

            onSubmit={
              event => {
                event.preventDefault();

                void ask();
              }
            }
          >
            <textarea
              rows={1}

              value={
                input
              }

              onChange={
                event =>
                  setInput(
                    event.target
                      .value
                  )
              }

              onKeyDown={
                event => {
                  if (
                    event.key ===
                      'Enter' &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();

                    void ask();
                  }
                }
              }

              placeholder={tr(
                'Ask OjaChat anything…'
              )}
            />

            <button
              type="submit"

              disabled={
                busy ||
                !input.trim()
              }

              aria-label={tr(
                'Send message'
              )}
            >
              <Send
                size={18}
              />
            </button>
          </form>

          {!navigator.onLine && (
            <div className="offline-note">
              <WifiOff
                size={14}
              />

              {tr(
                'Offline — OjaFlow record questions still work.'
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}