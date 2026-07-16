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

describe('Backend Precheckin API - /api/precheckin', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should return exists: false if precheckin does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const response = await fetch(`${baseUrl}/api/precheckin/non_existent_code`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.exists).toBe(false);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toEqual(['non_existent_code']);
  });

  it('should return precheckin details if it exists', async () => {
    const mockDbRow = {
      session_id: 'sess_123',
      termin_code: 'termin_789',
      beschwerden: { freitext: 'Fieber' },
      medikamente: { liste: [] },
      allergien: { liste: [] },
      dokumente: { liste: [] },
      signature_data: 'data:image/png;base64,...',
      current_step: 'beschwerden',
      submitted: false,
      custom_answers: {},
      document_confirmations: {},
      started_at: '2026-07-16T20:00:00Z',
      ai_questions: [],
      ai_consent: true
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockDbRow] });

    const response = await fetch(`${baseUrl}/api/precheckin/termin_789`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.exists).toBe(true);
    expect(data.sessionId).toBe('sess_123');
    expect(data.currentStep).toBe('beschwerden');
    expect(data.aiConsent).toBe(true);
  });

  it('should return 400 on save when missing sessionId or terminCode', async () => {
    const response = await fetch(`${baseUrl}/api/precheckin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beschwerden: {}
      })
    });

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should upsert pre-checkin data in DB and perform query successfully', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // Mock INSERT/UPDATE response

    const payload = {
      sessionId: 'sess_123',
      terminCode: 'termin_789',
      beschwerden: { freitext: 'Schmerzen' },
      medikamente: { liste: ['Aspirin'] },
      allergien: { liste: [] },
      dokumente: { liste: [] },
      signatureData: null,
      currentStep: 'medikamente',
      submitted: false,
      customAnswers: {},
      documentConfirmations: {},
      aiQuestions: [],
      aiConsent: null
    };

    const response = await fetch(`${baseUrl}/api/precheckin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify SQL query arguments
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sqlArgs = mockQuery.mock.calls[0][1];
    expect(sqlArgs[0]).toBe('termin_789'); // terminCode
    expect(sqlArgs[1]).toBe('sess_123'); // sessionId
    expect(sqlArgs[2]).toBe(JSON.stringify(payload.beschwerden)); // beschwerden JSON
    expect(sqlArgs[3]).toBe(JSON.stringify(payload.medikamente)); // medikamente JSON
  });

  // ============================================
  // Submission Workflow (submitted=true)
  // ============================================

  it('should handle submission (submitted=true) and trigger notification queries', async () => {
    // 1. Mock the main INSERT/UPSERT query
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    // 2. Mock the appointment lookup for email notification
    mockQuery.mockResolvedValueOnce({
      rows: [{
        code: 'termin_submit',
        doctor: 'Dr. Test',
        praxis: 'Testpraxis',
        date: '2026-08-01',
        time: '10:00',
        patient_vorname: 'Max',
        patient_nachname: 'Mustermann',
        notify_email: 'patient@example.com'
      }]
    });

    // 3. Mock praxis email lookup
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // 4. Mock the patient user email lookup (for confirmation email)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const payload = {
      sessionId: 'sess_submit',
      terminCode: 'termin_submit',
      beschwerden: { freitext: 'Fieber' },
      medikamente: { liste: [] },
      allergien: { liste: [] },
      dokumente: { liste: [] },
      signatureData: 'data:image/png;base64,...',
      currentStep: 'zusammenfassung',
      submitted: true,
      customAnswers: {},
      documentConfirmations: {},
      aiQuestions: [],
      aiConsent: true
    };

    const response = await fetch(`${baseUrl}/api/precheckin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify the main upsert query was called
    expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO precheckins');
    // Verify submitted=true was passed
    const upsertArgs = mockQuery.mock.calls[0][1];
    expect(upsertArgs[8]).toBe(true); // submitted flag
  });

  // ============================================
  // DB Error Handling
  // ============================================

  it('should return 500 when database throws an error on GET', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    const response = await fetch(`${baseUrl}/api/precheckin/error_code`);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Database fetch error');
  });
});

