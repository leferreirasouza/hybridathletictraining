import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';
import autoEn from './locales/auto-en.json';
import autoPtBR from './locales/auto-pt-BR.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: { ...en, auto: autoEn } },
      'pt-BR': { translation: { ...ptBR, auto: autoPtBR } },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ha-language',
      caches: ['localStorage'],
    },
  });

export default i18n;
