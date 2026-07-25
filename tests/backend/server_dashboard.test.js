import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

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

// ============================================
// Helper: Login as praxis user and return session cookie
// ============================================
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

  mockQuery.mockResolvedValueOnce({ rows: [mockPraxisUser] });
  mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // auto-link

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'praxis@test.de', password, role: 'praxis' }),
    redirect: 'manual'
  });

  expect(loginRes.status).toBe(200);

  const setCookieHeader = loginRes.headers.get('set-cookie') || loginRes.headers.getSetCookie?.()?.join('; ');
  const cookie = typeof setCookieHeader === 'string'
    ? setCookieHeader.split(';')[0]
    : Array.isArray(setCookieHeader)
      ? setCookieHeader.map(c => c.split(';')[0]).join('; ')
      : '';

  return cookie;
}

// ============================================
// BUFFER TIMES (Pufferzeiten)
// ============================================
describe('Backend Dashboard API - Pufferzeiten (Buffer Times)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // GET /api/praxis/buffer-times
  it('should return 403 for buffer-times without praxis session', async () => {
    const response = await fetch(`${baseUrl}/api/praxis/buffer-times`);
    expect(response.status).toBe(403);
  });

  it('should return buffer times list for authenticated praxis', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const mockBufferTimes = [
      { id: 1, praxis_id: 99, title: 'Mittagspause', is_recurring: true, day_of_week: 1, start_time: '12:00', end_time: '13:00' },
      { id: 2, praxis_id: 99, title: 'Einmalige Pause', is_recurring: false, specific_date: '2026-08-15', start_time: '14:00', end_time: '14:30' }
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockBufferTimes });

    const response = await fetch(`${baseUrl}/api/praxis/buffer-times`, {
      headers: { 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.bufferTimes).toHaveLength(2);
    expect(data.bufferTimes[0].title).toBe('Mittagspause');
  });

  // POST /api/praxis/buffer-times
  it('should return 400 when start/end time is missing', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const response = await fetch(`${baseUrl}/api/praxis/buffer-times`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ title: 'Test', isRecurring: true, dayOfWeek: 1 })
    });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Start- und Endzeit');
  });

  it('should return 400 when startTime >= endTime', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const response = await fetch(`${baseUrl}/api/praxis/buffer-times`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ title: 'Test', isRecurring: true, dayOfWeek: 1, startTime: '14:00', endTime: '13:00' })
    });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Startzeit muss vor der Endzeit');
  });

  it('should return 400 when recurring buffer time has no dayOfWeek', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const response = await fetch(`${baseUrl}/api/praxis/buffer-times`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ title: 'Test', isRecurring: true, startTime: '12:00', endTime: '13:00' })
    });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Wochentag');
  });

  it('should successfully create a recurring buffer time', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const mockBt = {
      id: 10, praxis_id: 99, title: 'Mittagspause',
      is_recurring: true, day_of_week: 1,
      specific_date: null, start_time: '12:00', end_time: '13:00'
    };
    mockQuery.mockResolvedValueOnce({ rows: [] }); // Conflict check query (no conflicts)
    mockQuery.mockResolvedValueOnce({ rows: [mockBt] }); // Insert query

    const response = await fetch(`${baseUrl}/api/praxis/buffer-times`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        title: 'Mittagspause',
        isRecurring: true,
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '13:00'
      })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.bufferTime.title).toBe('Mittagspause');
    expect(data.bufferTime.is_recurring).toBe(true);
  });

  it('should return 400 when creating a buffer time colliding with a patient appointment', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // Mock query returning a conflicting appointment on a Monday (2026-08-03, dayOfWeek = 1)
    mockQuery.mockResolvedValueOnce({
      rows: [{
        code: 'T123',
        patient_vorname: 'Max',
        patient_nachname: 'Mustermann',
        date: '2026-08-03',
        time: '12:00',
        duration: 30
      }]
    });

    const response = await fetch(`${baseUrl}/api/praxis/buffer-times`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        title: 'Mittagspause',
        isRecurring: true,
        dayOfWeek: 1,
        startTime: '12:15',
        endTime: '13:00'
      })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Kollision');
  });

  // DELETE /api/praxis/buffer-times/:id
  it('should successfully delete a buffer time', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const response = await fetch(`${baseUrl}/api/praxis/buffer-times/10`, {
      method: 'DELETE',
      headers: { 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should handle DB error on delete gracefully', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const response = await fetch(`${baseUrl}/api/praxis/buffer-times/999`, {
      method: 'DELETE',
      headers: { 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Fehler');
  });
});

// ============================================
// PRAXIS DOCUMENTS (Dokumente)
// ============================================
describe('Backend Dashboard API - Praxis-Dokumente', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // GET /api/praxis/documents
  it('should return 403 for documents without praxis session', async () => {
    const response = await fetch(`${baseUrl}/api/praxis/documents`);
    expect(response.status).toBe(403);
  });

  it('should return documents list for authenticated praxis', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const mockDocs = [
      { id: 1, title: 'Datenschutzerklärung', doc_type: 'confirm', file_id: 'f1', filename: 'dse.pdf', file_size: 1024 }
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockDocs });

    const response = await fetch(`${baseUrl}/api/praxis/documents`, {
      headers: { 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].title).toBe('Datenschutzerklärung');
  });

  // POST /api/praxis/documents
  it('should return 400 when title or file data is missing', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    const response = await fetch(`${baseUrl}/api/praxis/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ title: 'Test' })
      // filename, mimeType, fileData missing
    });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Titel, Datei und Typ');
  });

  it('should successfully upload a praxis document', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // 1. INSERT into uploaded_files
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'file_42', filename: 'einwilligung.pdf', mime_type: 'application/pdf', file_size: 512 }] });
    // 2. INSERT into praxis_documents
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, title: 'Einwilligungserklärung', doc_type: 'accept_reject', file_id: 'file_42', created_at: '2026-07-19' }] });

    const response = await fetch(`${baseUrl}/api/praxis/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        title: 'Einwilligungserklärung',
        docType: 'accept_reject',
        filename: 'einwilligung.pdf',
        mimeType: 'application/pdf',
        fileData: 'SGVsbG8gV29ybGQ=' // base64 "Hello World"
      })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.document.title).toBe('Einwilligungserklärung');
    expect(data.document.doc_type).toBe('accept_reject');
  });

  // DELETE /api/praxis/documents/:id
  it('should return 404 when document does not exist', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // Document lookup returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const response = await fetch(`${baseUrl}/api/praxis/documents/9999`, {
      method: 'DELETE',
      headers: { 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('nicht gefunden');
  });

  it('should successfully delete a praxis document and its file', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // 1. Lookup document
    mockQuery.mockResolvedValueOnce({ rows: [{ file_id: 'file_42' }] });
    // 2. DELETE from praxis_documents
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // 3. DELETE from uploaded_files
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const response = await fetch(`${baseUrl}/api/praxis/documents/5`, {
      method: 'DELETE',
      headers: { 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

// ============================================
// QUEUE (Live-Warteschlange)
// ============================================
describe('Backend Dashboard API - Warteschlange (Queue)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // POST /api/queue/:terminCode/accept
  it('should return 403 for accept without praxis session', async () => {
    const response = await fetch(`${baseUrl}/api/queue/test_code/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status).toBe(403);
  });

  it('should accept a patient and set status to in_treatment', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // 1. Check appointment belongs to praxis
    mockQuery.mockResolvedValueOnce({ rows: [{ code: 'queue_appt_1' }] });
    // 2. UPSERT queue_status
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const response = await fetch(`${baseUrl}/api/queue/queue_appt_1/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify the UPSERT query contained 'in_treatment'
    const upsertCall = mockQuery.mock.calls[1];
    expect(upsertCall[0]).toContain('in_treatment');
  });

  it('should return 404 when accepting an appointment not belonging to praxis', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    mockQuery.mockResolvedValueOnce({ rows: [] }); // not found

    const response = await fetch(`${baseUrl}/api/queue/unknown_code/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('nicht gefunden');
  });

  // POST /api/queue/:terminCode/done
  it('should mark treatment as done', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // 1. Check appointment
    mockQuery.mockResolvedValueOnce({ rows: [{ code: 'queue_appt_2' }] });
    // 2. UPSERT to done
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const response = await fetch(`${baseUrl}/api/queue/queue_appt_2/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const upsertCall = mockQuery.mock.calls[1];
    expect(upsertCall[0]).toContain('done');
  });

  // POST /api/queue/:terminCode/delay
  it('should delay an appointment and store reason', async () => {
    const cookie = await loginAsPraxis();
    mockQuery.mockReset();

    // 1. Lookup termin with patient email
    mockQuery.mockResolvedValueOnce({
      rows: [{
        code: 'queue_appt_3',
        patient_vorname: 'Max',
        patient_nachname: 'Mustermann',
        patient_email: 'max@example.com',
        date: '2026-08-20',
        time: '10:00',
        praxis: 'Testpraxis München'
      }]
    });
    // 2. UPSERT delayed status
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const response = await fetch(`${baseUrl}/api/queue/queue_appt_3/delay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ delay_minutes: 15, reason: 'Notfall dazwischen gekommen' })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const upsertCall = mockQuery.mock.calls[1];
    expect(upsertCall[0]).toContain('delayed');
  });
});
