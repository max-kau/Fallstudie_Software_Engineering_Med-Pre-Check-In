import { describe, it, expect, beforeEach } from 'vitest';
import { t, getLanguage, setLanguage, translations } from '../../src/utils/i18n.js';

describe('i18n Internationalization Utility', () => {
  beforeEach(() => {
    setLanguage('de');
  });

  it('should default to German language', () => {
    expect(getLanguage()).toBe('de');
    expect(t('nav.search_praxis')).toBe('Praxis suchen');
  });

  it('should switch to English when setLanguage("en") is called', () => {
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('nav.search_praxis')).toBe('Search Practice');
    expect(t('nav.my_appointments')).toBe('My Appointments');
  });

  it('should return fallback or key if translation is missing', () => {
    expect(t('non_existent_key', 'Fallback Text')).toBe('Fallback Text');
  });
});
