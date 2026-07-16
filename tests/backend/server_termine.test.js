import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Define process.env.DATABASE_URL to trigger DB mode in server.js
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

describe('Backend Termin API - /api/termin/:code', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ============================================
  // GET /api/termin/:code
  // ============================================

  it('should return appointment details if found in the database', async () => {
    const mockRow = {
      code: 'appt_001',
      doctor: 'Dr. med. Anna Hartmann',
      fachrichtung: 'Allgemeinmedizin',
      adresse: 'Leopoldstraße 12, 80802 München',
      date: 'Mo, 25. Mai',
      time: '09:30',
      art: 'Routineuntersuchung',
      praxis: 'Hausarztpraxis',
      tags: ['Kassenpatienten'],
      patient_vorname: 'Max',
      patient_nachname: 'Mustermann'
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

    const response = await fetch(`${baseUrl}/api/termin/appt_001`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.termin).toBeDefined();
    expect(data.termin.code).toBe('appt_001');
    expect(data.termin.doctor).toBe('Dr. med. Anna Hartmann');
    expect(data.termin.date).toBe('Mo, 25. Mai');
    expect(data.termin.time).toBe('09:30');
    expect(data.patient).toBeDefined();
    expect(data.patient.vorname).toBe('Max');
    expect(data.patient.nachname).toBe('Mustermann');
  });

  it('should auto-seed a demo appointment if not found in DB', async () => {
    // 1. SELECT returns nothing
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // 2. INSERT demo appointment succeeds
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const response = await fetch(`${baseUrl}/api/termin/demo_new_code`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.termin).toBeDefined();
    expect(data.termin.code).toBe('demo_new_code');
    expect(data.termin.doctor).toBe('Dr. med. Anna Hartmann');
    expect(data.patient.vorname).toBe('Max');
    expect(data.patient.nachname).toBe('Mustermann');

    // Verify INSERT was called
    expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO termine');
  });

  it('should return 500 when database throws an error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const response = await fetch(`${baseUrl}/api/termin/error_code`);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Database fetch error');
  });
});

describe('Backend Termin API - /api/health', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should return health status with database info', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ now: '2026-07-16T20:00:00Z' }] });

    const response = await fetch(`${baseUrl}/api/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.database).toBe('connected');
    expect(data.queryTest).toBe('success');
    expect(data.dbTime).toBeDefined();
  });

  it('should report query failure when DB query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    const response = await fetch(`${baseUrl}/api/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.database).toBe('connected'); // Pool initialized, but query fails
    expect(data.queryTest).toBe('failed');
    expect(data.queryError).toContain('Connection refused');
  });
});

describe('Backend Termin API - /api/praxen', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should return registered practices from the database', async () => {
    const mockPraxen = [
      {
        id: 1,
        vorname: 'Dr.',
        nachname: 'Müller',
        praxis_name: 'Praxis Müller',
        praxis_fachbereich: 'Allgemeinmedizin',
        praxis_adresse: 'Hauptstraße 1',
        praxis_telefon: '0123/456789'
      }
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockPraxen });

    const response = await fetch(`${baseUrl}/api/praxen`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.praxen).toBeInstanceOf(Array);
    expect(data.praxen.length).toBeGreaterThan(0);
    expect(data.praxen[0].name).toBe('Praxis Müller');
  });
});
