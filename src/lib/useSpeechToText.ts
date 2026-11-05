import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguagePreference } from '../types';
import { api } from './api';

/**
 * Use 'en-NG' (Nigerian English acoustic model) for both English and Nigerian Pidgin
 * because mobile/desktop browser engines have a high-accuracy trained acoustic model
 * for 'en-NG', whereas 'pcm-NG' is unrecognized by most browser engines.
 */
export const SPEECH_LANG_MAP: Record<LanguagePreference, string> = {
  en: 'en-NG',
  pcm: 'en-NG',
  yo: 'yo-NG',
  ha: 'ha-NG',
  ig: 'ig-NG'
};

export const SPEECH_LANG_LABELS: Record<LanguagePreference, string> = {
  en: 'English (NG)',
  pcm: 'Naija Pidgin (NG)',
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
  transcribingTitle: string;
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
    listeningTitle: 'Listening (Noise Filter Active)… Speak clearly',
    listeningHint: 'Background noise is filtered out. Tap Done when finished.',
    transcribingTitle: 'Sharpening voice transcript…',
    unsupportedTitle: 'Voice input unavailable on this browser',
    unsupportedMessage:
      'Speech recognition is not supported in this view. Please use Chrome, Edge, or Safari, or type your message below.',
    insecureTitle: 'HTTPS required for voice input',
    insecureMessage:
      'Microphone access requires a secure HTTPS connection (or localhost). You can continue typing below.',
    permissionTitle: 'Microphone permission needed',
    permissionPwaMessage:
      'Microphone access is blocked for OjaFlow PWA. Open Settings → Apps → OjaFlow → Permissions → Allow Microphone, or type below.',
    permissionBrowserMessage:
      'Microphone access was blocked. Tap the lock/site icon in your address bar to allow Microphone access, or continue typing below.',
    noMicTitle: 'No microphone detected',
    noMicMessage:
      'We could not access your device microphone. Check that another app is not holding the mic, or type below.',
    noSpeechTitle: 'Only background noise detected',
    noSpeechMessage:
      'We filtered out background sound but did not catch clear speech. Speak a little closer to your microphone or type below.',
    networkTitle: 'Network needed for voice transcription',
    networkMessage:
      'Voice transcription needs an active data connection. You can still type offline record questions below!'
  },
  pcm: {
    listeningTitle: 'I dey listen (Noise Filter dey on)… Talk now',
    listeningHint: 'Background noise don block. Tap Done wen you finish talk.',
    transcribingTitle: 'Dey sharpen wetin you talk…',
    unsupportedTitle: 'Voice typing no dey work for dis browser',
    unsupportedMessage:
      'Dis browser no support voice mic. Abeg use Chrome or Safari, or just type your question for di box below.',
    insecureTitle: 'Secure connection needed for mic',
    insecureMessage:
      'Microphone for PWA need secure HTTPS connection. You fit type your message sharp-sharp for di box below.',
    permissionTitle: 'Abeg allow Microphone permission',
    permissionPwaMessage:
      'Microphone permission dey blocked. Go your phone Settings → Apps → OjaFlow → Permissions → Allow Microphone, or type below.',
    permissionBrowserMessage:
      'Microphone dey blocked. Tap di lock icon for top of your browser make you Allow Microphone, or type your question below.',
    noMicTitle: 'We no see microphone',
    noMicMessage:
      'Phone microphone no gree open. Check say anoda call or app no dey hold am, or type your message below.',
    noSpeechTitle: 'Na only background noise we hear',
    noSpeechMessage:
      'We block background noise comot, but we no hear your voice clear. Abeg talk near your phone mic small, or type below.',
    networkTitle: 'Network needed for voice mic',
    networkMessage:
      'Voice-to-text need small data connection. You fit type your question below — offline record check still dey work!'
  },
  yo: {
    listeningTitle: 'Mo ń tẹ́tí (Àlẹ̀mọ́ Ariwo ń ṣiṣẹ́)… Sọ̀rọ̀ báyìí',
    listeningHint: 'A ti dènà ariwo àyíká. Tẹ Done nígbà tí o bá parí.',
    transcribingTitle: 'Mo ń ṣàtúnṣe ohùn rẹ…',
    unsupportedTitle: 'Ohùn kò ṣiṣẹ́ lórí aṣàwákiri yìí',
    unsupportedMessage:
      'Jọ̀wọ́ lo Chrome tàbí Safari, tàbí kí o tẹ ìbéèrè rẹ sí àpótí ìsàlẹ̀.',
    insecureTitle: 'A nílò ìsopọ̀ HTTPS tó dájú',
    insecureMessage:
      'Maikirofóònù nílò HTTPS. O lè tẹ ìbéèrè rẹ sí àpótí ìsàlẹ̀.',
    permissionTitle: 'Jọ̀wọ́ gba ààyè Maikirofóònù láàyè',
    permissionPwaMessage:
      'Lọ sí Settings → Apps → OjaFlow → Permissions → Gba Microphone láàyè, tàbí kí o tẹ ọ̀rọ̀ rẹ sí ìsàlẹ̀.',
    permissionBrowserMessage:
      'Tẹ àmì ààbò ní òkè aṣàwákiri rẹ láti gba Microphone láàyè, tàbí kí o tẹ ọ̀rọ̀ rẹ sí ìsàlẹ̀.',
    noMicTitle: 'A kò rí maikirofóònù',
    noMicMessage:
      'A kò lè lo maikirofóònù rẹ. Rí i dájú pé ètò mìíràn kò lo ó.',
    noSpeechTitle: 'Ariwo àyíká nìkan la gbọ́',
    noSpeechMessage:
      'A kò gbọ́ ohùn rẹ ketekete. Jọ̀wọ́ sọ̀rọ̀ súnmọ́ fóònù rẹ tàbí kí o tẹ ìbéèrè rẹ sí ìsàlẹ̀.',
    networkTitle: 'A nílò intanẹ́ẹ̀tì fún ohùn sí ọ̀rọ̀',
    networkMessage:
      'Ohùn sí ọ̀rọ̀ nílò intanẹ́ẹ̀tì. Jọ̀wọ́ ṣàyẹ̀wò dátà rẹ tàbí kí o tẹ ìbéèrè rẹ sí ìsàlẹ̀.'
  },
  ha: {
    listeningTitle: 'Ina sauraro (An toshe hayaniya)… Yi magana yanzu',
    listeningHint: 'An tace hayaniyar gefe. Danna Done idan ka gama.',
    transcribingTitle: 'Ana gyara rubutun muryarka…',
    unsupportedTitle: 'Magana da murya ba ta aiki a wannan burauza',
    unsupportedMessage:
      'Yi amfani da Chrome ko Safari, ko ka rubuta tambayarka a ƙasa.',
    insecureTitle: 'Ana buƙatar haɗin HTTPS',
    insecureMessage:
      'Makirfo yana buƙatar HTTPS. Za ka iya rubuta tambayarka a ƙasa.',
    permissionTitle: 'Ana buƙatar izinin Makirfo',
    permissionPwaMessage:
      'Shiga Settings → Apps → OjaFlow → Permissions → Ba da izinin Microphone.',
    permissionBrowserMessage:
      'Danna alamar makulli a saman burauza don ba da izinin Microphone.',
    noMicTitle: 'Ba a sami makirfo ba',
    noMicMessage:
      'Ba mu iya buɗe makirfon wayarka ba. Duba ko wata manhaja tana amfani da shi.',
    noSpeechTitle: 'Hayaniyar gefe kawai aka ji',
    noSpeechMessage:
      'Ba a ji muryarka sosai ba. Yi magana kusa da makirfo ko ka rubuta tambayarka a ƙasa.',
    networkTitle: 'Ana buƙatar intanet',
    networkMessage:
      'Juya murya zuwa rubutu yana buƙatar data. Duba haɗin intanet ko ka rubuta a ƙasa.'
  },
  ig: {
    listeningTitle: 'Ana m ege ntị (Egbochiri mkpọtụ)… Kwuo okwu ugbu a',
    listeningHint: 'Anyị ewepụla mkpọtụ gburugburu. Pịa Done mgbe ị kwuchara.',
    transcribingTitle: 'Ana edozi okwu gị…',
    unsupportedTitle: 'Iji olu ede ihe anaghị arụ ọrụ na bọraụza a',
    unsupportedMessage:
      'Biko jiri Chrome ma ọ bụ Safari, ma ọ bụ pịa ajụjụ gị n’igbe dị n’okpuru.',
    insecureTitle: 'Achọrọ njikọ HTTPS maka igwe okwu',
    insecureMessage:
      'Igwe okwu chọrọ HTTPS. Ị nwere ike ịpịa ozi gị n’igbe dị n’okpuru.',
    permissionTitle: 'Biko nye ikike Igwe Okwu (Microphone)',
    permissionPwaMessage:
      'Gaa na Settings → Apps → OjaFlow → Permissions → Kwe ka Microphone rụọ ọrụ.',
    permissionBrowserMessage:
      'Pịa akara mkpọchi dị n’elu bọraụza gị ka ị nye ikike Microphone.',
    noMicTitle: 'Ahụghị igwe okwu ọ bụla',
    noMicMessage:
      'Anyị enweghị ike ịnweta igwe okwu gị. Lelee ma ngwa ọzọ ọ na-eji ya.',
    noSpeechTitle: 'Naanị mkpọtụ ka a nụrụ',
    noSpeechMessage:
      'Anyị anụghị olu gị nke ọma. Kwuo okwu nso n’ekwentị gị ma ọ bụ pịa ajụjụ gị n’okpuru.',
    networkTitle: 'Achọrọ ịntanetị',
    networkMessage:
      'Ịtụgharị olu chọrọ ịntanetị. Biko lelee data gị ma ọ bụ pịa ajụjụ gị n’okpuru.'
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
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  );
  return Boolean(standaloneDisplay || iosStandalone);
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const NOISE_FILLER_RE =
  /^(?:uh+|um+|hmm+|hm+|ah+|eh+|oh+|shh+|mm+|a|an|the|he|it)$/i;

const TRADER_KEYWORDS = [
  'sold',
  'sell',
  'sale',
  'record',
  'bag',
  'bags',
  'carton',
  'cartons',
  'rice',
  'garri',
  'beans',
  'indomie',
  'yam',
  'oil',
  'sugar',
  'flour',
  'cement',
  'cash',
  'transfer',
  'pos',
  'credit',
  'expense',
  'spent',
  'fuel',
  'transport',
  'debt',
  'owe',
  'owes',
  'customer',
  'profit',
  'stock',
  'inventory',
  'today',
  'week',
  'month',
  'naira',
  'thousand'
];

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100
};

/**
 * Normalizes Nigerian trader speech patterns, spoken numbers, and common
 * market homophones so commands & questions are sharp and accurate.
 */
export function sharpenTraderTranscript(raw: string): string {
  let text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return '';

  // Fix common speech-engine homophones for Nigerian market items
  text = text
    .replace(/\b(?:in\s*domi|indo\s*me|in\s*do\s*me|indomy)\b/gi, 'Indomie')
    .replace(/\b(?:gary|gari|gerri|carry)\b(?=\s+(?:for|at|\d))/gi, 'garri')
    .replace(/\b(?:back|backs|bark|barks)\s+of\s+/gi, 'bags of ')
    .replace(/\b(?:caton|catons|cartoon|cartoons)\s+of\s+/gi, 'cartons of ')
    .replace(/\bp\s*\.?\s*o\s*\.?\s*s\b/gi, 'POS')
    .replace(/\bo\s*pay\b/gi, 'OPay')
    .replace(/\bmoni\s*point\b/gi, 'Moniepoint');

  // Convert "forty five thousand" / "15 thousand" -> "45000" / "15000"
  text = text.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(one|two|three|four|five|six|seven|eight|nine)\s+thousand\b/gi,
    (_, tens: string, ones: string) => {
      const val =
        (WORD_NUMBERS[tens.toLowerCase()] || 0) +
        (WORD_NUMBERS[ones.toLowerCase()] || 0);
      return String(val * 1000);
    }
  );

  text = text.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|\d+)\s+thousand(?:\s+naira)?\b/gi,
    (_, numWord: string) => {
      const n =
        WORD_NUMBERS[numWord.toLowerCase()] ?? Number(numWord.replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) {
        return String(n * 1000);
      }
      return _;
    }
  );

  // Convert standalone quantity words before items ("sold three bags" -> "sold 3 bags")
  text = text.replace(
    /\b(sold|sell|sale|record|add|bought|buy)\s+(one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\b/gi,
    (_, verb: string, qtyWord: string) => {
      const qty = WORD_NUMBERS[qtyWord.toLowerCase()];
      return qty ? `${verb} ${qty}` : _;
    }
  );

  // Strip trailing "naira" after numbers so voice action parser matches cleanly
  text = text.replace(/(\d)\s+naira\b/gi, '$1');

  return text.trim();
}

/**
 * Picks the best alternative from SpeechRecognitionResult by scoring confidence
 * plus Nigerian trader keyword & numeric matches.
 */
function pickBestAlternative(
  result: SpeechRecognitionResultLike
): { transcript: string; confidence: number } {
  let bestTranscript = result?.[0]?.transcript || '';
  let bestConfidence =
    typeof result?.[0]?.confidence === 'number' ? result[0].confidence : 0.85;
  let bestScore = -1;

  for (let i = 0; i < result.length; i += 1) {
    const alt = result[i];
    if (!alt?.transcript) continue;
    const text = alt.transcript.trim();
    const conf = typeof alt.confidence === 'number' && alt.confidence > 0 ? alt.confidence : 0.8;
    const lower = text.toLowerCase();

    let bonus = 0;
    for (const kw of TRADER_KEYWORDS) {
      if (lower.includes(kw)) bonus += 0.08;
    }
    if (/\d/.test(text)) bonus += 0.1;

    const score = conf + bonus;
    if (score > bestScore) {
      bestScore = score;
      bestTranscript = text;
      bestConfidence = conf;
    }
  }

  return { transcript: bestTranscript, confidence: bestConfidence };
}

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
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
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
    // Ignore audio context restrictions
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [toast, setToast] = useState<SpeechToast | null>(null);
  const [isStandalonePwa, setIsStandalonePwa] = useState<boolean>(() =>
    isStandalonePwaEnvironment()
  );

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const userStoppedRef = useRef<boolean>(false);
  const baseTextRef = useRef<string>('');
  const committedSessionTextRef = useRef<string>('');
  const fallbackAttemptedRef = useRef<boolean>(false);

  // Noise-suppression Web Audio DSP & VAD state
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const noiseFloorRef = useRef<number>(0.012);
  const recentSpeechEnergyRef = useRef<number>(0);
  const hadClearVoiceRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<number | null>(null);

  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onSpeechEndRef = useRef(onSpeechEnd);

  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd;
  }, [onSpeechEnd]);

  const isSupported = Boolean(
    getSpeechRecognitionConstructor() ||
      (typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function')
  );
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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 8500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const cleanupAudioPipeline = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    setVoiceLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      userStoppedRef.current = true;
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
      cleanupAudioPipeline();
    };
  }, [cleanupAudioPipeline]);

  /**
   * Starts hardware noise-suppressed microphone + Web Audio bandpass voice filter
   * (120 Hz High-Pass -> 3800 Hz Low-Pass -> 2400 Hz Vocal Presence Boost -> Compressor)
   * to isolate foreground human voice and ignore background market noise.
   */
  const startNoiseFilteredAudioMonitor = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 }
        }
      });

      if (userStoppedRef.current) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }

      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);

      // 1. High-pass filter at 120 Hz: removes low-frequency generator, fan, wind, & traffic rumble
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 120;
      highPass.Q.value = 0.75;

      // 2. Low-pass filter at 3800 Hz: removes high-frequency hiss & clatter outside human voice band
      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 3800;
      lowPass.Q.value = 0.75;

      // 3. Vocal presence boost at 2400 Hz (+4.5 dB): sharpens consonant intelligibility
      const vocalBoost = ctx.createBiquadFilter();
      vocalBoost.type = 'peaking';
      vocalBoost.frequency.value = 2400;
      vocalBoost.Q.value = 1.1;
      vocalBoost.gain.value = 4.5;

      // 4. Dynamics compressor: stabilizes foreground voice volume
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -26;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.15;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;

      source.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(vocalBoost);
      vocalBoost.connect(compressor);
      compressor.connect(analyser);

      // Also feed the bandpass-filtered stream into MediaRecorder for AI fallback if needed
      if (typeof MediaRecorder !== 'undefined' && ctx.createMediaStreamDestination) {
        try {
          const dest = ctx.createMediaStreamDestination();
          compressor.connect(dest);
          recordedChunksRef.current = [];
          const recorder = new MediaRecorder(dest.stream);
          recorder.ondataavailable = ev => {
            if (ev.data && ev.data.size > 0) {
              recordedChunksRef.current.push(ev.data);
            }
          };
          recorder.start(250);
          mediaRecorderRef.current = recorder;
        } catch {
          // ignore MediaRecorder errors on older browsers
        }
      }

      const timeData = new Float32Array(analyser.fftSize);
      noiseFloorRef.current = 0.012;
      recentSpeechEnergyRef.current = 0;
      hadClearVoiceRef.current = false;

      const tick = () => {
        if (userStoppedRef.current || !audioContextRef.current) return;
        analyser.getFloatTimeDomainData(timeData);

        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i += 1) {
          const sample = timeData[i];
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / timeData.length);

        // Adaptive noise floor: slowly adapts to steady background hum without adapting to speech
        if (rms < noiseFloorRef.current * 1.45) {
          noiseFloorRef.current = noiseFloorRef.current * 0.94 + rms * 0.06;
        } else {
          noiseFloorRef.current = noiseFloorRef.current * 0.995 + rms * 0.005;
        }

        const voiceGateThreshold = Math.max(0.017, noiseFloorRef.current * 1.75);
        const isForegroundVoice = rms > voiceGateThreshold;

        if (isForegroundVoice) {
          recentSpeechEnergyRef.current = Math.max(
            rms,
            recentSpeechEnergyRef.current * 0.85
          );
          hadClearVoiceRef.current = true;
        } else {
          recentSpeechEnergyRef.current *= 0.9;
        }

        // Convert foreground voice energy above noise floor into 0-100 visual meter
        const netEnergy = Math.max(0, rms - noiseFloorRef.current);
        const normalizedLevel = Math.min(100, Math.round(netEnergy * 420));
        setVoiceLevel(normalizedLevel);

        rafRef.current = window.requestAnimationFrame(tick);
      };

      rafRef.current = window.requestAnimationFrame(tick);
    } catch {
      // Browser SpeechRecognition can still operate even if getUserMedia stream isn't opened separately
    }
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const finalizeAndStop = useCallback(async () => {
    userStoppedRef.current = true;
    const instance = recognitionRef.current;
    if (instance) {
      recognitionRef.current = null;
      try {
        instance.onend = null;
        instance.stop();
      } catch {
        try {
          instance.abort();
        } catch {
          // ignore
        }
      }
    }

    // Grab recorded noise-filtered audio chunks before closing pipeline
    const recorder = mediaRecorderRef.current;
    const chunks = [...recordedChunksRef.current];
    const mimeType = recorder?.mimeType || 'audio/webm';
    const hadVoice = hadClearVoiceRef.current;

    cleanupAudioPipeline();
    setIsListening(false);
    setInterimTranscript('');

    // If browser SpeechRecognition missed the utterance despite foreground voice,
    // use the AI noise-filtered audio transcription endpoint if online
    if (
      !committedSessionTextRef.current.trim() &&
      hadVoice &&
      chunks.length > 0 &&
      navigator.onLine
    ) {
      try {
        setIsTranscribing(true);
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size > 800) {
          const b64 = await blobToBase64(blob);
          const res = await api.transcribeAudio(b64, mimeType, language);
          const sharpened = sharpenTraderTranscript(res.transcript || '');
          if (sharpened) {
            committedSessionTextRef.current = sharpened;
            const combined = [baseTextRef.current, sharpened]
              .filter(Boolean)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            onTranscriptChangeRef.current(combined);
          }
        }
      } catch {
        // ignore fallback errors
      } finally {
        setIsTranscribing(false);
      }
    }

    onSpeechEndRef.current?.();
  }, [cleanupAudioPipeline, language]);

  const stopListening = useCallback(() => {
    void finalizeAndStop();
  }, [finalizeAndStop]);

  const launchRecognizer = useCallback(
    (langCode: string, currentInputText: string, isAutoRestart = false) => {
      const Ctor = getSpeechRecognitionConstructor();
      if (!Ctor) {
        if (!navigator.mediaDevices?.getUserMedia) {
          playAudioCue('error');
          setToast({
            kind: 'unsupported',
            title: copy.unsupportedTitle,
            message: copy.unsupportedMessage
          });
          onSpeechEndRef.current?.();
        }
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      const recognition = new Ctor();
      recognitionRef.current = recognition;

      recognition.lang = langCode;
      // Request 5 alternatives so we can score and pick the sharpest trader phrase
      recognition.maxAlternatives = 5;
      recognition.interimResults = true;
      // Use continuous=false with seamless auto-restart so background noise pauses
      // never cut off the trader mid-sentence AND Android Chrome never echoes duplicates.
      recognition.continuous = false;

      if (!isAutoRestart) {
        baseTextRef.current = currentInputText.trim();
        committedSessionTextRef.current = '';
      }

      recognition.onstart = () => {
        setIsListening(true);
        if (!isAutoRestart) {
          setInterimTranscript('');
          setToast(null);
          playAudioCue('start');
        }
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const { transcript, confidence } = pickBestAlternative(result);
          const trimmed = transcript.trim();
          if (!trimmed) continue;

          // Background Noise Gate:
          // Ignore low-confidence or 1-word filler hallucinations caused by background sound
          const isNoiseFiller = NOISE_FILLER_RE.test(trimmed);
          const lowVoiceEnergy =
            recentSpeechEnergyRef.current > 0 &&
            recentSpeechEnergyRef.current < noiseFloorRef.current * 1.25;

          if (result.isFinal) {
            if (isNoiseFiller && trimmed.length <= 3) {
              continue;
            }
            if (confidence > 0 && confidence < 0.35 && lowVoiceEnergy) {
              continue;
            }
            finalChunk += ` ${sharpenTraderTranscript(trimmed)}`;
          } else if (!isNoiseFiller) {
            interimChunk += ` ${trimmed}`;
          }
        }

        if (finalChunk.trim()) {
          committedSessionTextRef.current = sharpenTraderTranscript(
            [committedSessionTextRef.current, finalChunk.trim()]
              .filter(Boolean)
              .join(' ')
          );
        }

        const cleanInterim = sharpenTraderTranscript(interimChunk.trim());
        setInterimTranscript(cleanInterim);

        const combined = [
          baseTextRef.current,
          committedSessionTextRef.current,
          cleanInterim
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        onTranscriptChangeRef.current(combined);

        // Reset auto-stop silence timer: once real words have been spoken,
        // wait 3.8 seconds of silence before auto-completing
        if (committedSessionTextRef.current || cleanInterim) {
          if (silenceTimerRef.current) {
            window.clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = window.setTimeout(() => {
            if (!userStoppedRef.current && committedSessionTextRef.current) {
              playAudioCue('stop');
              void finalizeAndStop();
            }
          }, 3800);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const errorCode = (event.error || '').toLowerCase();

        if (
          (errorCode === 'language-not-supported' ||
            errorCode === 'bad-grammar') &&
          langCode !== 'en-NG' &&
          !fallbackAttemptedRef.current
        ) {
          fallbackAttemptedRef.current = true;
          try {
            recognition.onend = null;
            recognition.abort();
          } catch {
            // ignore
          }
          launchRecognizer('en-NG', baseTextRef.current, true);
          return;
        }

        // In noisy environments, 'no-speech' fires if the user pauses briefly;
        // keep listening seamlessly unless the user clicked Done!
        if (errorCode === 'no-speech' && !userStoppedRef.current) {
          return;
        }

        if (errorCode === 'aborted') {
          return;
        }

        userStoppedRef.current = true;
        cleanupAudioPipeline();
        setIsListening(false);
        setInterimTranscript('');
        playAudioCue('error');

        if (
          errorCode === 'not-allowed' ||
          errorCode === 'service-not-allowed'
        ) {
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
        // If the user has NOT tapped Done yet, automatically sustain listening
        // so background noise spikes never cut off their sentence prematurely!
        if (!userStoppedRef.current) {
          try {
            launchRecognizer(langCode, baseTextRef.current, true);
            return;
          } catch {
            // fall through to finalize
          }
        }
        void finalizeAndStop();
      };

      try {
        recognition.start();
      } catch {
        userStoppedRef.current = true;
        cleanupAudioPipeline();
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
    [cleanupAudioPipeline, copy, finalizeAndStop, isStandalonePwa]
  );

  const startListening = useCallback(
    (currentInputText = '') => {
      if (typeof window === 'undefined') {
        return;
      }

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

      userStoppedRef.current = false;
      fallbackAttemptedRef.current = false;

      // Start the hardware noise-suppressed + bandpass-filtered audio monitor in parallel
      void startNoiseFilteredAudioMonitor();

      // Synchronously launch the recognizer inside the user gesture
      launchRecognizer(speechLang, currentInputText, false);
    },
    [copy, launchRecognizer, speechLang, startNoiseFilteredAudioMonitor]
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
    isTranscribing,
    voiceLevel,
    interimTranscript,
    speechLang,
    speechLangLabel,
    listeningTitle: isTranscribing
      ? copy.transcribingTitle
      : copy.listeningTitle,
    listeningHint: copy.listeningHint,
    toast,
    clearToast,
    startListening,
    stopListening,
    toggleListening
  };
}
