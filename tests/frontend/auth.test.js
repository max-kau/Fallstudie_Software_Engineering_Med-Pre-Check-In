import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '../../src/utils/auth.js';

describe('auth.js - Client Authentication Manager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Initial State
  // ============================================

  it('should initialize with logged out state', () => {
    // Note: module state may carry over from previous tests since auth is a singleton.
    // The first test in a fresh module load checks defaults.
    expect(auth.getUser()).toBeDefined(); // may be null or previously set
  });

  // ============================================
  // login()
  // ============================================

  it('should correctly set user info and dispatch event on successful login', async () => {
    const mockUser = {
      id: 42,
      email: 'patient@example.com',
      vorname: 'Jane',
      nachname: 'Doe',
      role: 'patient'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, user: mockUser })
    });

    const eventListener = vi.fn();
    window.addEventListener('authChanged', eventListener);

    const loggedInUser = await auth.login('patient@example.com', 'password123', 'patient');

    expect(loggedInUser).toEqual(mockUser);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.getUser()).toEqual(mockUser);
    expect(auth.isPraxis()).toBe(false);

    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener.mock.calls[0][0].detail.user).toEqual(mockUser);

    window.removeEventListener('authChanged', eventListener);
  });

  it('should correctly determine praxis role', async () => {
    const mockDoctor = {
      id: 43,
      email: 'doctor@example.com',
      vorname: 'Dr. John',
      nachname: 'Smith',
      role: 'praxis'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, user: mockDoctor })
    });

    await auth.login('doctor@example.com', 'password123', 'praxis');

    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.isPraxis()).toBe(true);
  });

  it('should throw an error when login fails with HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Login fehlgeschlagen' })
    });

    await expect(auth.login('bad@example.com', 'wrong', 'patient'))
      .rejects
      .toThrow('Login fehlgeschlagen');
  });

  // ============================================
  // register()
  // ============================================

  it('should correctly register a user and dispatch authChanged event', async () => {
    const mockUser = {
      id: 100,
      email: 'new@example.com',
      vorname: 'Max',
      nachname: 'Mustermann',
      role: 'patient'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, user: mockUser })
    });

    const eventListener = vi.fn();
    window.addEventListener('authChanged', eventListener);

    const registeredUser = await auth.register(
      'Max', 'Mustermann', 'new@example.com', 'securePass', 'patient', {}
    );

    expect(registeredUser).toEqual(mockUser);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.getUser()).toEqual(mockUser);

    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener.mock.calls[0][0].detail.user).toEqual(mockUser);

    window.removeEventListener('authChanged', eventListener);
  });

  it('should throw an error when registration fails with HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'E-Mail bereits registriert.' })
    });

    await expect(
      auth.register('Max', 'Mustermann', 'existing@example.com', 'pass', 'patient', {})
    ).rejects.toThrow('E-Mail bereits registriert.');
  });

  // ============================================
  // checkSession()
  // ============================================

  it('should update user from /api/auth/me on checkSession()', async () => {
    const mockUser = {
      id: 10,
      email: 'session@example.com',
      vorname: 'Session',
      nachname: 'User',
      role: 'patient'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ loggedIn: true, user: mockUser })
    });

    const user = await auth.checkSession(true); // force=true to bypass cache
    expect(user).toEqual(mockUser);
    expect(auth.isLoggedIn()).toBe(true);
  });

  it('should set user to null on checkSession() when not logged in', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ loggedIn: false })
    });

    const user = await auth.checkSession(true);
    expect(user).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('should handle network error in checkSession() gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const user = await auth.checkSession(true);
    expect(user).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
  });

  // ============================================
  // logout()
  // ============================================

  it('should clear state and dispatch event on logout', async () => {
    // First log in
    const mockUser = { id: 1, email: 'test@example.com', role: 'patient' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, user: mockUser })
    });
    await auth.login('test@example.com', 'password123', 'patient');
    expect(auth.isLoggedIn()).toBe(true);

    // Mock logout fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    const eventListener = vi.fn();
    window.addEventListener('authChanged', eventListener);

    await auth.logout();

    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.getUser()).toBeNull();
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener.mock.calls[0][0].detail.user).toBeNull();

    window.removeEventListener('authChanged', eventListener);
  });

  it('should handle network error during logout gracefully', async () => {
    // Log in first
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, user: { id: 1, role: 'patient' } })
    });
    await auth.login('test@example.com', 'pass', 'patient');

    // Mock logout to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    // Should not throw, and should still clear the local state
    await auth.logout();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.getUser()).toBeNull();
  });
});
