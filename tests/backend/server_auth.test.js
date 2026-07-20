import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// Define mocks before importing server.js to ensure they are hoisted
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

// Import app and start the server on a dynamic port
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

describe('Backend Auth API - /api/auth/register & /api/auth/login', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should return 400 if patient registration lacks required fields', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'pass',
        vorname: 'John',
        // Missing fields like nachname, geburtsdatum, etc.
        role: 'patient'
      })
    });

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Pflichtfelder');
  });

  it('should successfully register a patient with correct hashing and database persistence', async () => {
    // 1. Mock DB query checking if user already exists (return empty)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // 2. Mock DB query inserting user (return the new user details)
    const mockDbUser = {
      id: 1,
      email: 'john.doe@example.com',
      vorname: 'John',
      nachname: 'Doe',
      role: 'patient'
    };
    mockQuery.mockResolvedValueOnce({ rows: [mockDbUser] });

    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john.doe@example.com',
        password: 'securepassword',
        vorname: 'John',
        nachname: 'Doe',
        role: 'patient',
        geburtsdatum: '1990-01-01',
        krankenversicherung: 'gesetzlich'
      })
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('john.doe@example.com');
    expect(data.user.role).toBe('patient');

    // Verify first query was check if user exists
    expect(mockQuery.mock.calls[0][0]).toContain('SELECT id, password_hash FROM users WHERE email = $1 AND role = $2');
    expect(mockQuery.mock.calls[0][1]).toEqual(['john.doe@example.com', 'patient']);

    // Verify second query inserted the user with hashed password
    const insertQuery = mockQuery.mock.calls[1][0];
    const insertArgs = mockQuery.mock.calls[1][1];
    expect(insertQuery).toContain('INSERT INTO users');
    expect(insertArgs[0]).toBe('john.doe@example.com');
    // Password hash should not match plain password
    expect(insertArgs[1]).not.toBe('securepassword');
    expect(bcrypt.compareSync('securepassword', insertArgs[1])).toBe(true);
  });

  it('should deny login for incorrect credentials', async () => {
    // Mock user found in DB
    const hashedPassword = bcrypt.hashSync('correctpass', 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 1,
        email: 'doctor@example.com',
        password_hash: hashedPassword,
        vorname: 'Dr.',
        nachname: 'Jack',
        role: 'praxis'
      }]
    });

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'doctor@example.com',
        password: 'wrongpassword',
        role: 'praxis'
      })
    });

    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('E-Mail oder Passwort ist falsch.');
  });

  it('should authenticate user on correct credentials', async () => {
    const password = 'mypassword';
    const hashedPassword = bcrypt.hashSync(password, 10);
    const mockDbUser = {
      id: 5,
      email: 'doctor2@example.com',
      password_hash: hashedPassword,
      vorname: 'Dr.',
      nachname: 'Jack',
      role: 'praxis'
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockDbUser] });

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'doctor2@example.com',
        password: password,
        role: 'praxis'
      })
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('doctor2@example.com');
    expect(data.user.role).toBe('praxis');
  });

  // ============================================
  // Additional Registration Tests
  // ============================================

  it('should return 409 when registering a duplicate email for the same role', async () => {
    // Mock: user already exists
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 99 }] });

    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'password123',
        vorname: 'Max',
        nachname: 'Mustermann',
        role: 'patient',
        geburtsdatum: '1990-01-01',
        krankenversicherung: 'gesetzlich'
      })
    });

    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data.error).toContain('bereits registriert');
  });

  it('should return 400 when password is too short (less than 6 characters)', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'short@example.com',
        password: '12345', // Only 5 chars
        vorname: 'Max',
        nachname: 'Mustermann',
        role: 'patient',
        geburtsdatum: '1990-01-01',
        krankenversicherung: 'gesetzlich'
      })
    });

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('mindestens 6 Zeichen');
  });

  it('should successfully register a praxis user with fewer required fields', async () => {
    // Mock: no existing user
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Mock: INSERT returns new praxis user
    const mockPraxisUser = {
      id: 50,
      email: 'praxis@example.com',
      vorname: 'Dr. Anna',
      nachname: 'Hartmann',
      role: 'praxis',
      praxis_name: 'Praxis am See',
      praxis_fachbereich: 'Dermatologie'
    };
    mockQuery.mockResolvedValueOnce({ rows: [mockPraxisUser] });

    // Mock: auto-link appointments query
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'praxis@example.com',
        password: 'securePass123',
        vorname: 'Dr. Anna',
        nachname: 'Hartmann',
        role: 'praxis',
        praxis_name: 'Praxis am See',
        praxis_fachbereich: 'Dermatologie'
        // No geburtsdatum or krankenversicherung needed for praxis
      })
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.role).toBe('praxis');
    expect(data.user.praxis_name).toBe('Praxis am See');
  });

  it('should return 400 if praxis registration lacks required name fields', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'praxis@example.com',
        password: 'securePass123',
        vorname: 'Dr.',
        // nachname missing
        role: 'praxis'
      })
    });

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Pflichtfelder');
  });

  // ============================================
  // Additional Login Tests
  // ============================================

  it('should return 400 if login request has no email or password', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('E-Mail und Passwort sind erforderlich');
  });

  it('should return 401 if login email is not found in DB', async () => {
    // Mock: no user found
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'password123',
        role: 'patient'
      })
    });

    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('E-Mail oder Passwort ist falsch');
  });

  // ============================================
  // /api/auth/me
  // ============================================

  it('should return loggedIn: false for /api/auth/me without active session', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`);
    const data = await response.json();

    // Without a session cookie, the user is not logged in
    expect(response.status).toBe(200);
    expect(data.loggedIn).toBe(false);
  });
});

