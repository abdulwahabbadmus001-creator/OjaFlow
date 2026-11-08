import type { LanguagePreference } from '../types';

export const LOCALIZED_TRADER_SECURITY_QUESTIONS: Record<
  LanguagePreference,
  readonly string[]
> = {
  en: [
    'What is the primary market name or location where you trade?',
    'What is the main item or product you sell most?',
    'What is your business nickname or popular shop alias?',
    'What is the first name of your first regular customer or supplier?',
    'What town or street did you open your first shop or stall in?'
  ],
  pcm: [
    'Wetin be the main market name or area wey you dey trade?',
    'Wetin be my best item to sell?',
    'Wetin be your popular shop alias or business nickname?',
    'Wetin be the first name of your number one customer or supplier?',
    'Which town or street you first open your shop or table?'
  ],
  yo: [
    'Kí ni orúkọ ọjà mi?',
    'Kí ni ohun tí mo fẹ́ràn láti tà jùlọ?',
    'Kí ni orúkọ ìnagijẹ iṣẹ́ tàbí ṣọ́ọ̀bù mi?',
    'Kí ni orúkọ oníbàárà tàbí aláàánú mi àkọ́kọ́?',
    'Ìlú tàbí òpópónà wo ni mo ti kọ́kọ́ ṣí ṣọ́ọ̀bù mi?'
  ],
  ha: [
    'Mene ne sunan babbar kasuwar da kake/kike ciniki?',
    'Mene ne babban kayan da kake/kike fi sayarwa?',
    'Mene ne lakabin kasuwancinka ko sunan shagonka?',
    'Mene ne sunan abokin cinikinka ko mai kawo kaya na farko?',
    'A wane gari ko titi ka/kika fara buɗe shago ko tebur?'
  ],
  ig: [
    'Kedu aha ahịa ebe ị na-azụ ahịa?',
    "Kedu ngwaahịa kacha ere n'ụlọ ahịa gị?",
    'Kedu aha otutu azụmahịa ma ọ bụ ọdụ ahịa gị?',
    'Kedu aha onye ahịa ma ọ bụ onye na-ebubata ngwaahịa mbụ gị?',
    'Kedu obodo ma ọ bụ okporo ụzọ ị meghere ụlọ ahịa mbụ gị?'
  ]
};

export const TRADER_SECURITY_QUESTIONS =
  LOCALIZED_TRADER_SECURITY_QUESTIONS.en;

export const LOCALIZED_CUSTOM_QUESTION_PLACEHOLDERS: Record<
  LanguagePreference,
  string
> = {
  en: 'e.g. What is the name of my first apprentice?',
  pcm: 'e.g. Wetin be my best item to sell?',
  yo: 'e.g. Kí ni orúkọ ọjà mi?',
  ha: 'e.g. Mene ne sunan kasuwar da nake ciniki?',
  ig: 'e.g. Kedu aha ahịa ebe m na-ere ahịa?'
};

export const LOCALIZED_ANSWER_PLACEHOLDERS: Record<
  LanguagePreference,
  string
> = {
  en: 'e.g. Balogun Market / Bags of rice / Mama T',
  pcm: 'e.g. Balogun Market / Bag of rice / Mama T',
  yo: 'e.g. Ọjà Balógun / Àpò ìrẹsì / Mama T',
  ha: 'e.g. Kasuwar Kurmi / Buhun shinkafa / Hajiya Amina',
  ig: 'e.g. Ahịa Ariaria / Akpa osikapa / Mama Ngozi'
};
