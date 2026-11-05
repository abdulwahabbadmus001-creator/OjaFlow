import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguagePreference } from '../types';

export const SPEECH_LANG_MAP: Record<LanguagePreference, string> = {
  en: 'en-NG',
  pcm: 'pcm-NG',
  yo: 'yo-NG',
  ha: 'ha-NG',
  ig: 'ig-NG'
};

export const SPEECH_LANG_LABELS: Record<LanguagePreference, string> = {
  en: 'English (en-NG)',
  pcm: 'Naija Pidgin (pcm-NG)',
  yo: 'Yorùbá (yo-NG)',
  ha: 'Hausa (ha-NG)',
  ig: 'Igbo (ig-NG)'
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type SpeechToastKind = 'permission' | 'unsupported' | 'info';

export interface SpeechToast {
  kind: SpeechToastKind;
  title: string;
  message: string;
}

type LocalizedSpeechCopy = {
  listeningTitle: string;
  listeningHint: string;
  unsupportedTitle: string;
  unsupportedMessage: string;
  insecureTitle: string;
  insecureMessage: string;
  permissionTitle: string;
  permissionPwaMessage: string;
  permissionBrowserMessage: string;
  noMicTitle: string;
  noMicMessage: string;
  noSpeechTitle: string;
  noSpeechMessage: string;
  networkTitle: string;
  networkMessage: string;
};

const SPEECH_COPY: Record<LanguagePreference, LocalizedSpeechCopy> = {
  en: {
    listeningTitle: 'Listening... Speak now in your language',
    listeningHint: 'Tap the mic again when you finish speaking.',
    unsupportedTitle: 'Voice input unavailable on this browser',
    unsupportedMessage:
      'Speech recognition is not supported in this mobile view. Please use Chrome on Android, Safari on iOS, or type your question in the box below.',
    insecureTitle: 'HTTPS required for voice input',
    insecureMessage:
      'Microphone access in PWA mode requires a secure HTTPS connection (or localhost). You can continue typing normally below.',
    permissionTitle: 'Microphone permission needed',
    permissionPwaMessage:
      'Microphone access is blocked for OjaFlow PWA. Open your phone Settings → Apps → OjaFlow (or Browser Site Settings) → Permissions → Allow Microphone, or type your message below.',
    permissionBrowserMessage:
      'Microphone access was blocked. Tap the lock/site icon in your address bar to allow Microphone access, or continue typing below.',
    noMicTitle: 'No microphone detected',
    noMicMessage:
      'We could not access your device microphone. Please check that another app is not using the mic, or type your message below.',
    noSpeechTitle: 'No voice heard',
    noSpeechMessage:
      'We did not hear any speech. Tap the microphone button and speak clearly close to your phone, or type your message below.',
    networkTitle: 'Network needed for voice transcription',
    networkMessage:
      'Mobile speech recognition needs an active connection to transcribe voice. Please check your data connection or type your question below (offline record queries still work by typing!).'
  },
  pcm: {
    listeningTitle: 'I dey listen... Talk now for your language',
    listeningHint: 'Tap di mic button again wen you don finish talk.',
    unsupportedTitle: 'Voice typing no dey work for dis browser',
    unsupportedMessage:
      'Dis browser no support voice mic. Abeg use Chrome for Android or Safari for iPhone, or just type your question for inside di box below.',
    insecureTitle: 'Secure connection needed for mic',
    insecureMessage:
      'Microphone for PWA need secure HTTPS connection. No wahala, you fit type your message sharp-sharp for di box below.',
    permissionTitle: 'Abeg allow Microphone permission',
    permissionPwaMessage:
      'Microphone permission dey blocked for OjaFlow app. Go your phone Settings → Apps → OjaFlow (or Site Settings) → Permissions → Allow Microphone, or just type your message below.',
    permissionBrowserMessage:
      'Microphone dey blocked. Tap di lock icon for top of your browser make you Allow Microphone, or type your question for di box below.',
    noMicTitle: 'We no see microphone',
    noMicMessage:
      'Phone microphone no gree open. Check say anoda call or app no dey hold am, or type your message below.',
    noSpeechTitle: 'We no hear wetin you talk',
    noSpeechMessage:
      'No voice enter. Tap di microphone button again make you talk loud small near your phone, or type your question below.',
    networkTitle: 'Network needed for voice mic',
    networkMessage:
      'Voice-to-text need small data connection to write wetin you talk. You fit type your question below — OjaChat offline record check still dey work well!'
  },
  yo: {
    listeningTitle: 'Mo ń tẹ́tí... Sọ̀rọ̀ báyìí ní èdè rẹ',
    listeningHint: 'Tẹ bọ́tìnì ماikirofóònù náà lẹ́ẹ̀kan sí i nígbà tí o bá parí ọ̀rọ̀.',
    unsupportedTitle: ' Ohùn kò ṣiṣẹ́ lórí aṣàwákiri yìí',
    unsupportedMessage:
      'Aṣàwákiri yìí kò ṣètìlẹ́yìn fún ohùn sí ọ̀rọ̀. Jọ̀wọ́ lo Chrome lórí Android tàbí Safari lórí iPhone, tàbí kí o tẹ ìbéèrè rẹ sí àpótí ìsàlẹ̀.',
    insecureTitle: 'A nílò ìsopọ̀ HTTPS tó dájú',
    insecureMessage:
      'Maikirofóònù nínú PWA nílò HTTPS. O lè tẹ ìbéèrè rẹ sí àpótí ìsàlẹ̀ láìsí ìṣòro.',
    permissionTitle: 'Jọ̀wọ́ gba ààyè Maikirofóònù láàyè',
    permissionPwaMessage:
      'A ti dènà maikirofóònù fún OjaFlow PWA. Lọ sí Settings fóònù rẹ → Apps → OjaFlow → Permissions → Gba Microphone láàyè, tàbí kí o tẹ ọ̀rọ̀ rẹ sí ìsàlẹ̀.',
    permissionBrowserMessage:
      'A dènà maikirofóònù. Tẹ àmì ààbò ní òkè aṣàwákiri rẹ láti gba Microphone láàyè, tàbí kí o tẹ ọ̀rọ̀ rẹ sí ìsàlẹ̀.',
    noMicTitle: 'A kò rí maikirofóònù',
    noMicMessage:
      'A kò lè lo maikirofóònù fóònù rẹ. Rí i dájú pé ètò mìíràn kò lo ó, tàbí kí o tẹ ọ̀rọ̀ rẹ sí ìsàlẹ̀.',
    noSpeechTitle: 'A kò gbọ́ ohùn kankan',
    noSpeechMessage:
      'A kò gbọ́ ohun tí o sọ. Tẹ bọ́tìnì maikirofóònù kí o sì sọ̀rọ̀ ketekete, tàbí kí o tẹ ìbéèrè rẹ sí ìsàlẹ̀.',
    networkTitle: 'A nílò intanẹ́ẹ̀tì fún ohùn sí ọ̀rọ̀',
    networkMessage:
      'Ohùn sí ọ̀rọ̀ nílò intanẹ́ẹ̀tì. Jọ̀wọ́ ṣàyẹ̀wò dátà rẹ tàbí kí o tẹ ìbéèrè rẹ sí àpótí ìsàlẹ̀.'
  },
  ha: {
    listeningTitle: 'Ina sauraro... Yi magana yanzu da harshenka',
    listeningHint: 'Danna maɓallin makirfo ɗin idan ka gama magana.',
    unsupportedTitle: 'Magana da murya ba ta aiki a wannan burauza',
    unsupportedMessage:
      'Wannan burauzar ba ta goyan bayan rubutu da murya. Yi amfani da Chrome a Android ko Safari a iPhone, ko ka rubuta tambayarka a ƙasa.',
    insecureTitle: 'Ana buƙatar haɗin HTTPS',
    insecureMessage:
      'Makirfo a PWA yana buƙatar HTTPS. Za ka iya ci gaba da rubuta tambayarka a akwatin da ke ƙasa.',
    permissionTitle: 'Ana buƙatar izinin Makirfo (Microphone)',
    permissionPwaMessage:
      'An toshe makirfo a OjaFlow PWA. Shiga Settings na wayarka → Apps → OjaFlow → Permissions → Ba da izinin Microphone, ko ka rubuta saƙonka a ƙasa.',
    permissionBrowserMessage:
      'An hana izinin makirfo. Danna alamar makulli a saman burauza don ba da izinin Microphone, ko ka rubuta tambayarka a ƙasa.',
    noMicTitle: 'Ba a sami makirfo ba',
    noMicMessage:
      'Ba mu iya buɗe makirfon wayarka ba. Duba ko wata manhaja tana amfani da shi, ko ka rubuta saƙonka a ƙasa.',
    noSpeechTitle: 'Ba a ji murya ba',
    noSpeechMessage:
      'Ba mu ji abin da ka faɗa ba. Danna makirfo ka yi magana a fili kusa da wayarka, ko ka rubuta tambayarka a ƙasa.',
    networkTitle: 'Ana buƙatar intanet don juya murya zuwa rubutu',
    networkMessage:
      'Juya murya zuwa rubutu yana buƙatar data. Duba haɗin intanet ko ka rubuta tambayarka a ƙasa.'
  },
  ig: {
    listeningTitle: 'Ana m ege ntị... Kwuo okwu ugbu a n’asụsụ gị',
    listeningHint: 'Pịa bọtịnụ igwe okwu ọzọ mgbe ị kwuchara okwu.',
    unsupportedTitle: 'Iji olu ede ihe anaghị arụ ọrụ na bọraụza a',
    unsupportedMessage:
      'Bọraụza a anaghị akwado iji olu ede ihe. Biko jiri Chrome na Android ma ọ bụ Safari na iPhone, ma ọ bụ pịa ajụjụ gị n’igbe dị n’okpuru.',
    insecureTitle: 'Achọrọ njikọ HTTPS maka igwe okwu',
    insecureMessage:
      'Igwe okwu na PWA chọrọ njikọ HTTPS. Ị nwere ike ịga n’ihu pịa ozi gị n’igbe dị n’okpuru.',
    permissionTitle: 'Biko nye ikike Igwe Okwu (Microphone)',
    permissionPwaMessage:
      'Egbochiri igwe okwu maka OjaFlow PWA. Gaa na Settings ekwentị gị → Apps → OjaFlow → Permissions → Kwe ka Microphone rụọ ọrụ, ma ọ bụ pịa ozi gị n’okpuru.',
    permissionBrowserMessage:
      'Egbochiri igwe okwu. Pịa akara mkpọchi dị n’elu bọraụza gị ka ị nye ikike Microphone, ma ọ bụ pịa ajụjụ gị n’okpuru.',
    noMicTitle: 'Ahụghị igwe okwu ọ bụla',
    noMicMessage:
      'Anyị enweghị ike ịnweta igwe okwu ekwentị gị. Lelee ma ngwa ọzọ ọ na-eji ya, ma ọ bụ pịa ozi gị n’okpuru.',
    noSpeechTitle: 'Anụghị olu ọ bụla',
    noSpeechMessage:
      'Anyị anụghị ihe ị kwuru. Pịa bọtịnụ igwe okwu ọzọ ma kwuo okwu nke ọma nso n’ekwentị gị, ma ọ bụ pịa ajụjụ gị n’okpuru.',
    networkTitle: 'Achọrọ ịntanetị maka ịtụgharị olu gaa n’ederede',
    networkMessage:
      'Ịtụgharị olu chọrọ ịntanetị. Biko lelee data gị ma ọ bụ pịa ajụjụ gị n’igbe dị n’okpuru.'
  }
};

export function isStandalonePwaEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const standaloneDisplay =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
    window.matchMedia?.('(display-mode: minimal-ui)')?.matches;
  const iosStandalone = Boolean(( window.navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(standaloneDisplay || iosStandalone);
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Plays a gentle, zero-dependency Web Audio feedback tone when starting/stopping
 * speech recognition so market traders get clear audio confirmation on mobile PWAs.
 */
function playAudioCue(type: 'start' | 'stop' | 'error'): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(type === 'error' ? [40, 40, 40] : 25);
    }
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    const now = ctx.currentTime;
    if (type === 'start') {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.11);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'stop') {
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } else {
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.16);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    }

    setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 250);
  } catch {
    // Ignore audio context restrictions on strict mobile webviews
  }
}

export function useSpeechToText({
  language,
  onTranscriptChange,
  onSpeechEnd
}: {
  language: LanguagePreference;
  onTranscriptChange: (nextText: string) => void;
  onSpeechEnd?: () => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [toast, setToast] = useState<SpeechToast | null>(null);
  const [isStandalonePwa, setIsStandalonePwa] = useState<boolean>(() =>
    isStandalonePwaEnvironment()
  );

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseTextRef = useRef<string>('');
  const committedSessionTextRef = useRef<string>('');
  const fallbackAttemptedRef = useRef<boolean>(false);
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onSpeechEndRef = useRef(onSpeechEnd);

  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd;
  }, [onSpeechEnd]);

  const isSupported = Boolean(getSpeechRecognitionConstructor());
  const speechLang = SPEECH_LANG_MAP[language] || 'en-NG';
  const speechLangLabel = SPEECH_LANG_LABELS[language] || SPEECH_LANG_LABELS.en;
  const copy = SPEECH_COPY[language] || SPEECH_COPY.en;

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const handleChange = () => setIsStandalonePwa(isStandalonePwaEnvironment());
    mediaQuery?.addEventListener?.('change', handleChange);
    return () => {
      mediaQuery?.removeEventListener?.('change', handleChange);
    };
  }, []);

  // Auto-dismiss informational/permission toasts after 8 seconds
  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 8500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Clean up recognizer on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const stopListening = useCallback(() => {
    const instance = recognitionRef.current;
    if (instance) {
      try {
        instance.stop();
      } catch {
        try {
          instance.abort();
        } catch {
          // ignore
        }
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const launchRecognizer = useCallback(
    (langCode: string, currentInputText: string) => {
      const Ctor = getSpeechRecognitionConstructor();
      if (!Ctor) {
        playAudioCue('error');
        setToast({
          kind: 'unsupported',
          title: copy.unsupportedTitle,
          message: copy.unsupportedMessage
        });
        onSpeechEndRef.current?.();
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      const recognition = new Ctor();
      recognitionRef.current = recognition;

      // Mobile PWA optimization:
      // continuous=false prevents duplicate phrase echoing on Android Chrome WebAPK
      // while interimResults=true streams words into the composer input box in real time.
      recognition.lang = langCode;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      baseTextRef.current = currentInputText.trim();
      committedSessionTextRef.current = '';

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
        setToast(null);
        playAudioCue('start');
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcriptPiece = result?.[0]?.transcript || '';
          if (result.isFinal) {
            finalChunk += transcriptPiece;
          } else {
            interimChunk += transcriptPiece;
          }
        }

        if (finalChunk.trim()) {
          committedSessionTextRef.current = [
            committedSessionTextRef.current,
            finalChunk.trim()
          ]
            .filter(Boolean)
            .join(' ');
        }

        setInterimTranscript(interimChunk.trim());

        const combined = [
          baseTextRef.current,
          committedSessionTextRef.current,
          interimChunk.trim()
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        onTranscriptChangeRef.current(combined);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const errorCode = (event.error || '').toLowerCase();

        // If a mobile speech engine does not recognize 'pcm-NG' (or another dialect tag),
        // seamlessly retry once with 'en-NG' so Nigerian traders never hit a dead end.
        if (
          (errorCode === 'language-not-supported' || errorCode === 'bad-grammar') &&
          langCode !== 'en-NG' &&
          !fallbackAttemptedRef.current
        ) {
          fallbackAttemptedRef.current = true;
          try {
            recognition.abort();
          } catch {
            // ignore
          }
          launchRecognizer('en-NG', baseTextRef.current);
          return;
        }

        setIsListening(false);
        setInterimTranscript('');

        if (errorCode === 'aborted') {
          return;
        }

        playAudioCue('error');

        if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
          setToast({
            kind: 'permission',
            title: copy.permissionTitle,
            message: isStandalonePwa
              ? copy.permissionPwaMessage
              : copy.permissionBrowserMessage
          });
        } else if (errorCode === 'audio-capture') {
          setToast({
            kind: 'permission',
            title: copy.noMicTitle,
            message: copy.noMicMessage
          });
        } else if (errorCode === 'no-speech') {
          setToast({
            kind: 'info',
            title: copy.noSpeechTitle,
            message: copy.noSpeechMessage
          });
        } else if (errorCode === 'network') {
          setToast({
            kind: 'info',
            title: copy.networkTitle,
            message: copy.networkMessage
          });
        } else {
          setToast({
            kind: 'unsupported',
            title: copy.unsupportedTitle,
            message: copy.unsupportedMessage
          });
        }

        onSpeechEndRef.current?.();
      };

      recognition.onend = () => {
        const wasListening = recognitionRef.current === recognition;
        setIsListening(false);
        setInterimTranscript('');
        if (wasListening) {
          recognitionRef.current = null;
          if (committedSessionTextRef.current) {
            playAudioCue('stop');
          }
          onSpeechEndRef.current?.();
        }
      };

      try {
        recognition.start();
      } catch {
        setIsListening(false);
        setInterimTranscript('');
        playAudioCue('error');
        setToast({
          kind: 'permission',
          title: copy.permissionTitle,
          message: isStandalonePwa
            ? copy.permissionPwaMessage
            : copy.permissionBrowserMessage
        });
        onSpeechEndRef.current?.();
      }
    },
    [copy, isStandalonePwa]
  );

  const startListening = useCallback(
    (currentInputText = '') => {
      if (typeof window === 'undefined') {
        return;
      }

      // Check secure context required by mobile PWAs
      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      if (!window.isSecureContext && !isLocalhost) {
        playAudioCue('error');
        setToast({
          kind: 'permission',
          title: copy.insecureTitle,
          message: copy.insecureMessage
        });
        onSpeechEndRef.current?.();
        return;
      }

      const Ctor = getSpeechRecognitionConstructor();
      if (!Ctor) {
        playAudioCue('error');
        setToast({
          kind: 'unsupported',
          title: copy.unsupportedTitle,
          message: copy.unsupportedMessage
        });
        onSpeechEndRef.current?.();
        return;
      }

      // Invoke recognition.start() synchronously within the user tap gesture
      // so iOS Safari PWA and Android Chrome standalone WebAPK preserve gesture activation.
      fallbackAttemptedRef.current = false;
      launchRecognizer(speechLang, currentInputText);
    },
    [copy, launchRecognizer, speechLang]
  );

  const toggleListening = useCallback(
    (currentInputText = '') => {
      if (isListening) {
        playAudioCue('stop');
        stopListening();
      } else {
        startListening(currentInputText);
      }
    },
    [isListening, startListening, stopListening]
  );

  return {
    isSupported,
    isStandalonePwa,
    isListening,
    interimTranscript,
    speechLang,
    speechLangLabel,
    listeningTitle: copy.listeningTitle,
    listeningHint: copy.listeningHint,
    toast,
    clearToast,
    startListening,
    stopListening,
    toggleListening
  };
}

