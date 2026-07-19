import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { store } from '../../src/utils/store.js';

describe('store.js - State Management', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation
    });
  });

  // ============================================
  // getDefaultData()
  // ============================================

  it('should initialize with default data containing all required fields', () => {
    const defaultData = store.getDefaultData();
    expect(defaultData).toHaveProperty('terminCode');
    expect(defaultData).toHaveProperty('sessionId');
    expect(defaultData).toHaveProperty('currentStep', 'intro');

    // Beschwerden defaults
    expect(defaultData.beschwerden).toHaveProperty('freitext', '');
    expect(defaultData.beschwerden.chips).toEqual([]);
    expect(defaultData.beschwerden.customKeywords).toEqual([]);
    expect(defaultData.beschwerden.showCustomInput).toBe(false);
    expect(defaultData.beschwerden.dauer).toBe('');
    expect(defaultData.beschwerden.staerke).toBeNull();

    // Medikamente defaults
    expect(defaultData.medikamente.liste).toEqual([]);
    expect(defaultData.medikamente.keine).toBe(false);

    // Allergien defaults
    expect(defaultData.allergien.liste).toEqual([]);
    expect(defaultData.allergien.chips).toEqual([]);
    expect(defaultData.allergien.keine).toBe(false);
    expect(defaultData.allergien.anmerkungen).toBe('');

    // Dokumente defaults
    expect(defaultData.dokumente.liste).toEqual([]);

    // Additional fields
    expect(defaultData.signature).toBeNull();
    expect(defaultData.submitted).toBe(false);
    expect(defaultData.customAnswers).toEqual({});
    expect(defaultData.documentConfirmations).toEqual({});
    expect(defaultData.aiQuestions).toEqual([]);
    expect(defaultData.aiConsent).toBeNull();
  });

  // ============================================
  // getTerminCode() - URL parsing
  // ============================================

  it('should read the correct termin code from URL search parameters', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '?termin=test_code_123', hash: '' }
    });
    expect(store.getTerminCode()).toBe('test_code_123');
  });

  it('should read the correct termin code from hash query parameters', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '', hash: '#intro?termin=hash_code_456' }
    });
    expect(store.getTerminCode()).toBe('hash_code_456');
  });

  it('should fall back to sessionStorage for termin code', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '', hash: '' }
    });
    sessionStorage.setItem('_last_termin_code', 'stored_code_789');
    expect(store.getTerminCode()).toBe('stored_code_789');
  });

  it('should fall back to demo_12345 when no termin code is available anywhere', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '', hash: '' }
    });
    // Ensure sessionStorage has no stored code either
    sessionStorage.removeItem('_last_termin_code');
    expect(store.getTerminCode()).toBe('demo_12345');
  });

  // ============================================
  // set() / get()
  // ============================================

  it('should set and get values correctly', () => {
    store.clear();
    const desc = {
      freitext: 'Kopfschmerzen',
      chips: [],
      customKeywords: [],
      showCustomInput: false,
      dauer: '2 Tage',
      staerke: 5
    };
    store.set('beschwerden', desc);
    expect(store.get('beschwerden')).toEqual(desc);
  });

  // ============================================
  // clear()
  // ============================================

  it('should remove store entry from sessionStorage on clear()', () => {
    // Write some data first
    store.set('beschwerden', { freitext: 'Test' });
    expect(store.get('beschwerden')).toBeDefined();

    // Clear should remove the data
    store.clear();

    // After clear, getAll() returns default data (fresh)
    const data = store.getAll();
    expect(data.beschwerden.freitext).toBe('');
  });

  // ============================================
  // hasSavedProgress()
  // ============================================

  it('should return false for hasSavedProgress() on fresh/default state', () => {
    store.clear();
    expect(store.hasSavedProgress()).toBe(false);
  });

  it('should return true for hasSavedProgress() when beschwerden freitext is filled', () => {
    store.clear();
    store.set('beschwerden', {
      freitext: 'Starke Kopfschmerzen',
      chips: [],
      customKeywords: [],
      showCustomInput: false,
      dauer: '',
      staerke: null
    });
    expect(store.hasSavedProgress()).toBe(true);
  });

  it('should return true for hasSavedProgress() when medikamente are added', () => {
    store.clear();
    store.set('medikamente', {
      liste: ['Ibuprofen'],
      keine: false
    });
    expect(store.hasSavedProgress()).toBe(true);
  });

  it('should return true for hasSavedProgress() when medikamente.keine is checked', () => {
    store.clear();
    store.set('medikamente', {
      liste: [],
      keine: true
    });
    expect(store.hasSavedProgress()).toBe(true);
  });

  it('should return true for hasSavedProgress() when allergien chips are selected', () => {
    store.clear();
    store.set('allergien', {
      liste: [],
      chips: ['Penicillin'],
      keine: false,
      anmerkungen: ''
    });
    expect(store.hasSavedProgress()).toBe(true);
  });

  it('should return true for hasSavedProgress() when navigated past intro steps', () => {
    store.clear();
    store.set('currentStep', 'beschwerden');
    expect(store.hasSavedProgress()).toBe(true);
  });

  it('should return false for hasSavedProgress() when submitted is true', () => {
    store.clear();
    store.set('beschwerden', {
      freitext: 'Daten vorhanden',
      chips: [],
      customKeywords: [],
      showCustomInput: false,
      dauer: '',
      staerke: null
    });
    store.set('submitted', true);
    expect(store.hasSavedProgress()).toBe(false);
  });

  it('should return true for hasSavedProgress() when a signature exists', () => {
    store.clear();
    store.set('signature', 'data:image/png;base64,iVBOR...');
    expect(store.hasSavedProgress()).toBe(true);
  });

  // ============================================
  // resetProgress()
  // ============================================

  it('should reset all progress and generate a new session ID', () => {
    store.clear();
    store.set('beschwerden', {
      freitext: 'Rückenschmerzen',
      chips: ['Schmerzen'],
      customKeywords: [],
      showCustomInput: false,
      dauer: '1 Woche',
      staerke: 7
    });
    store.set('medikamente', { liste: ['Aspirin'], keine: false });
    store.set('currentStep', 'medikamente');

    const oldSessionId = store.getAll().sessionId;

    // Reset
    store.resetProgress();

    const freshData = store.getAll();
    expect(freshData.beschwerden.freitext).toBe('');
    expect(freshData.medikamente.liste).toEqual([]);
    expect(freshData.currentStep).toBe('intro');
    expect(freshData.submitted).toBe(false);
    // Session ID should be different after reset
    expect(freshData.sessionId).not.toBe(oldSessionId);
  });

  // ============================================
  // File upload and deletion
  // ============================================

  it('should successfully upload a file and update store state', async () => {
    const mockFile = new File(['hello'], 'test.png', { type: 'image/png' });
    const mockUploadedFile = { id: 123, filename: 'test.png', mime_type: 'image/png', file_size: 5 };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, file: mockUploadedFile })
    });

    const result = await store.uploadFile(mockFile);
    expect(result).toEqual(mockUploadedFile);

    const docs = store.get('dokumente');
    expect(docs.liste).toContainEqual(mockUploadedFile);
  });

  it('should fail upload when server returns error status', async () => {
    const mockFile = new File(['hello'], 'test.png', { type: 'image/png' });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false
    });

    await expect(store.uploadFile(mockFile)).rejects.toThrow();
  });

  it('should successfully delete a file and update store state', async () => {
    const mockUploadedFile = { id: 123, filename: 'test.png', mime_type: 'image/png', file_size: 5 };
    store.set('dokumente', { liste: [mockUploadedFile] });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true
    });

    await store.deleteFile(123);
    const docs = store.get('dokumente');
    expect(docs.liste).toEqual([]);
  });

  it('should fail delete when API returns error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false
    });

    await expect(store.deleteFile(123)).rejects.toThrow();
  });
});
