import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguagePreference } from '../types';

/**
 * Dynamic BCP-47 locale mapping tailored for Nigerian market traders.
 * Uses the user's selected language preference directly, with automatic
 * runtime fallback to 'en-NG' if a mobile OS lacks a specific local pack.
 */
export const SPEECH_LANG_MAP: Record<LanguagePreference, string> = {
  en: 'en-NG',
  pcm: 'pcm-NG',
  yo: 'yo-NG',
  ha: 'ha-NG',
  ig: 'ig-NG'
};

export const SPEECH_LANG_LABELS: Record<LanguagePreference, string> = {
  en: 'English (en-NG)',
  pcm: 'Pidgin (pcm-NG)',
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
  onaudiostart?: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onsoundstart?: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onspeechstart?: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onspeechend?: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventLike) => void)
    | null;
  onerror:
    | ((
        this: SpeechRecognitionInstance,
        ev: SpeechRecognitionErrorEventLike
      ) => void)
    | null;
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
    listeningTitle: 'Listening… Speak clearly into your mic',
    listeningHint:
      'Say a sale, expense, debt, or question. Tap Done when finished.',
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
    noSpeechTitle: 'No clear speech detected',
    noSpeechMessage:
      'We filtered out background sound but did not catch clear words. Speak a little closer to your microphone or type below.',
    networkTitle: 'Network needed for voice transcription',
    networkMessage:
      'Voice transcription needs an active data connection. You can still type offline record questions below!'
  },
  pcm: {
    listeningTitle: 'I dey listen… Talk your market matter clear',
    listeningHint:
      'Talk wetin you sell, expense, debt, or question. Tap Done wen you finish.',
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
    noSpeechTitle: 'We no hear your voice clear',
    noSpeechMessage:
      'Background noise don comot, but we no hear clear words. Abeg talk near your phone mic small, or type below.',
    networkTitle: 'Network needed for voice mic',
    networkMessage:
      'Voice-to-text need small data connection. You fit type your question below — offline record check still dey work!'
  },
  yo: {
    listeningTitle: 'Mo ń tẹ́tí… Sọ̀rọ̀ ketekete sí maikirofóònù rẹ',
    listeningHint:
      'Sọ ọjà tí o tà, ìnáwó, gbèsè, tàbí ìbéèrè rẹ. Tẹ Done nígbà tí o bá parí.',
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
    noSpeechTitle: 'A kò gbọ́ ohùn rẹ ketekete',
    noSpeechMessage:
      'Jọ̀wọ́ sọ̀rọ̀ súnmọ́ fóònù rẹ tàbí kí o tẹ ìbéèrè rẹ sí ìsàlẹ̀.',
    networkTitle: 'A nílò intanẹ́ẹ̀tì fún ohùn sí ọ̀rọ̀',
    networkMessage:
      'Ohùn sí ọ̀rọ̀ nílò intanẹ́ẹ̀tì. Jọ̀wọ́ ṣàyẹ̀wò dátà rẹ tàbí kí o tẹ ìbéèrè rẹ sí ìsàlẹ̀.'
  },
  ha: {
    listeningTitle: 'Ina sauraro… Yi magana da kyau a makirfo',
    listeningHint:
      'Faɗi ciniki, kashe kuɗi, bashi, ko tambaya. Danna Done idan ka gama.',
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
    noSpeechTitle: 'Ba a ji muryarka sosai ba',
    noSpeechMessage:
      'Yi magana kusa da makirfo ko ka rubuta tambayarka a ƙasa.',
    networkTitle: 'Ana buƙatar intanet',
    networkMessage:
      'Juya murya zuwa rubutu yana buƙatar data. Duba haɗin intanet ko ka rubuta a ƙasa.'
  },
  ig: {
    listeningTitle: 'Ana m ege ntị… Kwuo okwu nke ọma n’igwe okwu',
    listeningHint:
      'Kwuo ahịa ị resịrị, mmefu, ụgwọ, ma ọ bụ ajụjụ. Pịa Done mgbe ị kwuchara.',
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
    noSpeechTitle: 'Anyị anụghị olu gị nke ọma',
    noSpeechMessage:
      'Kwuo okwu nso n’ekwentị gị ma ọ bụ pịa ajụjụ gị n’okpuru.',
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
  /^(?:uh+|um+|hmm+|hm+|ah+|eh+|oh+|shh+|mm+|cough|sigh)$/i;

/**
 * Core Nigerian market & retail vocabulary used to score acoustic alternatives
 * when `maxAlternatives` returns multiple candidate phrases.
 */
const TRADER_KEYWORDS = [
  'sold',
  'sell',
  'sale',
  'sales',
  'record',
  'add',
  'bought',
  'buy',
  'bag',
  'bags',
  'carton',
  'cartons',
  'paint',
  'derica',
  'mudu',
  'crate',
  'crates',
  'pack',
  'packs',
  'sachet',
  'roll',
  'rolls',
  'dozen',
  'pieces',
  'bottle',
  'bottles',
  'gallon',
  'litre',
  'litres',
  'rice',
  'garri',
  'beans',
  'indomie',
  'spaghetti',
  'macaroni',
  'semovita',
  'semo',
  'wheat',
  'yam',
  'oil',
  'palm',
  'groundnut',
  'sugar',
  'flour',
  'cement',
  'milk',
  'milo',
  'peak',
  'dano',
  'dangote',
  'bread',
  'egg',
  'eggs',
  'fish',
  'chicken',
  'turkey',
  'meat',
  'onion',
  'pepper',
  'tomato',
  'soap',
  'detergent',
  'drink',
  'drinks',
  'water',
  'coke',
  'malt',
  'cash',
  'transfer',
  'pos',
  'credit',
  'opay',
  'palmpay',
  'moniepoint',
  'kuda',
  'expense',
  'expenses',
  'spent',
  'pay',
  'paid',
  'fuel',
  'diesel',
  'petrol',
  'generator',
  'nepa',
  'transport',
  'waybill',
  'keke',
  'okada',
  'delivery',
  'rent',
  'shop',
  'levy',
  'ticket',
  'nylon',
  'packaging',
  'debt',
  'debts',
  'owe',
  'owes',
  'owing',
  'customer',
  'supplier',
  'mama',
  'alhaji',
  'madam',
  'oga',
  'profit',
  'stock',
  'inventory',
  'today',
  'week',
  'month',
  'naira',
  'thousand',
  'hundred'
];

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  won: 1,
  two: 2,
  to: 2,
  too: 2,
  three: 3,
  four: 4,
  for: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
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

  // 1. Fix common Web Speech API phonetic miscorrelations for Nigerian market items & terms
  text = text
    .replace(
      /\b(?:in\s*domi|indo\s*me|in\s*do\s*me|in\s*dummy|indomy|indomi)\b/gi,
      'Indomie'
    )
    .replace(
      /\b(?:gary|gari|gerri|garry|carry)\b(?=\s+(?:for|at|₦|\d|cash|transfer|pos|credit)|$)/gi,
      'garri'
    )
    .replace(/\b(?:semo\s*vita|semo\s*victor|semovita)\b/gi, 'Semovita')
    .replace(/\b(?:dan\s*gote|dangote)\b/gi, 'Dangote')
    .replace(/\b(?:golden\s*penny|gold\s*in\s*penny)\b/gi, 'Golden Penny')
    .replace(/\b(?:mama\s*gold)\b/gi, 'Mama Gold')
    .replace(/\b(?:power\s*oil)\b/gi, 'Power Oil')
    .replace(/\b(?:granat\s*oil|ground\s*nut\s*oil)\b/gi, 'groundnut oil')
    .replace(/\b(?:pam\s*oil)\b/gi, 'palm oil')
    .replace(/\b(?:pick\s*milk|peak\s*milk)\b/gi, 'Peak milk')
    .replace(/\b(?:dan\s*o\s*milk|dano\s*milk)\b/gi, 'Dano milk')
    .replace(/\b(?:sea\s*ment|sement)\b/gi, 'cement')
    .replace(/\b(?:de\s*rica|derika)\b/gi, 'derica')
    .replace(/\b(?:moodu|mu\s*du)\b/gi, 'mudu')
    .replace(/\b(?:sasha|satchet)\b/gi, 'sachet')
    .replace(/\b(?:back|backs|bark|barks)\s+of\s+/gi, 'bags of ')
    .replace(/\b(?:caton|catons|cartoon|cartoons)\s+of\s+/gi, 'cartons of ')
    .replace(/\b(?:ke\s*ke(?:\s*napep)?|keke\s*napep)\b/gi, 'keke')
    .replace(/\b(?:way\s*bill|weigh\s*bill)\b/gi, 'waybill')
    .replace(/\bp\s*\.?\s*o\s*\.?\s*s\b/gi, 'POS')
    .replace(/\b(?:o\s*pay|oh\s*pay)\b/gi, 'OPay')
    .replace(/\b(?:palm\s*pay|pam\s*pay)\b/gi, 'PalmPay')
    .replace(/\b(?:moni\s*point|money\s*point|monie\s*point)\b/gi, 'Moniepoint')
    .replace(/\b(?:n\s*e\s*p\s*a)\b/gi, 'NEPA')
    .replace(/\b(?:mama\s+tee)\b/gi, 'Mama T')
    .replace(
      /(\d+|thousand|hundred)\s+(?:naire|nara|narrow|niara)\b/gi,
      '$1 naira'
    );

  // 2. Convert compound spoken thousands: e.g. "forty five thousand" -> "45000"
  text = text.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\s+thousand(?:\s+naira)?\b/gi,
    (_, tens: string, ones: string) => {
      const val =
        (WORD_NUMBERS[tens.toLowerCase()] || 0) +
        (WORD_NUMBERS[ones.toLowerCase()] || 0);
      return String(val * 1000);
    }
  );

  // 3. Convert "one hundred and fifty thousand" / "two hundred thousand" -> "150000" / "200000"
  text = text.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred(?:\s+and\s+(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))?\s+thousand(?:\s+naira)?\b/gi,
    (_, hundreds: string, tens?: string) => {
      const h = (WORD_NUMBERS[hundreds.toLowerCase()] || 1) * 100;
      const t = tens ? WORD_NUMBERS[tens.toLowerCase()] || 0 : 0;
      return String((h + t) * 1000);
    }
  );

  // 4. Convert single spoken thousands: e.g. "fifteen thousand" / "45 thousand" -> "15000" / "45000"
  text = text.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|\d+)\s+thousand(?:\s+naira)?\b/gi,
    (fullMatch, numWord: string) => {
      const n =
        WORD_NUMBERS[numWord.toLowerCase()] ??
        Number(numWord.replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) {
        return String(n * 1000);
      }
      return fullMatch;
    }
  );

  // 5. Convert spoken hundreds: e.g. "five hundred naira" -> "500"
  text = text.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|\d+)\s+hundred(?:\s+naira)?\b/gi,
    (fullMatch, numWord: string) => {
      const n =
        WORD_NUMBERS[numWord.toLowerCase()] ??
        Number(numWord.replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) {
        return String(n * 100);
      }
      return fullMatch;
    }
  );

  // 6. Convert standalone quantity words after action verbs ("sold three bags" -> "sold 3 bags")
  text = text.replace(
    /\b(sold|sell|sale|record|add|bought|buy)\s+(one|won|two|to|too|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\b/gi,
    (fullMatch, verb: string, qtyWord: string) => {
      const qty = WORD_NUMBERS[qtyWord.toLowerCase()];
      return qty ? `${verb} ${qty}` : fullMatch;
    }
  );

  // 7. Convert leading quantity words before units ("three bags of rice" -> "3 bags of rice")
  text = text.replace(
    /^(one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\s+(bags?|cartons?|paints?|dericas?|mudus?|crates?|packs?|rolls?|dozens?|pieces?|bottles?|gallons?|litres?)\b/i,
    (fullMatch, qtyWord: string, unit: string) => {
      const qty = WORD_NUMBERS[qtyWord.toLowerCase()];
      return qty ? `${qty} ${unit}` : fullMatch;
    }
  );

  // 8. Strip trailing "naira" immediately after digits so numeric parsers match cleanly
  text = text.replace(/(\d)\s+naira\b/gi, '$1');

  return text.trim();
}

/**
 * Picks the best alternative from SpeechRecognitionResult by scoring acoustic
 * confidence plus Nigerian trader keyword & numeric matches.
 */
function pickBestAlternative(result: SpeechRecognitionResultLike): {
  transcript: string;
  confidence: number;
} {
  let bestTranscript = result?.[0]?.transcript || '';
  let bestConfidence =
    typeof result?.[0]?.confidence === 'number' ? result[0].confidence : 0.85;
  let bestScore = -1;

  for (let i = 0; i < result.length; i += 1) {
    const alt = result[i];
    if (!alt?.transcript) continue;
    const text = alt.transcript.trim();
    const conf =
      typeof alt.confidence === 'number' && alt.confidence > 0
        ? alt.confidence
        : 0.8;
    const sharpened = sharpenTraderTranscript(text);
    const lower = sharpened.toLowerCase();

    let bonus = 0;
    for (const kw of TRADER_KEYWORDS) {
      if (lower.includes(kw)) bonus += 0.09;
    }
    if (/\d/.test(sharpened)) bonus += 0.12;

    const score = conf + bonus;
    if (score > bestScore) {
      bestScore = score;
      bestTranscript = text;
      bestConfidence = conf;
    }
  }

  return { transcript: bestTranscript, confidence: bestConfidence };
}

/**
 * Deduplicates cumulative transcripts emitted by mobile Android Chrome
 * when `continuous = true` or across rapid result segments.
 */
function mergeCumulativeSegments(segments: string[]): string {
  const cleaned: string[] = [];
  for (const rawSeg of segments) {
    const seg = rawSeg.trim();
    if (!seg) continue;
    if (cleaned.length === 0) {
      cleaned.push(seg);
      continue;
    }
    const prev = cleaned[cleaned.length - 1];
    const prevLower = prev.toLowerCase();
    const segLower = seg.toLowerCase();

    // If Android Chrome emits a cumulative superset of the previous final segment, replace it
    if (segLower.startsWith(prevLower)) {
      cleaned[cleaned.length - 1] = seg;
    } else if (prevLower.startsWith(segLower)) {
      // Ignore redundant subset
      continue;
    } else {
      cleaned.push(seg);
    }
  }
  return cleaned.join(' ').replace(/\s+/g, ' ').trim();
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
  const [activeLocale, setActiveLocale] = useState<string>(
    SPEECH_LANG_MAP[language] || 'en-NG'
  );
  const [toast, setToast] = useState<SpeechToast | null>(null);
  const [isStandalonePwa, setIsStandalonePwa] = useState<boolean>(() =>
    isStandalonePwaEnvironment()
  );

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const userStoppedRef = useRef<boolean>(false);
  const baseTextRef = useRef<string>('');
  const priorEpochsTextRef = useRef<string>('');
  const currentEpochTextRef = useRef<string>('');
  const fallbackAttemptedRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<number | null>(null);
  const levelDecayTimerRef = useRef<number | null>(null);

  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onSpeechEndRef = useRef(onSpeechEnd);

  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd;
  }, [onSpeechEnd]);

  useEffect(() => {
    setActiveLocale(SPEECH_LANG_MAP[language] || 'en-NG');
  }, [language]);

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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 8500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (levelDecayTimerRef.current) {
      window.clearInterval(levelDecayTimerRef.current);
      levelDecayTimerRef.current = null;
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
      clearTimers();
    };
  }, [clearTimers]);

  const pulseVoiceActivity = useCallback((intensity = 68) => {
    setVoiceLevel(Math.min(100, Math.max(22, intensity)));
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const finalizeAndStop = useCallback(() => {
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

    clearTimers();
    setIsListening(false);
    setIsTranscribing(false);
    setInterimTranscript('');
    onSpeechEndRef.current?.();
  }, [clearTimers]);

  const stopListening = useCallback(() => {
    finalizeAndStop();
  }, [finalizeAndStop]);

  const launchRecognizer = useCallback(
    (langCode: string, currentInputText: string, isAutoRestart = false) => {
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
      setActiveLocale(langCode);

      // Request up to 5 acoustic alternatives so `pickBestAlternative` can score
      // Nigerian market vocabulary, products, and numbers accurately.
      recognition.maxAlternatives = 5;
      recognition.interimResults = true;

      // Enable continuous mode so there is zero restart gap mid-sentence.
      // (We use `mergeCumulativeSegments` below so mobile Android Chrome never duplicates text.)
      recognition.continuous = true;

      if (!isAutoRestart) {
        baseTextRef.current = currentInputText.trim();
        priorEpochsTextRef.current = '';
        currentEpochTextRef.current = '';
      } else if (currentEpochTextRef.current) {
        priorEpochsTextRef.current = mergeCumulativeSegments([
          priorEpochsTextRef.current,
          currentEpochTextRef.current
        ]);
        currentEpochTextRef.current = '';
      }

      recognition.onstart = () => {
        setIsListening(true);
        if (!isAutoRestart) {
          setInterimTranscript('');
          setToast(null);
          playAudioCue('start');
          pulseVoiceActivity(30);

          if (levelDecayTimerRef.current) {
            window.clearInterval(levelDecayTimerRef.current);
          }
          levelDecayTimerRef.current = window.setInterval(() => {
            setVoiceLevel(prev => (prev > 14 ? Math.round(prev * 0.82) : 12));
          }, 140);
        }
      };

      recognition.onspeechstart = () => {
        pulseVoiceActivity(72);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const finalSegments: string[] = [];
        const interimSegments: string[] = [];

        // Traverse all results in the current recognition epoch and deduplicate
        // cumulative Android Chrome segments while rejecting background noise fillers.
        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const { transcript, confidence } = pickBestAlternative(result);
          const trimmed = transcript.trim();
          if (!trimmed) continue;

          const isNoiseFiller = NOISE_FILLER_RE.test(trimmed);

          if (result.isFinal) {
            // Reject single-syllable background noise hallucinations
            if (isNoiseFiller && trimmed.length <= 4) {
              continue;
            }
            if (confidence > 0 && confidence < 0.22 && trimmed.length <= 3) {
              continue;
            }
            finalSegments.push(sharpenTraderTranscript(trimmed));
          } else if (!isNoiseFiller) {
            interimSegments.push(trimmed);
          }
        }

        const epochFinal = sharpenTraderTranscript(
          mergeCumulativeSegments(finalSegments)
        );
        const cleanInterim = sharpenTraderTranscript(
          mergeCumulativeSegments(interimSegments)
        );

        currentEpochTextRef.current = epochFinal;
        setInterimTranscript(cleanInterim);

        // Pulse the visual voice meter proportional to active speech
        pulseVoiceActivity(cleanInterim ? 88 : epochFinal ? 65 : 32);

        const fullSessionText = sharpenTraderTranscript(
          mergeCumulativeSegments([
            priorEpochsTextRef.current,
            currentEpochTextRef.current
          ])
        );

        const combined = [baseTextRef.current, fullSessionText, cleanInterim]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        onTranscriptChangeRef.current(combined);

        // Once speech has been captured, auto-complete after 4.0 seconds of silence
        if (fullSessionText || cleanInterim) {
          if (silenceTimerRef.current) {
            window.clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = window.setTimeout(() => {
            if (
              !userStoppedRef.current &&
              (priorEpochsTextRef.current || currentEpochTextRef.current)
            ) {
              playAudioCue('stop');
              finalizeAndStop();
            }
          }, 4000);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const errorCode = (event.error || '').toLowerCase();

        // Seamless fallback to Nigerian English ('en-NG') if the device OS
        // does not have an offline/online pack for pcm-NG, yo-NG, ha-NG, or ig-NG
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

        // Ignore transient 'no-speech' events while the trader is still holding the session open
        if (errorCode === 'no-speech' && !userStoppedRef.current) {
          return;
        }

        if (errorCode === 'aborted') {
          return;
        }

        userStoppedRef.current = true;
        clearTimers();
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
        // If the browser/mobile OS closed the recognition epoch due to a brief pause
        // and the trader hasn't tapped Done yet, seamlessly continue listening
        if (!userStoppedRef.current) {
          try {
            launchRecognizer(langCode, baseTextRef.current, true);
            return;
          } catch {
            // fall through to finalize
          }
        }
        finalizeAndStop();
      };

      try {
        recognition.start();
      } catch {
        userStoppedRef.current = true;
        clearTimers();
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
    [
      clearTimers,
      copy,
      finalizeAndStop,
      isStandalonePwa,
      pulseVoiceActivity
    ]
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

      // Launch SpeechRecognition synchronously inside the user gesture with exclusive
      // hardware microphone access (no competing getUserMedia stream) for maximum mobile PWA clarity.
      launchRecognizer(speechLang, currentInputText, false);
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
    isTranscribing,
    voiceLevel,
    interimTranscript,
    speechLang: activeLocale,
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
