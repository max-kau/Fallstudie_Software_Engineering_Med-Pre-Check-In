import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import session from 'express-session';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS and JSON parsing with limits suitable for file upload
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Session middleware for authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'doctolib-precheckin-dev-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Database connection pool setup
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

let pool = null;
let isDbConnected = false;

if (connectionString) {
  try {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });
    isDbConnected = true;
    console.log('PostgreSQL database pool initialized.');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err);
  }
} else {
  console.warn('⚠️ WARNING: DATABASE_URL environment variable is missing. Running in offline/mock mode.');
}

// Initialize database tables
async function initDb() {
  if (!isDbConnected || !pool) return;
  try {
    // 1. Create appointments table (termine)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS termine (
        code VARCHAR(50) PRIMARY KEY,
        doctor VARCHAR(100) NOT NULL,
        fachrichtung VARCHAR(100) NOT NULL,
        adresse VARCHAR(255) NOT NULL,
        date VARCHAR(100) NOT NULL,
        time VARCHAR(100) NOT NULL,
        art VARCHAR(100) NOT NULL,
        praxis VARCHAR(100) NOT NULL,
        tags TEXT[] NOT NULL,
        patient_vorname VARCHAR(100) NOT NULL,
        patient_nachname VARCHAR(100) NOT NULL
      );
    `);
    console.log('Table "termine" verified/created.');

    // 2. Drop the old table if it had session_id as PRIMARY KEY, and recreate it with termin_code as PRIMARY KEY
    const checkPk = await pool.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'precheckins'::regclass AND i.indisprimary;
    `).catch(() => ({ rows: [] }));

    if (checkPk.rows.length > 0 && checkPk.rows[0].attname === 'session_id') {
      console.log('Migrating "precheckins" table structure (dropping old table)...');
      await pool.query('DROP TABLE IF EXISTS precheckins CASCADE;');
    }

    // 3. Create pre-check-ins table with progress columns
    await pool.query(`
      CREATE TABLE IF NOT EXISTS precheckins (
        termin_code VARCHAR(50) PRIMARY KEY REFERENCES termine(code) ON DELETE CASCADE,
        session_id VARCHAR(100) NOT NULL,
        beschwerden JSONB NOT NULL,
        medikamente JSONB NOT NULL,
        allergien JSONB NOT NULL,
        current_step VARCHAR(50) DEFAULT 'intro',
        submitted BOOLEAN DEFAULT FALSE,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "precheckins" verified/created.');

    // Ensure progress columns exist in case the table was created previously without them
    await pool.query(`
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS current_step VARCHAR(50) DEFAULT 'intro';
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS submitted BOOLEAN DEFAULT FALSE;
    `);

    // 4. Add the "dokumente" column to precheckins for document metadata
    await pool.query(`
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS dokumente JSONB NOT NULL DEFAULT '{"liste":[]}'::jsonb;
    `);
    
    // 4.5. Add the "signature_data" column to precheckins for signature image string
    await pool.query(`
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS signature_data TEXT;
    `);
    console.log('Columns "current_step", "submitted", "dokumente" and "signature_data" verified.');

    // 5. Create uploaded files table for binary data storage
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id SERIAL PRIMARY KEY,
        termin_code VARCHAR(50) REFERENCES termine(code) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        file_data BYTEA NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "uploaded_files" verified/created.');

     // 6. Create users table for authentication
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        vorname VARCHAR(100) NOT NULL,
        nachname VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS geburtsdatum VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telefonnummer VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS strasse_hnr VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plz_ort VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS krankenversicherung VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS krankenkasse VARCHAR(255);
    `);
    console.log('Table "users" verified/created with profile columns.');

    // Ensure user_id column exists on termine table with foreign key reference
    await pool.query(`
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Auto-seed a demo user if none exists
    const existingUsers = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(existingUsers.rows[0].count) === 0) {
      const demoHash = await bcrypt.hash('passwort123', 10);
      await pool.query(
        'INSERT INTO users (email, password_hash, vorname, nachname) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
        ['max@doctolib.de', demoHash, 'Max', 'Mustermann']
      );
      console.log('Demo user seeded: max@doctolib.de / passwort123');
    }

  } catch (err) {
    console.error('Database initialization failed:', err);
    isDbConnected = false;
  }
}

// Mock fallback appointment for offline mode
const getMockAppointment = (code) => ({
  termin: {
    code,
    doctor: 'Dr. med. Anna Hartmann',
    fachrichtung: 'Allgemeinmedizin · Innere Medizin',
    adresse: 'Leopoldstraße 12, 80802 München',
    date: 'Mo, 25. Mai',
    time: '09:30',
    art: 'Routineuntersuchung',
    praxis: 'Hausarztpraxis',
    tags: ['Kassenpatienten', 'Privatpatienten', 'Hausbesuche']
  },
  patient: {
    vorname: 'Max',
    nachname: 'Mustermann'
  }
});

// Diagnostics endpoint
app.get('/api/health', async (req, res) => {
  const rawUrl = process.env.DATABASE_URL || '';
  const health = {
    database: isDbConnected ? 'connected' : 'offline',
    mockMode: !isDbConnected || !pool,
    envHasDatabaseUrl: !!rawUrl,
    databaseUrlType: rawUrl
      ? (rawUrl.startsWith('postgresql://') || rawUrl.startsWith('postgres://')
          ? 'starts_with_postgres_protocol'
          : rawUrl)
      : 'missing'
  };

  if (isDbConnected && pool) {
    try {
      const dbResult = await pool.query('SELECT NOW()');
      health.queryTest = 'success';
      health.dbTime = dbResult.rows[0].now;
    } catch (err) {
      health.queryTest = 'failed';
      health.queryError = err.message;
    }
  }

  res.json(health);
});

// ============================================
// AUTH API ENDPOINTS
// ============================================

// API: Register a new user
app.post('/api/auth/register', async (req, res) => {
  const { email, password, vorname, nachname } = req.body;

  if (!email || !password || !vorname || !nachname) {
    return res.status(400).json({ error: 'Alle Felder sind erforderlich.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
  }

  if (!isDbConnected || !pool) {
    return res.status(500).json({ error: 'Datenbank nicht verfügbar.' });
  }

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' });
    }

    // Hash password and insert user
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, vorname, nachname) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse`,
      [email.toLowerCase(), passwordHash, vorname, nachname]
    );

    const user = result.rows[0];

    // Auto-login after registration
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      email: user.email,
      vorname: user.vorname,
      nachname: user.nachname,
      geburtsdatum: user.geburtsdatum,
      telefonnummer: user.telefonnummer,
      strasse_hnr: user.strasse_hnr,
      plz_ort: user.plz_ort,
      krankenversicherung: user.krankenversicherung,
      krankenkasse: user.krankenkasse
    };

    console.log(`New user registered: ${user.email}`);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen.' });
  }
});

// API: Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  }

  if (!isDbConnected || !pool) {
    return res.status(500).json({ error: 'Datenbank nicht verfügbar.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse 
       FROM users 
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      email: user.email,
      vorname: user.vorname,
      nachname: user.nachname,
      geburtsdatum: user.geburtsdatum,
      telefonnummer: user.telefonnummer,
      strasse_hnr: user.strasse_hnr,
      plz_ort: user.plz_ort,
      krankenversicherung: user.krankenversicherung,
      krankenkasse: user.krankenkasse
    };

    console.log(`User logged in: ${user.email}`);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Anmeldung fehlgeschlagen.' });
  }
});

// API: Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Abmeldung fehlgeschlagen.' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// API: Get current user
app.get('/api/auth/me', async (req, res) => {
  if (req.session && req.session.userId) {
    try {
      const result = await pool.query(
        'SELECT id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse FROM users WHERE id = $1',
        [req.session.userId]
      );
      if (result.rows.length > 0) {
        const user = result.rows[0];
        req.session.user = user;
        return res.json({ loggedIn: true, user });
      }
    } catch (err) {
      console.error('Error fetching user profile in /me:', err);
    }
  }
  res.json({ loggedIn: false });
});

// API: Update user profile
app.put('/api/auth/profile', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  const { vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse } = req.body;

  if (!vorname || !nachname) {
    return res.status(400).json({ error: 'Vorname und Nachname sind erforderlich.' });
  }

  if (!isDbConnected || !pool) {
    return res.status(500).json({ error: 'Datenbank nicht verfügbar.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users 
       SET vorname = $1, nachname = $2, geburtsdatum = $3, telefonnummer = $4, strasse_hnr = $5, plz_ort = $6, krankenversicherung = $7, krankenkasse = $8 
       WHERE id = $9 
       RETURNING id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse`,
      [vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, req.session.userId]
    );

    const user = result.rows[0];
    req.session.user = user;
    console.log(`User profile updated: ${user.email}`);
    res.json({ success: true, user });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Aktualisierung des Profils fehlgeschlagen.' });
  }
});

// API: Book a new appointment
app.post('/api/termine/buchen', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  const { doctor, fachrichtung, adresse, date, time, art, praxis, tags } = req.body;

  if (!doctor || !fachrichtung || !adresse || !date || !time || !art || !praxis) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder.' });
  }

  if (!isDbConnected || !pool) {
    const code = 't_MOCK' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const mockAppt = {
      code,
      doctor,
      fachrichtung,
      adresse,
      date,
      time,
      art,
      praxis,
      tags: tags || [],
      patient_vorname: req.session.user?.vorname || 'Max',
      patient_nachname: req.session.user?.nachname || 'Mustermann',
      user_id: req.session.userId
    };
    
    if (!req.session.mockAppointments) {
      req.session.mockAppointments = [];
    }
    req.session.mockAppointments.push(mockAppt);
    
    console.log('[Offline Mode] Mocked appointment booking saved to session:', mockAppt);
    return res.json({ success: true, appointment: mockAppt });
  }

  try {
    // Get user details for patient name
    const userResult = await pool.query('SELECT vorname, nachname FROM users WHERE id = $1', [req.session.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }
    const user = userResult.rows[0];

    const code = 't_' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const query = `
      INSERT INTO termine (code, doctor, fachrichtung, adresse, date, time, art, praxis, tags, patient_vorname, patient_nachname, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      code,
      doctor,
      fachrichtung,
      adresse,
      date,
      time,
      art,
      praxis,
      tags || [],
      user.vorname,
      user.nachname,
      req.session.userId
    ];

    const result = await pool.query(query, values);
    res.json({ success: true, appointment: result.rows[0] });
  } catch (err) {
    console.error('Error booking appointment:', err);
    res.status(500).json({ error: 'Terminbuchung fehlgeschlagen.' });
  }
});

// API: Get user's appointments
app.get('/api/user/termine', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  if (!isDbConnected || !pool) {
    // Return mock appointments from session or seed a default one if empty
    if (!req.session.mockAppointments) {
      req.session.mockAppointments = [
        {
          code: 'demo_12345',
          doctor: 'Dr. med. Anna Hartmann',
          fachrichtung: 'Allgemeinmedizin · Innere Medizin',
          adresse: 'Leopoldstraße 12, 80802 München',
          date: 'Mo, 25. Mai',
          time: '09:30',
          art: 'Routineuntersuchung',
          praxis: 'Hausarztpraxis',
          tags: ['Kassenpatienten', 'Privatpatienten', 'Hausbesuche'],
          patient_vorname: req.session.user?.vorname || 'Max',
          patient_nachname: req.session.user?.nachname || 'Mustermann',
          user_id: req.session.userId,
          precheck_submitted: false,
          precheck_step: 'intro'
        }
      ];
    }
    return res.json({ success: true, appointments: req.session.mockAppointments });
  }

  try {
    const result = await pool.query(
      `SELECT t.*, p.submitted as precheck_submitted, p.current_step as precheck_step
       FROM termine t
       LEFT JOIN precheckins p ON t.code = p.termin_code
       WHERE t.user_id = $1
       ORDER BY t.date DESC, t.time DESC`,
      [req.session.userId]
    );
    res.json({ success: true, appointments: result.rows });
  } catch (err) {
    console.error('Error fetching user appointments:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Termine.' });
  }
});

// API: Get appointment info (or auto-seed if it doesn't exist)
app.get('/api/termin/:code', async (req, res) => {
  const { code } = req.params;

  if (!isDbConnected || !pool) {
    console.log(`[Offline Mode] Returning mock appointment details for code: ${code}`);
    return res.json(getMockAppointment(code));
  }

  try {
    const result = await pool.query('SELECT * FROM termine WHERE code = $1', [code]);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return res.json({
        termin: {
          code: row.code,
          doctor: row.doctor,
          fachrichtung: row.fachrichtung,
          adresse: row.adresse,
          date: row.date,
          time: row.time,
          art: row.art,
          praxis: row.praxis,
          tags: row.tags
        },
        patient: {
          vorname: row.patient_vorname,
          nachname: row.patient_nachname
        }
      });
    }

    // Auto-seed a demo appointment if not found, to keep demo links dynamic
    const defaultAppointment = {
      code,
      doctor: 'Dr. med. Anna Hartmann',
      fachrichtung: 'Allgemeinmedizin · Innere Medizin',
      adresse: 'Leopoldstraße 12, 80802 München',
      date: 'Mo, 25. Mai',
      time: '09:30',
      art: 'Routineuntersuchung',
      praxis: 'Hausarztpraxis',
      tags: ['Kassenpatienten', 'Privatpatienten', 'Hausbesuche'],
      patient_vorname: 'Max',
      patient_nachname: 'Mustermann'
    };

    await pool.query(
      `INSERT INTO termine (code, doctor, fachrichtung, adresse, date, time, art, praxis, tags, patient_vorname, patient_nachname)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        defaultAppointment.code,
        defaultAppointment.doctor,
        defaultAppointment.fachrichtung,
        defaultAppointment.adresse,
        defaultAppointment.date,
        defaultAppointment.time,
        defaultAppointment.art,
        defaultAppointment.praxis,
        defaultAppointment.tags,
        defaultAppointment.patient_vorname,
        defaultAppointment.patient_nachname
      ]
    );

    console.log(`Auto-seeded demo appointment for code: ${code}`);

    res.json({
      termin: {
        code: defaultAppointment.code,
        doctor: defaultAppointment.doctor,
        fachrichtung: defaultAppointment.fachrichtung,
        adresse: defaultAppointment.adresse,
        date: defaultAppointment.date,
        time: defaultAppointment.time,
        art: defaultAppointment.art,
        praxis: defaultAppointment.praxis,
        tags: defaultAppointment.tags
      },
      patient: {
        vorname: defaultAppointment.patient_vorname,
        nachname: defaultAppointment.patient_nachname
      }
    });

  } catch (err) {
    console.error('Error fetching appointment:', err);
    res.status(500).json({ error: 'Database fetch error' });
  }
});

// API: Get existing pre-check-in info by appointment code
app.get('/api/precheckin/:terminCode', async (req, res) => {
  const { terminCode } = req.params;

  if (!isDbConnected || !pool) {
    return res.json({ exists: false });
  }

  try {
    const result = await pool.query(
      'SELECT session_id, termin_code, beschwerden, medikamente, allergien, dokumente, signature_data, current_step, submitted FROM precheckins WHERE termin_code = $1',
      [terminCode]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return res.json({
        exists: true,
        sessionId: row.session_id,
        terminCode: row.termin_code,
        beschwerden: row.beschwerden,
        medikamente: row.medikamente,
        allergien: row.allergien,
        dokumente: row.dokumente || { liste: [] },
        signatureData: row.signature_data,
        currentStep: row.current_step,
        submitted: row.submitted
      });
    }

    res.json({ exists: false });
  } catch (err) {
    console.error('Error fetching pre-check-in:', err);
    res.status(500).json({ error: 'Database fetch error' });
  }
});

// API: Submit or autosave pre-check-in data
app.post('/api/precheckin', async (req, res) => {
  const { sessionId, terminCode, beschwerden, medikamente, allergien, dokumente, signatureData, currentStep, submitted } = req.body;

  if (!sessionId || !terminCode) {
    return res.status(400).json({ error: 'Missing required fields: sessionId and terminCode' });
  }

  if (!isDbConnected || !pool) {
    console.log(`[Offline Mode] Received mock pre-check-in save for session: ${sessionId}`);
    return res.json({ success: true, offline: true });
  }

  try {
    // Save to database, upsert if the appointment already exists
    await pool.query(
      `INSERT INTO precheckins (termin_code, session_id, beschwerden, medikamente, allergien, dokumente, signature_data, current_step, submitted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (termin_code)
       DO UPDATE SET
         session_id = EXCLUDED.session_id,
         beschwerden = EXCLUDED.beschwerden,
         medikamente = EXCLUDED.medikamente,
         allergien = EXCLUDED.allergien,
         dokumente = EXCLUDED.dokumente,
         signature_data = EXCLUDED.signature_data,
         current_step = EXCLUDED.current_step,
         submitted = EXCLUDED.submitted,
         submitted_at = CURRENT_TIMESTAMP`,
      [
        terminCode,
        sessionId,
        JSON.stringify(beschwerden),
        JSON.stringify(medikamente),
        JSON.stringify(allergien),
        JSON.stringify(dokumente || { liste: [] }),
        signatureData || null,
        currentStep || 'intro',
        submitted || false
      ]
    );

    console.log(`Pre-check-in saved/updated for appointment: ${terminCode}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving pre-check-in:', err);
    res.status(500).json({ error: 'Database save error' });
  }
});

// API: Upload a document/image (stores binary data via Base64 payload)
app.post('/api/upload', async (req, res) => {
  const { terminCode, filename, mimeType, fileData } = req.body;

  if (!terminCode || !filename || !mimeType || !fileData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const buffer = Buffer.from(fileData, 'base64');
  const fileSize = buffer.length;

  if (!isDbConnected || !pool) {
    // Offline mode: generate a mock ID
    const mockId = Math.floor(Math.random() * 100000);
    console.log(`[Offline Mode] Mock uploaded file: ${filename} (${fileSize} bytes)`);
    return res.json({
      success: true,
      file: {
        id: mockId,
        filename,
        mimeType,
        fileSize
      }
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO uploaded_files (termin_code, filename, mime_type, file_size, file_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, mime_type, file_size`,
      [terminCode, filename, mimeType, fileSize, buffer]
    );

    const row = result.rows[0];
    res.json({
      success: true,
      file: {
        id: row.id,
        filename: row.filename,
        mimeType: row.mime_type,
        fileSize: row.file_size
      }
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ error: 'Database upload error' });
  }
});

// API: Download/view a file by ID
app.get('/api/file/:id', async (req, res) => {
  const { id } = req.params;
  const fileId = parseInt(id, 10);

  if (isNaN(fileId)) {
    return res.status(400).json({ error: 'Invalid file ID format' });
  }

  if (!isDbConnected || !pool) {
    return res.status(500).json({ error: 'Database offline in mock mode' });
  }

  try {
    const result = await pool.query(
      'SELECT filename, mime_type, file_data FROM uploaded_files WHERE id = $1',
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { filename, mime_type, file_data } = result.rows[0];

    // Ensure binary content is a Buffer (defensively handles DB returning hex-encoded string instead of Buffer)
    let buffer = file_data;
    if (typeof file_data === 'string') {
      if (file_data.startsWith('\\x') || file_data.startsWith('\\\\x')) {
        const hexStr = file_data.startsWith('\\\\x') ? file_data.slice(3) : file_data.slice(2);
        buffer = Buffer.from(hexStr, 'hex');
      } else {
        buffer = Buffer.from(file_data, 'utf-8');
      }
    }

    res.setHeader('Content-Type', mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('Error fetching file:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Delete a file by ID
app.delete('/api/file/:id', async (req, res) => {
  const { id } = req.params;
  const fileId = parseInt(id, 10);

  if (isNaN(fileId)) {
    return res.status(400).json({ error: 'Invalid file ID format' });
  }

  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }

  try {
    await pool.query('DELETE FROM uploaded_files WHERE id = $1', [fileId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Database delete error' });
  }
});

// Serve frontend build static files in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'dist')));

// SPA route fallback (returns index.html)
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start the server
async function startServer() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
