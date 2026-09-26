import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { LanguagePreference } from '../types';
import { localeForLanguage, t } from './language';

type Vars = Record<string, string | number>;

const LanguageContext = createContext<LanguagePreference>('en');

export function LanguageProvider({
  language,
  children
}: {
  language: LanguagePreference | undefined;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language || 'en'}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const language = useContext(LanguageContext);

  return useMemo(() => ({
    language,
    tr: (key: string, vars?: Vars) => t(language, key, vars),
    locale: localeForLanguage(language)
  }), [language]);
}
