import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DATABASE_URL = 'postgres://localhost/mock_test_db';

vi.mock('pg', () => {
  const mockQuery = vi.fn();
  class MockPool {
    constructor() {
      this.query = mockQuery;
    }
    on() {}
    async end() {}
  }
  return {
    default: {
      Pool: MockPool,
      mockQuery: mockQuery
    }
  };
});

vi.mock('nodemailer', () => {
  return {
    default: {
      createTransport: vi.fn().mockReturnValue({
        sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id' }),
        verify: vi.fn().mockResolvedValue(true)
      })
    }
  };
});

import pg from 'pg';
const { mockQuery } = pg;
import { app } from '../../server.js';

let server;
let baseUrl;

describe('Datengestützte Behandlungsdauer & Analysis API', () => {
  beforeAll(() => {
    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/praxis/terminarten/analyse - liefert Analyse-Daten pro Terminart', async () => {
    const res = await fetch(`${baseUrl}/api/praxis/terminarten/analyse`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(Array.isArray(data.analysis)).toBe(true);
    expect(data.analysis.length).toBeGreaterThan(0);

    const routine = data.analysis.find(a => a.art === 'Routineuntersuchung');
    expect(routine).toBeDefined();
    expect(routine.manualDuration).toBe(15);
    expect(routine.effectiveDuration).toBeGreaterThan(0);
    expect(routine.useAuto).toBe(true);
  });

  it('GET /api/praxis/terminarten/dauer - liefert empfohlene Dauer für spezifische Terminart', async () => {
    const res = await fetch(`${baseUrl}/api/praxis/terminarten/dauer?art=Erstgespr%C3%A4ch`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.art).toBe('Erstgespräch');
    expect(data.effectiveDuration).toBeGreaterThanOrEqual(15);
  });

  it('PUT /api/praxis/terminarten/einstellungen - verweigert unangemeldeten Zugriff mit 403', async () => {
    const res = await fetch(`${baseUrl}/api/praxis/terminarten/einstellungen`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ art: 'Routineuntersuchung', manualDuration: 20, useAuto: false })
    });
    expect(res.status).toBe(403);
  });
});
