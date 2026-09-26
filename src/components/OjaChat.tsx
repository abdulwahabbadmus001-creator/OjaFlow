import { useMemo, useState } from 'react';
import {
  Bot,
  BriefcaseBusiness,
  Check,
  Copy,
  Lightbulb,
  Send,
  Sparkles,
  Store,
  ThumbsDown,
  ThumbsUp,
  WifiOff,
  X
} from 'lucide-react';
import type { BusinessProfile, StoreData } from '../types';
import { localAnswer, businessSnapshot } from '../lib/localChat';
import { copyText } from '../lib/clipboard';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

type Reaction = 'like' | 'dislike' | null;

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reaction?: Reaction;
};

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

const promptGroups = [
  {
    icon: Store,
    text: 'How is my business doing today?'
  },
  {
    icon: BriefcaseBusiness,
    text: 'Give me three practical ways to increase sales.'
  },
  {
    icon: Lightbulb,
    text: 'Explain inflation simply.'
  },
  {
    icon: Sparkles,
    text: 'Help me create a customer-retention plan.'
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
  const { tr, language } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([
    makeMessage(
      'assistant',
      tr('Hi. I’m OjaChat, your intelligent assistant for {business}. Ask about your OjaFlow records, business strategy, or a general question.', { business: business.businessName })
    )
  ]);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const snapshot = useMemo(
    () => businessSnapshot(data),
    [data]
  );

  async function copyMessage(message: Msg) {
    try {
      await copyText(message.text);
      setCopiedId(message.id);

      window.setTimeout(() => {
        setCopiedId(current =>
          current === message.id ? null : current
        );
      }, 1500);
    } catch (error) {
      console.error('Copy failed', error);
    }
  }

  function reactTo(
    id: string,
    reaction: Exclude<Reaction, null>
  ) {
    setMessages(current =>
      current.map(message => {
        if (message.id !== id) return message;

        return {
          ...message,
          reaction:
            message.reaction === reaction
              ? null
              : reaction
        };
      })
    );
  }

  async function ask(text = input) {
    const question = text.trim();

    if (!question || busy) return;

    const nextUser = makeMessage(
      'user',
      question
    );

    const historyBeforeQuestion = messages
      .slice(-8)
      .map(message => ({
        role: message.role,
        text: message.text
      }));

    setMessages(current => [
      ...current,
      nextUser
    ]);

    setInput('');
    setBusy(true);

    try {
      const local = localAnswer(
        question,
        data,
        language
      );

      if (local) {
        setMessages(current => [
          ...current,
          makeMessage('assistant', local)
        ]);
        return;
      }

      if (!navigator.onLine) {
        setMessages(current => [
          ...current,
          makeMessage(
            'assistant',
            tr('You are offline. I can still answer questions calculated from records saved in OjaFlow. General questions need an internet connection.')
          )
        ]);
        return;
      }

      const result = await api.ojaChat(
        question,
        snapshot,
        business,
        historyBeforeQuestion,
        language
      );

      setMessages(current => [
        ...current,
        makeMessage(
          'assistant',
          result.reply ||
            tr('I could not generate a useful answer right now.')
        )
      ]);
    } catch (error) {
      console.error(
        'OjaChat request failed',
        error
      );

      setMessages(current => [
        ...current,
        makeMessage(
          'assistant',
          tr('I could not reach the online assistant right now. Questions about your saved OjaFlow records may still work, or you can try again shortly.')
        )
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      className="chat-drawer"
      aria-label={tr('OjaChat intelligent assistant')}
    >
      <header className="chat-header">
        <div className="chat-title-wrap">
          <span className="chat-avatar">
            <Bot size={20} />
          </span>

          <div>
            <strong>OjaChat</strong>
            <small>
              {tr('Store intelligence + general assistant')}
            </small>
          </div>
        </div>

        <button
          className="icon-btn"
          onClick={onClose}
          aria-label={tr('Close OjaChat')}
        >
          <X size={20} />
        </button>
      </header>

      <div className="chat-mode-banner">
        <span className="online-dot" />

        <div>
          <strong>{tr('Ask naturally')}</strong>
          <small>
            {tr('OjaChat can analyse your records or answer general questions online.')}
          </small>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map(message => (
          <div
            key={message.id}
            className={`message-wrap ${message.role}`}
          >
            <div
              className={`message ${message.role}`}
            >
              <span className="message-text">
                {message.text}
              </span>
            </div>

            <div
              className={`message-actions ${message.role}`}
              aria-label={tr('Message actions')}
            >
              <button
                type="button"
                onClick={() => void copyMessage(message)}
                title={tr('Copy message')}
                aria-label={tr('Copy message')}
                className={
                  copiedId === message.id
                    ? 'active copied'
                    : ''
                }
              >
                {copiedId === message.id ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}
                <span>
                  {copiedId === message.id
                    ? tr('Copied')
                    : tr('Copy')}
                </span>
              </button>

              {message.role === 'assistant' && (
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
                      message.reaction === 'like'
                        ? 'active'
                        : ''
                    }
                    title={tr('Helpful')}
                    aria-label={tr('Like OjaChat response')}
                  >
                    <ThumbsUp size={14} />
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
                      message.reaction === 'dislike'
                        ? 'active'
                        : ''
                    }
                    title={tr('Not helpful')}
                    aria-label={tr('Dislike OjaChat response')}
                  >
                    <ThumbsDown size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="message-wrap assistant">
            <div className="message assistant typing">
              {tr('Thinking')} <span>•••</span>
            </div>
          </div>
        )}
      </div>

      <div className="prompt-grid">
        {promptGroups.map(item => {
          const Icon = item.icon;

          return (
            <button
              key={item.text}
              onClick={() => void ask(tr(item.text))}
              disabled={busy}
            >
              <Icon size={16} />
              <span>{tr(item.text)}</span>
            </button>
          );
        })}
      </div>

      <form
        className="chat-input"
        onSubmit={event => {
          event.preventDefault();
          void ask();
        }}
      >
        <textarea
          rows={1}
          value={input}
          onChange={event =>
            setInput(event.target.value)
          }
          onKeyDown={event => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey
            ) {
              event.preventDefault();
              void ask();
            }
          }}
          placeholder={tr('Ask OjaChat anything…')}
        />

        <button
          disabled={
            busy ||
            !input.trim()
          }
          aria-label={tr('Send message')}
        >
          <Send size={18} />
        </button>
      </form>

      {!navigator.onLine && (
        <div className="offline-note">
          <WifiOff size={14} />
          {tr('Offline — OjaFlow record questions still work.')}
        </div>
      )}
    </aside>
  );
}
