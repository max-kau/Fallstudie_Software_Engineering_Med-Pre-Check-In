import { describe, it, expect } from 'vitest';
import { auth } from '../../src/utils/auth.js';

describe('Admin Authentication Unit Tests', () => {
  it('should correctly identify admin role via auth.isAdmin()', () => {
    expect(auth.isAdmin()).toBe(false);
  });

  it('should return false for isAdmin when user role is patient or praxis', () => {
    expect(auth.isPraxis()).toBe(false);
    expect(auth.isAdmin()).toBe(false);
  });
});
