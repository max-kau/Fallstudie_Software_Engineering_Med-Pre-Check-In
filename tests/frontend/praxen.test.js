import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPraxen, praxen } from '../../src/data/praxen.js';

describe('praxen.js - fetchPraxen()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fall back to static practices on API failure', async () => {
    // Mock fetch to reject
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchPraxen();
    
    // Result should still contain static practices
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Praxis am Stadtpark');
  });

  it('should successfully fetch practices and deduplicate by name', async () => {
    const mockDbPractices = [
      {
        id: 101,
        name: 'Praxis am Stadtpark', // Duplicate of static id 1
        fachbereich: 'Allgemeinmedizin',
        adresse: 'New Address 1'
      },
      {
        id: 102,
        name: 'Dr. Neue Praxis', // Brand new practice
        fachbereich: 'Kardiologie',
        adresse: 'Teststraße 5'
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        praxen: mockDbPractices
      })
    });

    const result = await fetchPraxen();

    // Check that 'Dr. Neue Praxis' is added
    const newPractice = result.find(p => p.id === 102);
    expect(newPractice).toBeDefined();
    expect(newPractice.name).toBe('Dr. Neue Praxis');

    // Deduplication check: 'Praxis am Stadtpark' should only appear once
    const stadtparkInstances = result.filter(p => p.name.toLowerCase().trim() === 'praxis am stadtpark');
    expect(stadtparkInstances.length).toBe(1);
    
    // The database version (id: 101) should take precedence over the static one (id: 1)
    expect(stadtparkInstances[0].id).toBe(101);
  });
});
