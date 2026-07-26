import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';

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

beforeAll(async () => {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

async function loginAsPraxis() {
  const password = 'testpass123';
  const hashedPassword = bcrypt.hashSync(password, 10);
  const mockPraxisUser = {
    id: 99,
    email: 'praxis@test.de',
    password_hash: hashedPassword,
    vorname: 'Dr. Anna',
    nachname: 'Hartmann',
    role: 'praxis',
    praxis_name: 'Testpraxis München'
  };

  mockQuery.mockResolvedValueOnce({ rows: [mockPraxisUser] });
  mockQuery.mockResolvedValueOnce({ rowCount: 0 });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'praxis@test.de', password, role: 'praxis' }),
    redirect: 'manual'
  });

  const setCookieHeader = loginRes.headers.get('set-cookie') || loginRes.headers.getSetCookie?.()?.join('; ');
  const cookie = typeof setCookieHeader === 'string'
    ? setCookieHeader.split(';')[0]
    : Array.isArray(setCookieHeader)
      ? setCookieHeader.map(c => c.split(';')[0]).join('; ')
      : '';

  return cookie;
}

describe('Backend Activity Log API - /api/praxis/activity-logs', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should return 403 for GET /api/praxis/activity-logs without praxis session', async () => {
    const response = await fetch(`${baseUrl}/api/praxis/activity-logs`);
    expect(response.status).toBe(403);
  });

  it('should return activity logs list for authenticated praxis', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // 1. Purge query
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    // 2. Select logs query
    const mockLogs = [
      {
        id: 1,
        praxis_id: 99,
        praxis_name: 'Testpraxis München',
        patient_id: 42,
        patient_name: 'Max Mustermann',
        termin_code: 'LOGTEST1',
        status: 'erschienen',
        action: 'Patient ist zum Termin erschienen',
        staff_name: 'praxis@test.de',
        timestamp: new Date().toISOString()
      }
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockLogs });

    const response = await fetch(`${baseUrl}/api/praxis/activity-logs`, {
      headers: { 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.logs).toHaveLength(1);
    expect(data.logs[0].termin_code).toBe('LOGTEST1');
    expect(data.logs[0].status).toBe('erschienen');
  });

  it('should return 400 on POST when action or status is missing', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const response = await fetch(`${baseUrl}/api/praxis/activity-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ patientName: 'Max Mustermann' })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Pflichtfelder');
  });

  it('should successfully save a manual activity log entry', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const response = await fetch(`${baseUrl}/api/praxis/activity-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        patientName: 'Max Mustermann',
        terminCode: 'LOGTEST2',
        status: 'in_treatment',
        action: 'Behandlung manuell gestartet'
      })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('erfolgreich');
  });
});
