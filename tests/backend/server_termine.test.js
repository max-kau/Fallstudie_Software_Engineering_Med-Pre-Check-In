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

// ============================================
// Helper: Login as praxis user and return session cookie
// ============================================
import bcrypt from 'bcryptjs';

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
    praxis_name: 'Testpraxis München',
    praxis_fachbereich: 'Allgemeinmedizin',
    praxis_adresse: 'Teststr. 1, 80000 München',
    praxis_telefon: '089/123456',
    opening_hours: null
  };

  // 1. Login query: find user
  mockQuery.mockResolvedValueOnce({ rows: [mockPraxisUser] });
  // 2. Auto-link appointments query
  mockQuery.mockResolvedValueOnce({ rowCount: 0 });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'praxis@test.de', password, role: 'praxis' }),
    redirect: 'manual'
  });

  expect(loginRes.status).toBe(200);

  // Extract session cookie
  const setCookieHeader = loginRes.headers.get('set-cookie') || loginRes.headers.getSetCookie?.()?.join('; ');
  const cookie = typeof setCookieHeader === 'string'
    ? setCookieHeader.split(';')[0]
    : Array.isArray(setCookieHeader)
      ? setCookieHeader.map(c => c.split(';')[0]).join('; ')
      : '';

  return cookie;
}

// ============================================
// POST /api/praxis/termine/buchen
// ============================================
describe('Backend Termin API - POST /api/praxis/termine/buchen (Telefonischer Termin)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should return 403 without praxis session', async () => {
    const response = await fetch(`${baseUrl}/api/praxis/termine/buchen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(response.status).toBe(403);
  });

  it('should return 400 when required fields are missing', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const response = await fetch(`${baseUrl}/api/praxis/termine/buchen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        patientEmail: 'patient@example.com',
        patientVorname: 'Max'
        // patientNachname, doctor, date, time, art missing
      })
    });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Alle Felder');
  });

  it('should successfully create an appointment with Vorname and Nachname', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // Mocks for validateAppointmentTime: 1) opening hours query, 2) buffer times query
    mockQuery.mockResolvedValueOnce({ rows: [] }); // opening hours: none found → use defaults
    mockQuery.mockResolvedValueOnce({ rows: [] }); // buffer times: none

    // 3. Check if patient exists
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no existing patient

    // 4. Slot check: no duplicate
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // 5. INSERT appointment
    const mockAppt = {
      code: 't_TEST1234',
      doctor: 'Dr. Anna Hartmann',
      date: '2026-08-20',
      time: '10:00',
      art: 'Erstgespräch',
      praxis: 'Testpraxis München',
      patient_vorname: 'Max',
      patient_nachname: 'Mustermann',
      notify_email: 'max@example.com'
    };
    mockQuery.mockResolvedValueOnce({ rows: [mockAppt] });

    const response = await fetch(`${baseUrl}/api/praxis/termine/buchen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        patientEmail: 'max@example.com',
        patientVorname: 'Max',
        patientNachname: 'Mustermann',
        doctor: 'Dr. Anna Hartmann',
        date: '2026-08-20',
        time: '10:00',
        art: 'Erstgespräch'
      })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.appointment).toBeDefined();
    expect(data.appointment.patient_vorname).toBe('Max');
    expect(data.appointment.patient_nachname).toBe('Mustermann');
  });

  it('should reject booking when slot is already taken', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // validateAppointmentTime mocks
    mockQuery.mockResolvedValueOnce({ rows: [] }); // opening hours
    mockQuery.mockResolvedValueOnce({ rows: [] }); // buffer times

    // Patient lookup
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Slot check: already booked
    mockQuery.mockResolvedValueOnce({ rows: [{ code: 'existing_appt' }] });

    const response = await fetch(`${baseUrl}/api/praxis/termine/buchen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        patientEmail: 'other@example.com',
        patientVorname: 'Hans',
        patientNachname: 'Schmidt',
        doctor: 'Dr. Anna Hartmann',
        date: '2026-08-20',
        time: '10:00',
        art: 'Routineuntersuchung'
      })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('bereits vergeben');
  });
});

// ============================================
// PUT /api/praxis/termin/:code/duration
// ============================================
describe('Backend Termin API - PUT /api/praxis/termin/:code/duration', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should return 403 without praxis session', async () => {
    const response = await fetch(`${baseUrl}/api/praxis/termin/test_code/duration`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration: 45 })
    });
    expect(response.status).toBe(403);
  });

  it('should return 400 when duration is less than 15 minutes', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const response = await fetch(`${baseUrl}/api/praxis/termin/test_code/duration`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ duration: 10 })
    });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Mindestdauer');
  });

  it('should successfully update appointment duration', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // 1. Check appointment exists for this praxis
    mockQuery.mockResolvedValueOnce({ rows: [{ code: 'appt_dur_1' }] });
    // 2. UPDATE duration
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // 3. SELECT updated appointment for conflict check
    mockQuery.mockResolvedValueOnce({ rows: [{ date: '2026-08-20', time: '10:00', duration: 60 }] });
    // 4. SELECT other appointments on same day
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const response = await fetch(`${baseUrl}/api/praxis/termin/appt_dur_1/duration`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ duration: 60 })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.conflicts).toEqual([]);
  });

  it('should return 404 when appointment does not belong to praxis', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // Check returns empty – appointment not found for this praxis
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const response = await fetch(`${baseUrl}/api/praxis/termin/unknown_code/duration`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ duration: 45 })
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('nicht gefunden');
  });
});
