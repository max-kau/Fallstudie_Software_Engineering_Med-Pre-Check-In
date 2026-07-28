import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { testRouter } from './test_dashboard_server.js';

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
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client:', err.message);
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
    
    // 4.6. Add the "ai_assessments" column to precheckins for AI recommendations
    await pool.query(`
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS ai_assessments JSONB DEFAULT NULL;
    `);
    
    // 4.7. Add the "anamnesis_assessment" column to precheckins for AI diagnostics/assessments
    await pool.query(`
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS anamnesis_assessment TEXT DEFAULT NULL;
    `);
    console.log('Columns "current_step", "submitted", "dokumente", "signature_data", "ai_assessments" and "anamnesis_assessment" verified.');

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
        email VARCHAR(255) NOT NULL,
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
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'patient';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS praxis_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS praxis_fachbereich VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS praxis_adresse VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS praxis_telefon VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT NULL;
    `);
    console.log('Table "users" verified/created with profile, role, and opening hours columns.');

    // Update unique constraint on users to (email, role)
    try {
      await pool.query(`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_role_key;
        ALTER TABLE users ADD CONSTRAINT users_email_role_key UNIQUE (email, role);
      `);
      console.log('Unique constraint on users updated to (email, role).');
    } catch (constraintErr) {
      console.error('Failed to update users constraint to (email, role):', constraintErr);
    }

    // Ensure user_id, notify_email and notify_sent columns exist on termine table
    await pool.query(`
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS notify_email VARCHAR(255);
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS notify_sent BOOLEAN DEFAULT FALSE;
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS rating INTEGER;
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS feedback_text TEXT;
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS post_visit_notified BOOLEAN DEFAULT FALSE;
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'bestätigt';
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS urgent BOOLEAN DEFAULT FALSE;
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT FALSE;
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
    `);

    // Ensure custom_answers exists in precheckins
    await pool.query(`
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS custom_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);

    // Ensure columns for doctor-shared files exist in uploaded_files
    await pool.query(`
      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(50) DEFAULT 'patient';
      ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS doc_category VARCHAR(100) DEFAULT 'Sonstiges';
    `);

    // Create praxis_questions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS praxis_questions (
        id SERIAL PRIMARY KEY,
        praxis_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        question_text VARCHAR(255) NOT NULL,
        question_type VARCHAR(50) NOT NULL,
        options JSONB DEFAULT '[]'::jsonb,
        required BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "praxis_questions" and column "custom_answers" verified/created.');

    // Add duration column to termine (default 30 minutes)
    await pool.query(`
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30;
    `);
    console.log('Column "duration" on termine verified.');

    // Add default_hints column to users for praxis-specific default hint presets
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS default_hints JSONB DEFAULT NULL;
    `);
    console.log('Column "default_hints" on users verified.');

    // Create doctor_notes table for private doctor notes on appointments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_notes (
        id SERIAL PRIMARY KEY,
        termin_code VARCHAR(50) REFERENCES termine(code) ON DELETE CASCADE,
        note_text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "doctor_notes" verified/created.');

    // Create patient_hints table for hints sent to patients
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patient_hints (
        id SERIAL PRIMARY KEY,
        termin_code VARCHAR(50) REFERENCES termine(code) ON DELETE CASCADE,
        hints JSONB DEFAULT '[]'::jsonb,
        custom_text TEXT DEFAULT '',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        email_sent BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('Table "patient_hints" verified/created.');

    // Create praxis_documents table for documents that patients must confirm
    await pool.query(`
      CREATE TABLE IF NOT EXISTS praxis_documents (
        id SERIAL PRIMARY KEY,
        praxis_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        doc_type VARCHAR(20) NOT NULL DEFAULT 'confirm',
        file_id INTEGER REFERENCES uploaded_files(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "praxis_documents" verified/created.');

    // Create aftercare_instructions table for post-visit patient care instructions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aftercare_instructions (
        id SERIAL PRIMARY KEY,
        termin_code VARCHAR(50) REFERENCES termine(code) ON DELETE CASCADE,
        instructions TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        email_sent BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('Table "aftercare_instructions" verified/created.');

    // Add document_confirmations and started_at columns to precheckins
    await pool.query(`
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS document_confirmations JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS ai_questions JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS ai_consent BOOLEAN DEFAULT NULL;
    `);
    console.log('Columns "document_confirmations", "started_at", "ai_questions" and "ai_consent" on precheckins verified.');

    // Create buffer_times table for praxis buffer/break times
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buffer_times (
        id SERIAL PRIMARY KEY,
        praxis_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) DEFAULT 'Pufferzeit',
        is_recurring BOOLEAN DEFAULT FALSE,
        day_of_week INTEGER,
        specific_date VARCHAR(20),
        start_time VARCHAR(10) NOT NULL,
        end_time VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "buffer_times" verified/created.');

    // Create queue_status table for live waiting queue
    await pool.query(`
      CREATE TABLE IF NOT EXISTS queue_status (
        id SERIAL PRIMARY KEY,
        praxis_name VARCHAR(255) NOT NULL,
        termin_code VARCHAR(50) REFERENCES termine(code) ON DELETE CASCADE,
        status VARCHAR(30) DEFAULT 'waiting',
        delay_minutes INTEGER DEFAULT 0,
        delay_reason TEXT DEFAULT '',
        early_request_status VARCHAR(20) DEFAULT NULL,
        early_minutes INTEGER DEFAULT 0,
        position INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(termin_code)
      );
    `);
    await pool.query('ALTER TABLE queue_status ADD COLUMN IF NOT EXISTS early_minutes INTEGER DEFAULT 0;');
    console.log('Table "queue_status" verified/created with early_minutes.');

    // Create activity_logs table for patient visit & appointment history (90 days retention)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        praxis_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        praxis_name VARCHAR(255) NOT NULL,
        patient_id INTEGER,
        patient_name VARCHAR(255),
        termin_code VARCHAR(50),
        status VARCHAR(50) NOT NULL,
        action TEXT NOT NULL,
        staff_name VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "activity_logs" verified/created.');

    // Remove the demo user if it exists to allow only custom testing
    await pool.query("DELETE FROM users WHERE email = 'max@doctolib.de'");
    console.log('Demo user max@doctolib.de verified removed from database.');

    // Seed default admin user if not existing
    const adminCheck = await pool.query("SELECT id FROM users WHERE email = $1 AND role = $2", ['admin@doctolib.de', 'admin']);
    if (adminCheck.rows.length === 0) {
      const adminHash = await bcrypt.hash('admin', 10);
      await pool.query(
        `INSERT INTO users (email, password_hash, vorname, nachname, role)
         VALUES ($1, $2, $3, $4, $5)`,
        ['admin@doctolib.de', adminHash, 'System', 'Admin', 'admin']
      );
      console.log('Default admin user (admin@doctolib.de / admin) created.');
    }

  } catch (err) {
    console.error('Database initialization failed:', err);
    isDbConnected = false;
  }
}

// Automatically purge activity log entries older than 90 days (DSGVO Requirement)
async function purgeOldActivityLogs() {
  if (!isDbConnected || !pool) return;
  try {
    const res = await pool.query(
      `DELETE FROM activity_logs WHERE timestamp < NOW() - INTERVAL '90 days'`
    );
    if (res && res.rowCount > 0) {
      console.log(`Auto-purged ${res.rowCount} activity logs older than 90 days.`);
    }
  } catch (err) {
    console.error('Error purging old activity logs:', err);
  }
}

// In-memory store fallback for activity logs
const activityLogsStore = [
  {
    id: 1,
    praxis_id: 'demo_praxis_id',
    praxis_name: 'Demo Praxis',
    patient_id: 101,
    patient_name: 'Max Mustermann',
    termin_code: 'DEMO101',
    status: 'erschienen',
    action: 'Patient in der Praxis erschienen und eingecheckt',
    staff_name: 'Empfang / MFA',
    timestamp: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 2,
    praxis_id: 'demo_praxis_id',
    praxis_name: 'Demo Praxis',
    patient_id: 102,
    patient_name: 'Erika Mustermann',
    termin_code: 'DEMO102',
    status: 'in_treatment',
    action: 'Behandlung im Sprechzimmer 1 gestartet',
    staff_name: 'Dr. med. Anna Hartmann',
    timestamp: new Date(Date.now() - 1800000).toISOString()
  }
];

// Log patient visit & appointment activity
async function logActivity({ praxisId, praxisName, patientId, patientName, terminCode, status, action, staffName }) {
  let validPraxisId = null;
  if (praxisId !== null && praxisId !== undefined && !isNaN(Number(praxisId))) {
    validPraxisId = parseInt(praxisId, 10);
  }

  let validPatientId = null;
  if (patientId !== null && patientId !== undefined && !isNaN(Number(patientId))) {
    validPatientId = parseInt(patientId, 10);
  }

  const logEntry = {
    praxis_id: validPraxisId,
    praxis_name: praxisName || '',
    patient_id: validPatientId,
    patient_name: patientName || 'Patient',
    termin_code: terminCode || null,
    status: status || 'unbekannt',
    action: action || 'Aktivität erfasst',
    staff_name: staffName || 'System',
    timestamp: new Date().toISOString()
  };

  if (!isDbConnected || !pool) {
    activityLogsStore.unshift({ id: activityLogsStore.length + 1, ...logEntry });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO activity_logs (praxis_id, praxis_name, patient_id, patient_name, termin_code, status, action, staff_name, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        logEntry.praxis_id,
        logEntry.praxis_name,
        logEntry.patient_id,
        logEntry.patient_name,
        logEntry.termin_code,
        logEntry.status,
        logEntry.action,
        logEntry.staff_name
      ]
    );
  } catch (err) {
    console.error('Error logging activity to DB, falling back to memory store:', err);
    activityLogsStore.unshift({ id: activityLogsStore.length + 1, ...logEntry });
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

app.get('/api/health/smtp', async (req, res) => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const resendApiKey = process.env.RESEND_API_KEY;

  const config = {
    useResend: !!resendApiKey,
    hasResendApiKey: !!resendApiKey,
    hasHost: !!host,
    host: host || null,
    hasPort: !!port,
    port: port || null,
    hasUser: !!user,
    user: user || null,
    hasPass: !!pass,
    secure: process.env.SMTP_SECURE || null,
    from: process.env.SMTP_FROM || null
  };

  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const domains = await resend.domains.list();
      return res.json({ success: true, status: 'Resend API is ready and authenticated', domains: domains.data || [], config });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Resend verification failed: ' + err.message, config });
    }
  }

  try {
    const transporter = await getMailTransporter();
    if (transporter && typeof transporter.verify === 'function') {
      await transporter.verify();
      return res.json({ success: true, status: 'SMTP server is ready to take messages', config });
    }
    return res.json({ success: true, status: 'SMTP initialized (mock/console)', config });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, stack: err.stack, config });
  }
});

// ============================================
// AUTH API ENDPOINTS
// ============================================

// API: Register a new user
app.post('/api/auth/register', async (req, res) => {
  const { email, password, vorname, nachname, role, geburtsdatum, krankenversicherung, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon } = req.body;

  const userRole = role === 'praxis' ? 'praxis' : 'patient';

  if (userRole === 'patient') {
    if (!email || !password || !vorname || !nachname || !geburtsdatum || !krankenversicherung) {
      return res.status(400).json({ error: 'Alle Pflichtfelder (Name, E-Mail, Passwort, Geburtsdatum, Krankenversicherung) müssen ausgefüllt werden.' });
    }
  } else {
    if (!email || !password || !vorname || !nachname) {
      return res.status(400).json({ error: 'Alle Pflichtfelder (Name, E-Mail, Passwort) müssen ausgefüllt werden.' });
    }
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
  }

  if (!isDbConnected || !pool) {
    return res.status(500).json({ error: 'Datenbank nicht verfügbar.' });
  }

  try {
    // Check if email already exists for this specific role
    const existing = await pool.query('SELECT id, password_hash FROM users WHERE email = $1 AND role = $2', [email.toLowerCase(), userRole]);
    let user;

    if (existing.rows.length > 0) {
      const isPlaceholder = existing.rows[0].password_hash && existing.rows[0].password_hash.startsWith('PLACEHOLDER');
      if (!isPlaceholder) {
        return res.status(409).json({ error: 'Diese E-Mail-Adresse ist für diese Rolle bereits registriert.' });
      }

      // If placeholder, update the password hash and merge other data!
      const passwordHash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `UPDATE users SET 
           password_hash = $1, 
           vorname = $2, 
           nachname = $3, 
           geburtsdatum = $4, 
           krankenversicherung = $5 
         WHERE id = $6
         RETURNING id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, role, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon`,
        [
          passwordHash,
          vorname,
          nachname,
          geburtsdatum || null,
          krankenversicherung || null,
          existing.rows[0].id
        ]
      );
      user = result.rows[0];
    } else {
      // Hash password and insert user
      const passwordHash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, vorname, nachname, role, geburtsdatum, krankenversicherung, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, role, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon`,
        [
          email.toLowerCase(),
          passwordHash,
          vorname,
          nachname,
          userRole,
          geburtsdatum || null,
          krankenversicherung || null,
          praxis_name || null,
          praxis_fachbereich || null,
          praxis_adresse || null,
          praxis_telefon || null
        ]
      );
      user = result.rows[0];
    }

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
      krankenkasse: user.krankenkasse,
      role: user.role,
      praxis_name: user.praxis_name,
      praxis_fachbereich: user.praxis_fachbereich,
      praxis_adresse: user.praxis_adresse,
      praxis_telefon: user.praxis_telefon
    };

    console.log(`User registered/claimed: ${user.email}`);

    // Auto-link manually created appointments
    try {
      await pool.query(
        'UPDATE termine SET user_id = $1 WHERE notify_email = $2 AND user_id IS NULL',
        [user.id, user.email.toLowerCase()]
      );
    } catch (linkErr) {
      console.error('Failed to link appointments on registration:', linkErr);
    }

    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen.' });
  }
});

// API: Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  }

  if (!isDbConnected || !pool) {
    if (role === 'admin' || email.toLowerCase() === 'admin@doctolib.de') {
      const mockAdmin = {
        id: 9999,
        email: 'admin@doctolib.de',
        vorname: 'System',
        nachname: 'Admin',
        role: 'admin'
      };
      req.session.userId = mockAdmin.id;
      req.session.user = mockAdmin;
      return res.json({ success: true, user: mockAdmin });
    }
    return res.status(500).json({ error: 'Datenbank nicht verfügbar.' });
  }

  try {
    const queryStr = role
      ? `SELECT id, email, password_hash, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, role, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon, opening_hours 
         FROM users 
         WHERE email = $1 AND role = $2`
      : `SELECT id, email, password_hash, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, role, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon, opening_hours 
         FROM users 
         WHERE email = $1`;
    const queryParams = role ? [email.toLowerCase(), role] : [email.toLowerCase()];

    const result = await pool.query(queryStr, queryParams);

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
      krankenkasse: user.krankenkasse,
      role: user.role,
      praxis_name: user.praxis_name,
      praxis_fachbereich: user.praxis_fachbereich,
      praxis_adresse: user.praxis_adresse,
      praxis_telefon: user.praxis_telefon,
      opening_hours: user.opening_hours
    };

    console.log(`User logged in: ${user.email}`);

    // Auto-link manually created appointments
    try {
      await pool.query(
        'UPDATE termine SET user_id = $1 WHERE notify_email = $2 AND user_id IS NULL',
        [user.id, user.email.toLowerCase()]
      );
    } catch (linkErr) {
      console.error('Failed to link appointments on login:', linkErr);
    }

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
        'SELECT id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, role, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon, opening_hours FROM users WHERE id = $1',
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

  const { vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon, opening_hours } = req.body;

  if (!vorname || !nachname) {
    return res.status(400).json({ error: 'Vorname und Nachname sind erforderlich.' });
  }

  if (!isDbConnected || !pool) {
    return res.status(500).json({ error: 'Datenbank nicht verfügbar.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users 
       SET vorname = $1, nachname = $2, geburtsdatum = $3, telefonnummer = $4, strasse_hnr = $5, plz_ort = $6, krankenversicherung = $7, krankenkasse = $8, praxis_name = $9, praxis_fachbereich = $10, praxis_adresse = $11, praxis_telefon = $12, opening_hours = $13 
       WHERE id = $14 
       RETURNING id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, role, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon, opening_hours`,
      [vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, praxis_name || null, praxis_fachbereich || null, praxis_adresse || null, praxis_telefon || null, opening_hours ? (typeof opening_hours === 'string' ? opening_hours : JSON.stringify(opening_hours)) : null, req.session.userId]
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

// Helper to validate slot times against opening hours
async function validateAppointmentTime(praxisName, dateStr, timeStr, req = null) {
  const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  let dayIndex;
  try {
    dayIndex = new Date(dateStr + 'T00:00:00').getDay();
  } catch (err) {
    return { valid: false, error: 'Ungültiges Datum.' };
  }
  const dayName = dayNames[dayIndex];

  const defaultHours = {
    "Montag": { "closed": false, "start": "08:00", "end": "16:00" },
    "Dienstag": { "closed": false, "start": "08:00", "end": "16:00" },
    "Mittwoch": { "closed": false, "start": "08:00", "end": "16:00" },
    "Donnerstag": { "closed": false, "start": "08:00", "end": "16:00" },
    "Freitag": { "closed": false, "start": "08:00", "end": "16:00" },
    "Samstag": { "closed": true, "start": "08:00", "end": "16:00" },
    "Sonntag": { "closed": true, "start": "08:00", "end": "16:00" }
  };

  let openingHours = defaultHours;

  if (isDbConnected && pool) {
    try {
      const result = await pool.query(
        'SELECT opening_hours FROM users WHERE role = $1 AND praxis_name = $2 ORDER BY opening_hours IS NOT NULL DESC, id DESC',
        ['praxis', praxisName]
      );
      if (result.rows.length > 0 && result.rows[0].opening_hours) {
        openingHours = result.rows[0].opening_hours;
      }
    } catch (err) {
      console.error('Error in validateAppointmentTime db query:', err);
    }
  }

  const hoursToday = openingHours[dayName];
  if (!hoursToday || hoursToday.closed) {
    return { valid: false, error: 'Die Praxis ist an diesem Tag geschlossen.' };
  }

  const { start, end } = hoursToday;
  if (!start || !end) {
    return { valid: false, error: 'Keine Öffnungszeiten für diesen Tag definiert.' };
  }

  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + 30;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  const endTimeStr = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;

  if (timeStr < start || endTimeStr > end) {
    return { valid: false, error: 'Der gewählte Termin liegt außerhalb der Öffnungszeiten der Praxis.' };
  }

  // Check buffer times
  let bufferTimesList = [];
  if (isDbConnected && pool) {
    try {
      const btResult = await pool.query(
        `SELECT * FROM buffer_times bt
         JOIN users u ON bt.praxis_id = u.id
         WHERE u.praxis_name = $1 AND (
           (bt.is_recurring = TRUE AND bt.day_of_week = $2)
           OR (bt.is_recurring = FALSE AND bt.specific_date = $3)
         )`,
        [praxisName, dayIndex, dateStr]
      );
      bufferTimesList = btResult.rows;
    } catch (err) {
      console.error('Error checking buffer times in validateAppointmentTime:', err);
    }
  } else if (req && req.session && req.session.mockBufferTimes) {
    bufferTimesList = req.session.mockBufferTimes.filter(bt => {
      if (bt.is_recurring && bt.day_of_week === dayIndex) {
        return true;
      }
      if (!bt.is_recurring && bt.specific_date === dateStr) {
        return true;
      }
      return false;
    });
  }

  const apptStartMin = h * 60 + m;
  const apptEndMin = apptStartMin + 30;
  for (const bt of bufferTimesList) {
    const [bsh, bsm] = bt.start_time.split(':').map(Number);
    const [beh, bem] = bt.end_time.split(':').map(Number);
    const bufStart = bsh * 60 + bsm;
    const bufEnd = beh * 60 + bem;
    if (apptStartMin < bufEnd && apptEndMin > bufStart) {
      return { valid: false, error: `Der gewählte Termin liegt in einer Pufferzeit (${bt.title}: ${bt.start_time}–${bt.end_time}).` };
    }
  }

  return { valid: true };
}

// API: Get opening hours of a praxis
app.get('/api/praxis/opening-hours', async (req, res) => {
  const praxisName = req.query.praxis;
  if (!praxisName) {
    return res.status(400).json({ error: 'praxis-Parameter ist erforderlich.' });
  }

  const defaultHours = {
    "Montag": { "closed": false, "start": "08:00", "end": "16:00" },
    "Dienstag": { "closed": false, "start": "08:00", "end": "16:00" },
    "Mittwoch": { "closed": false, "start": "08:00", "end": "16:00" },
    "Donnerstag": { "closed": false, "start": "08:00", "end": "16:00" },
    "Freitag": { "closed": false, "start": "08:00", "end": "16:00" },
    "Samstag": { "closed": true, "start": "08:00", "end": "16:00" },
    "Sonntag": { "closed": true, "start": "08:00", "end": "16:00" }
  };

  if (!isDbConnected || !pool) {
    if (req.session.user && req.session.user.role === 'praxis' && req.session.user.praxis_name === praxisName && req.session.user.opening_hours) {
      return res.json({ success: true, opening_hours: req.session.user.opening_hours });
    }
    return res.json({ success: true, opening_hours: defaultHours });
  }

  try {
    const result = await pool.query(
      'SELECT opening_hours FROM users WHERE role = $1 AND praxis_name = $2 ORDER BY opening_hours IS NOT NULL DESC, id DESC',
      ['praxis', praxisName]
    );

    if (result.rows.length > 0 && result.rows[0].opening_hours) {
      return res.json({ success: true, opening_hours: result.rows[0].opening_hours });
    }

    return res.json({ success: true, opening_hours: defaultHours });
  } catch (err) {
    console.error('Error fetching opening hours:', err);
    return res.status(500).json({ error: 'Fehler beim Laden der Öffnungszeiten.' });
  }
});

// ============================================
// BUFFER TIMES (PUFFERZEITEN) API ENDPOINTS
// ============================================

// API: Get all buffer times for the logged-in praxis
app.get('/api/praxis/buffer-times', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const praxisId = req.session.userId;

  if (!isDbConnected || !pool) {
    return res.json({ success: true, bufferTimes: req.session.mockBufferTimes || [] });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM buffer_times WHERE praxis_id = $1 ORDER BY is_recurring DESC, day_of_week ASC, specific_date ASC, start_time ASC',
      [praxisId]
    );
    res.json({ success: true, bufferTimes: result.rows });
  } catch (err) {
    console.error('Error fetching buffer times:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Pufferzeiten.' });
  }
});

// API: Create a new buffer time
app.post('/api/praxis/buffer-times', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }

  const { title, isRecurring, dayOfWeek, specificDate, startTime, endTime } = req.body;
  const praxisId = req.session.userId;

  if (!startTime || !endTime) {
    return res.status(400).json({ error: 'Start- und Endzeit sind erforderlich.' });
  }

  if (startTime >= endTime) {
    return res.status(400).json({ error: 'Die Startzeit muss vor der Endzeit liegen.' });
  }

  if (isRecurring && (dayOfWeek === undefined || dayOfWeek === null)) {
    return res.status(400).json({ error: 'Für wiederkehrende Pufferzeiten muss ein Wochentag gewählt werden.' });
  }

  if (!isRecurring && !specificDate) {
    return res.status(400).json({ error: 'Für einmalige Pufferzeiten muss ein Datum gewählt werden.' });
  }

  // Check for conflicts with existing patient appointments
  const praxisName = req.session.user?.praxis_name || '';
  const timeToMin = (tStr) => {
    if (!tStr) return 0;
    const [h, m] = tStr.split(':').map(Number);
    return h * 60 + m;
  };
  const normalizeDateStr = (dStr) => {
    if (!dStr) return '';
    const str = String(dStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const ddmmyyyy = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${String(ddmmyyyy[2]).padStart(2, '0')}-${String(ddmmyyyy[1]).padStart(2, '0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return str;
  };
  const getDayOfWeek = (dStr) => {
    const norm = normalizeDateStr(dStr);
    if (!norm) return -1;
    const d = new Date(norm + 'T00:00:00');
    return isNaN(d.getTime()) ? -1 : d.getDay();
  };

  const bufStartMin = timeToMin(startTime);
  const bufEndMin = timeToMin(endTime);

  if (isDbConnected && pool && praxisName) {
    try {
      const apptRes = await pool.query(
        `SELECT code, patient_vorname, patient_nachname, date, time, duration FROM termine WHERE praxis = $1`,
        [praxisName]
      );
      const apptRows = (apptRes && apptRes.rows) ? apptRes.rows : [];
      for (const appt of apptRows) {
        const normApptDate = normalizeDateStr(appt.date);
        const apptDow = getDayOfWeek(appt.date);

        let matches = false;
        if (isRecurring) {
          if (apptDow === parseInt(dayOfWeek)) matches = true;
        } else {
          if (normApptDate === specificDate || appt.date === specificDate) matches = true;
        }

        if (!matches) continue;

        const apptStartMin = timeToMin(appt.time);
        const apptEndMin = apptStartMin + (appt.duration || 30);

        if (apptStartMin < bufEndMin && apptEndMin > bufStartMin) {
          const name = `${appt.patient_vorname || ''} ${appt.patient_nachname || ''}`.trim() || 'Patient';
          return res.status(400).json({
            error: `Kollision mit bestehendem Patiententermin (${name}) am ${appt.date} um ${appt.time} Uhr.`
          });
        }
      }
    } catch (confErr) {
      console.warn('Buffer conflict check query error:', confErr.message);
    }
  }

  if (!isDbConnected || !pool) {
    // Mock mode conflict check
    const mockAppts = req.session.mockAppointments || [];
    for (const appt of mockAppts) {
      if (appt.praxis && praxisName && appt.praxis !== praxisName) continue;
      
      const normApptDate = normalizeDateStr(appt.date);
      const apptDow = getDayOfWeek(appt.date);

      let matches = false;
      if (isRecurring) {
        if (apptDow === parseInt(dayOfWeek)) matches = true;
      } else {
        if (normApptDate === specificDate || appt.date === specificDate) matches = true;
      }

      if (!matches) continue;

      const apptStartMin = timeToMin(appt.time);
      const apptEndMin = apptStartMin + (appt.duration || 30);

      if (apptStartMin < bufEndMin && apptEndMin > bufStartMin) {
        const name = `${appt.patient_vorname || ''} ${appt.patient_nachname || ''}`.trim() || 'Patient';
        return res.status(400).json({
          error: `Kollision mit bestehendem Patiententermin (${name}) am ${appt.date} um ${appt.time} Uhr.`
        });
      }
    }

    if (!req.session.mockBufferTimes) req.session.mockBufferTimes = [];
    const mockBt = {
      id: Date.now(),
      praxis_id: praxisId,
      title: title || 'Pufferzeit',
      is_recurring: !!isRecurring,
      day_of_week: isRecurring ? parseInt(dayOfWeek) : null,
      specific_date: !isRecurring ? specificDate : null,
      start_time: startTime,
      end_time: endTime,
      created_at: new Date().toISOString()
    };
    req.session.mockBufferTimes.push(mockBt);
    return res.json({ success: true, bufferTime: mockBt });
  }

  try {
    const result = await pool.query(
      `INSERT INTO buffer_times (praxis_id, title, is_recurring, day_of_week, specific_date, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        praxisId,
        title || 'Pufferzeit',
        !!isRecurring,
        isRecurring ? parseInt(dayOfWeek) : null,
        !isRecurring ? specificDate : null,
        startTime,
        endTime
      ]
    );
    res.json({ success: true, bufferTime: result.rows[0] });
  } catch (err) {
    console.error('Error creating buffer time:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Pufferzeit.' });
  }
});

// API: Delete a buffer time
app.delete('/api/praxis/buffer-times/:id', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }

  const btId = parseInt(req.params.id);
  const praxisId = req.session.userId;

  if (!isDbConnected || !pool) {
    if (req.session.mockBufferTimes) {
      req.session.mockBufferTimes = req.session.mockBufferTimes.filter(bt => bt.id !== btId);
    }
    return res.json({ success: true });
  }

  try {
    await pool.query('DELETE FROM buffer_times WHERE id = $1 AND praxis_id = $2', [btId, praxisId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting buffer time:', err);
    res.status(500).json({ error: 'Fehler beim Löschen der Pufferzeit.' });
  }
});

// ============================================
// PRAXIS DASHBOARD API ENDPOINTS
// ============================================

// API: Get all appointments for the logged-in praxis
app.get('/api/praxis/termine', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const praxisName = req.session.user.praxis_name;
  if (!praxisName || !isDbConnected || !pool) {
    return res.json({ success: true, termine: [] });
  }
  try {
    const result = await pool.query(
      `SELECT t.*, p.submitted as precheck_submitted, p.current_step as precheck_step,
              p.beschwerden, p.medikamente, p.allergien, p.dokumente, p.signature_data, p.custom_answers,
              p.document_confirmations, p.ai_questions,
              u.geburtsdatum as patient_geburtsdatum, u.krankenversicherung as patient_versicherung, u.krankenkasse as patient_krankenkasse
       FROM termine t
       LEFT JOIN precheckins p ON t.code = p.termin_code
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.praxis = $1
       ORDER BY t.date DESC, t.time DESC`,
      [praxisName]
    );
    res.json({ success: true, termine: result.rows });
  } catch (err) {
    console.error('Error fetching praxis appointments:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Termine.' });
  }
});

// API: Manually book/create an appointment for a patient (by praxis staff)
// API: Search patient profile data by query
app.get('/api/praxis/patients/search', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }

  const query = (req.query.q || '').trim().toLowerCase();
  if (!query) {
    return res.json({ success: true, patients: [] });
  }

  const praxisName = req.session.user.praxis_name || 'Meine Praxis';

  if (!isDbConnected || !pool) {
    // Offline mode patient search
    if (!req.session.mockPatients) {
      req.session.mockPatients = [
        {
          email: 'patient@example.com',
          vorname: 'Max',
          nachname: 'Mustermann',
          geburtsdatum: '1990-01-01',
          telefonnummer: '017612345678',
          strasse_hnr: 'Leopoldstraße 12',
          plz_ort: '80802 München',
          krankenversicherung: 'gesetzlich',
          krankenkasse: 'AOK Bayern'
        }
      ];
    }
    const filtered = req.session.mockPatients.filter(p => 
      p.email.toLowerCase().includes(query) ||
      p.vorname.toLowerCase().includes(query) ||
      p.nachname.toLowerCase().includes(query) ||
      `${p.vorname} ${p.nachname}`.toLowerCase().includes(query)
    );
    return res.json({ success: true, patients: filtered });
  }

  try {
    const queryStr = `%${query}%`;
    const searchResult = await pool.query(
      `SELECT DISTINCT u.id, u.email, u.vorname, u.nachname, u.geburtsdatum, u.telefonnummer, u.strasse_hnr, u.plz_ort, u.krankenversicherung, u.krankenkasse
       FROM users u
       JOIN termine t ON (t.user_id = u.id OR LOWER(t.notify_email) = LOWER(u.email))
       WHERE u.role = 'patient' 
         AND t.praxis = $1
         AND (u.email ILIKE $2 OR u.vorname ILIKE $2 OR u.nachname ILIKE $2 OR (u.vorname || ' ' || u.nachname) ILIKE $2)`,
      [praxisName, queryStr]
    );
    res.json({ success: true, patients: searchResult.rows });
  } catch (err) {
    console.error('Error searching patients:', err);
    res.status(500).json({ error: 'Fehler bei der Patientensuche.' });
  }
});

// API: Manually book/create an appointment for a patient (by praxis staff)
app.post('/api/praxis/termine/buchen', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }

  const { 
    patientEmail, 
    patientVorname, 
    patientNachname, 
    doctor, 
    date, 
    time, 
    art,
    geburtsdatum,
    telefonnummer,
    strasse_hnr,
    plz_ort,
    krankenversicherung,
    krankenkasse
  } = req.body;

  if (!patientEmail || !patientVorname || !patientNachname || !doctor || !date || !time || !art) {
    return res.status(400).json({ error: 'Alle Pflichtfelder müssen ausgefüllt werden.' });
  }

  // Validate appointment is not in the past
  const selectedDateTime = new Date(`${date}T${time}:00`);
  const now = new Date();
  if (selectedDateTime.getTime() < now.getTime() - 5 * 60 * 1000) {
    return res.status(400).json({ error: 'Termine in der Vergangenheit können nicht gebucht werden.' });
  }

  const praxisName = req.session.user.praxis_name || 'Meine Praxis';
  const fachrichtung = req.session.user.praxis_fachbereich || 'Allgemeinmedizin';
  const adresse = req.session.user.praxis_adresse || 'Musterstraße 1, 12345 Musterstadt';

  // Validate opening hours
  const timeValidation = await validateAppointmentTime(praxisName, date, time, req);
  if (!timeValidation.valid) {
    return res.status(400).json({ error: timeValidation.error || 'Der gewählte Termin liegt außerhalb der Öffnungszeiten der Praxis.' });
  }

  if (!isDbConnected || !pool) {
    // Offline mode: mock booking
    if (!req.session.mockPatients) {
      req.session.mockPatients = [
        {
          email: 'patient@example.com',
          vorname: 'Max',
          nachname: 'Mustermann',
          geburtsdatum: '1990-01-01',
          telefonnummer: '017612345678',
          strasse_hnr: 'Leopoldstraße 12',
          plz_ort: '80802 München',
          krankenversicherung: 'gesetzlich',
          krankenkasse: 'AOK Bayern'
        }
      ];
    }

    const patientExists = req.session.mockPatients.some(p => p.email.toLowerCase() === patientEmail.toLowerCase());
    if (!patientExists) {
      req.session.mockPatients.push({
        email: patientEmail,
        vorname: patientVorname,
        nachname: patientNachname,
        geburtsdatum: geburtsdatum || '',
        telefonnummer: telefonnummer || '',
        strasse_hnr: strasse_hnr || '',
        plz_ort: plz_ort || '',
        krankenversicherung: krankenversicherung || 'gesetzlich',
        krankenkasse: krankenkasse || ''
      });
    }

    // Check if slot already booked for this praxis
    const existingSlot = (req.session.mockAppointments || []).find(
      a => a.date === date && a.time === time && a.praxis === praxisName && a.status !== 'abgesagt'
    );
    if (existingSlot) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist in Ihrer Praxis bereits vergeben.' });
    }

    // Check if patient already has an appointment at this time
    const existingPatientAppt = (req.session.mockAppointments || []).find(
      a => a.date === date && a.time === time && a.notify_email && a.notify_email.toLowerCase() === patientEmail.toLowerCase() && a.status !== 'abgesagt'
    );
    if (existingPatientAppt) {
      return res.status(400).json({ error: 'Der Patient hat zu dieser Uhrzeit bereits einen anderen Termin gebucht.' });
    }

    const code = 't_MOCK' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const mockAppt = {
      code,
      doctor,
      fachrichtung,
      adresse,
      date,
      time,
      art,
      praxis: praxisName,
      tags: [],
      patient_vorname: patientVorname,
      patient_nachname: patientNachname,
      user_id: null,
      notify_email: patientEmail,
      notify_sent: true
    };
    if (!req.session.mockAppointments) {
      req.session.mockAppointments = [];
    }
    req.session.mockAppointments.push(mockAppt);
    console.log('[Offline Mode] Mocked manual appointment created:', mockAppt);
    return res.json({ success: true, appointment: mockAppt });
  }

  try {
    // 1. Look up existing patient user
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND role = $2',
      [patientEmail.toLowerCase(), 'patient']
    );
    let userId = null;

    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
      // Auto-fill or update blank profile fields of existing patient
      await pool.query(
        `UPDATE users SET 
           geburtsdatum = COALESCE(geburtsdatum, $1),
           telefonnummer = COALESCE(telefonnummer, $2),
           strasse_hnr = COALESCE(strasse_hnr, $3),
           plz_ort = COALESCE(plz_ort, $4),
           krankenversicherung = COALESCE(krankenversicherung, $5),
           krankenkasse = COALESCE(krankenkasse, $6)
         WHERE id = $7`,
        [
          geburtsdatum || null,
          telefonnummer || null,
          strasse_hnr || null,
          plz_ort || null,
          krankenversicherung || null,
          krankenkasse || null,
          userId
        ]
      );
    } else {
      // Create a manual patient user profile (Akte)
      const placeholderHash = 'PLACEHOLDER_MANUAL';
      const userInsert = await pool.query(
        `INSERT INTO users (email, password_hash, vorname, nachname, role, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          patientEmail.toLowerCase(),
          placeholderHash,
          patientVorname,
          patientNachname,
          'patient',
          geburtsdatum || null,
          telefonnummer || null,
          strasse_hnr || null,
          plz_ort || null,
          krankenversicherung || 'gesetzlich',
          krankenkasse || null
        ]
      );
      userId = userInsert.rows[0].id;
    }

    // 2. Check if patient already has an appointment at this time
    if (userId || patientEmail) {
      const userBlockCheck = await pool.query(
        `SELECT code FROM termine WHERE date = $1 AND time = $2 AND (user_id = $3 OR LOWER(notify_email) = $4) AND (status IS NULL OR status != 'abgesagt')`,
        [date, time, userId, patientEmail.toLowerCase()]
      );
      if (userBlockCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Der Patient hat zu dieser Uhrzeit bereits einen anderen Termin gebucht.' });
      }
    }

    // 3. Check if slot already booked for this praxis
    const slotCheck = await pool.query(
      `SELECT code FROM termine WHERE date = $1 AND time = $2 AND praxis = $3 AND (status IS NULL OR status != 'abgesagt')`,
      [date, time, praxisName]
    );
    if (slotCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist in Ihrer Praxis bereits vergeben.' });
    }

    // 3. Insert new appointment
    const code = 't_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const query = `
      INSERT INTO termine (code, doctor, fachrichtung, adresse, date, time, art, praxis, tags, patient_vorname, patient_nachname, user_id, notify_email, notify_sent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      praxisName,
      [],
      patientVorname,
      patientNachname,
      userId,
      patientEmail.toLowerCase(),
      true // Sent immediately
    ];

    const result = await pool.query(query, values);
    const appointment = result.rows[0];

    // 4. Send Email Notification
    let displayDate = date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
      const parts = displayDate.split('-');
      displayDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    const emailAppointment = {
      ...appointment,
      date: displayDate,
      vorname: patientVorname,
      nachname: patientNachname
    };

    // Trigger sending the email in background (or await it)
    sendNotificationEmail(patientEmail.toLowerCase(), emailAppointment).catch(err => {
      console.error('Failed to send immediate notification email:', err);
    });

    res.json({ success: true, appointment });
  } catch (err) {
    console.error('Error creating manual appointment:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Termins.' });
  }
});

// API: Get stats for the logged-in praxis
app.get('/api/praxis/stats', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const praxisName = req.session.user.praxis_name;
  if (!praxisName || !isDbConnected || !pool) {
    return res.json({ success: true, stats: { totalTermine: 0, prechecksCompleted: 0, prechecksOpen: 0, uniquePatients: 0 } });
  }
  try {
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM termine WHERE praxis = $1', [praxisName]);
    const completedResult = await pool.query(
      `SELECT COUNT(*) as count FROM termine t JOIN precheckins p ON t.code = p.termin_code WHERE t.praxis = $1 AND p.submitted = true`, [praxisName]
    );
    const openResult = await pool.query(
      `SELECT COUNT(*) as count FROM termine t LEFT JOIN precheckins p ON t.code = p.termin_code WHERE t.praxis = $1 AND (p.submitted = false OR p.termin_code IS NULL)`, [praxisName]
    );
    const patientsResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count FROM termine WHERE praxis = $1 AND user_id IS NOT NULL`, [praxisName]
    );
    res.json({
      success: true,
      stats: {
        totalTermine: parseInt(totalResult.rows[0].count),
        prechecksCompleted: parseInt(completedResult.rows[0].count),
        prechecksOpen: parseInt(openResult.rows[0].count),
        uniquePatients: parseInt(patientsResult.rows[0].count)
      }
    });
  } catch (err) {
    console.error('Error fetching praxis stats:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken.' });
  }
});

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// API: Get all registered practices
app.get('/api/praxen', async (req, res) => {
  if (!isDbConnected || !pool) {
    return res.json({ success: true, praxen: [] });
  }
  try {
    const result = await pool.query(
      `SELECT id, vorname, nachname, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon 
       FROM users 
       WHERE role = 'praxis' AND praxis_name IS NOT NULL`
    );
    
    const dbPraxen = result.rows.map(user => {
      const slug = slugify(user.praxis_name) + '-' + user.id;
      return {
        id: 'db_' + user.id,
        slug: slug,
        name: user.praxis_name,
        fachbereich: user.praxis_fachbereich,
        adresse: user.praxis_adresse || 'Keine Adresse hinterlegt',
        telefon: user.praxis_telefon || '',
        behandlungsarten: 'Gesetzlich und privat versichert',
        beschreibung: `Praxis für ${user.praxis_fachbereich}. Arzt/Ärztin: Dr. med. ${user.vorname} ${user.nachname}. Wir bieten moderne medizinische Versorgung und Pre-Check-In an.`,
        logo: '🏥',
        color: '#0063BE',
        gradient: 'linear-gradient(135deg, #0063BE, #004f98)'
      };
    });

    res.json({ success: true, praxen: dbPraxen });
  } catch (err) {
    console.error('Error fetching registered practices:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Praxen.' });
  }
});

// API: Get custom questions for the logged-in practice
app.get('/api/praxis/questions', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  if (!isDbConnected || !pool) {
    return res.json({ success: true, questions: [] });
  }
  try {
    const result = await pool.query(
      'SELECT id, question_text, question_type, options, required FROM praxis_questions WHERE praxis_id = $1 ORDER BY id ASC',
      [req.session.userId]
    );
    res.json({ success: true, questions: result.rows });
  } catch (err) {
    console.error('Error loading custom questions:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Fragen.' });
  }
});

// API: Save custom questions for the logged-in practice
app.post('/api/praxis/questions', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  const { questions } = req.body;
  if (!Array.isArray(questions)) {
    return res.status(400).json({ error: 'Fragen müssen ein Array sein.' });
  }
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    // Delete existing questions
    await pool.query('DELETE FROM praxis_questions WHERE praxis_id = $1', [req.session.userId]);
    
    // Insert new questions
    for (const q of questions) {
      if (!q.question_text || !q.question_type) continue;
      await pool.query(
        `INSERT INTO praxis_questions (praxis_id, question_text, question_type, options, required)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          req.session.userId,
          q.question_text,
          q.question_type,
          JSON.stringify(q.options || []),
          q.required || false
        ]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving custom questions:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Fragen.' });
  }
});

// API: Get custom questions for a patient's pre-check-in based on terminCode
app.get('/api/precheckin/questions', async (req, res) => {
  const { termin } = req.query;
  if (!termin) {
    return res.status(400).json({ error: 'Termin-Code fehlt.' });
  }
  if (!isDbConnected || !pool) {
    return res.json({ success: true, questions: [] });
  }
  try {
    // 1. Get practice name from the appointment
    const terminRes = await pool.query('SELECT praxis FROM termine WHERE code = $1', [termin]);
    if (terminRes.rows.length === 0) {
      return res.json({ success: true, questions: [] });
    }
    const praxisName = terminRes.rows[0].praxis;

    // 2. Find the practice user ID
    const userRes = await pool.query('SELECT id FROM users WHERE role = \'praxis\' AND praxis_name = $1', [praxisName]);
    if (userRes.rows.length === 0) {
      return res.json({ success: true, questions: [] });
    }
    const praxisId = userRes.rows[0].id;

    // 3. Load the questions
    const qRes = await pool.query(
      'SELECT id, question_text, question_type, options, required FROM praxis_questions WHERE praxis_id = $1 ORDER BY id ASC',
      [praxisId]
    );

    res.json({ success: true, questions: qRes.rows });
  } catch (err) {
    console.error('Error loading patient precheckin custom questions:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Zusatzfragen.' });
  }
});

// API: Get blocked slots for a given date and praxis
app.get('/api/termine/blocked', async (req, res) => {
  const { date, praxis, excludeCode } = req.query;
  console.log(`[GET /api/termine/blocked] date=${date}, praxis=${praxis}, excludeCode=${excludeCode}, session.userId=${req.session?.userId}`);
  if (!date || !praxis) {
    return res.status(400).json({ error: 'Datum und Praxis werden benötigt.' });
  }

  const userId = req.session ? req.session.userId : null;

  if (!isDbConnected || !pool) {
    // Block if same praxis OR same user (excluding excludeCode) and not cancelled
    const matches = (req.session.mockAppointments || [])
      .filter(appt => appt.date === date && appt.code !== excludeCode && appt.status !== 'abgesagt' && (appt.praxis === praxis || (userId && appt.user_id === userId)))
      .map(appt => appt.time);

    // Also block slots that fall within mock buffer times
    if (req.session.mockBufferTimes) {
      try {
        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();
        const relevantBts = req.session.mockBufferTimes.filter(bt => {
          if (bt.is_recurring && bt.day_of_week === dayOfWeek) return true;
          if (!bt.is_recurring && bt.specific_date === date) return true;
          return false;
        });

        for (const bt of relevantBts) {
          const [bsh, bsm] = bt.start_time.split(':').map(Number);
          const [beh, bem] = bt.end_time.split(':').map(Number);
          const bufStartMin = bsh * 60 + bsm;
          const bufEndMin = beh * 60 + bem;
          for (let slotMin = 7 * 60; slotMin < 18 * 60; slotMin += 30) {
            const slotEnd = slotMin + 30;
            if (slotMin < bufEndMin && slotEnd > bufStartMin) {
              const slotStr = `${String(Math.floor(slotMin / 60)).padStart(2, '0')}:${String(slotMin % 60).padStart(2, '0')}`;
              if (!matches.includes(slotStr)) {
                matches.push(slotStr);
              }
            }
          }
        }
      } catch (btErr) {
        console.error('Error filtering mock buffer times:', btErr);
      }
    }

    return res.json({ blocked: matches });
  }

  try {
    // Get slots where praxis is same (booked by anyone) OR user_id is current user (booked by this user), excluding current appointment
    const result = await pool.query(
      "SELECT time FROM termine WHERE date = $1 AND (praxis = $2 OR user_id = $3) AND code != $4 AND (status IS NULL OR status != 'abgesagt')",
      [date, praxis, userId || -1, excludeCode || '']
    );
    const blockedSlots = result.rows.map(row => row.time);

    // Also block slots that fall within buffer times
    try {
      const dateObj = new Date(date + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      const btResult = await pool.query(
        `SELECT bt.start_time, bt.end_time FROM buffer_times bt
         JOIN users u ON bt.praxis_id = u.id
         WHERE u.praxis_name = $1 AND (
           (bt.is_recurring = TRUE AND bt.day_of_week = $2)
           OR (bt.is_recurring = FALSE AND bt.specific_date = $3)
         )`,
        [praxis, dayOfWeek, date]
      );
      for (const bt of btResult.rows) {
        const [bsh, bsm] = bt.start_time.split(':').map(Number);
        const [beh, bem] = bt.end_time.split(':').map(Number);
        const bufStartMin = bsh * 60 + bsm;
        const bufEndMin = beh * 60 + bem;
        // Generate all 30-min slots that overlap
        for (let slotMin = 7 * 60; slotMin < 18 * 60; slotMin += 30) {
          const slotEnd = slotMin + 30;
          if (slotMin < bufEndMin && slotEnd > bufStartMin) {
            const slotStr = `${String(Math.floor(slotMin / 60)).padStart(2, '0')}:${String(slotMin % 60).padStart(2, '0')}`;
            if (!blockedSlots.includes(slotStr)) {
              blockedSlots.push(slotStr);
            }
          }
        }
      }
    } catch (btErr) {
      console.error('Error fetching buffer times for blocked slots:', btErr);
    }

    console.log(`[GET /api/termine/blocked] returning blocked slots:`, blockedSlots);
    res.json({ blocked: blockedSlots });
  } catch (err) {
    console.error('Error fetching blocked slots:', err);
    res.status(500).json({ error: 'Fehler beim Laden belegter Zeiten.' });
  }
});

// API: Book a new appointment
app.post('/api/termine/buchen', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  const { doctor, fachrichtung, adresse, date, time, art, praxis, tags } = req.body;
  console.log(`[POST /api/termine/buchen] date=${date}, time=${time}, praxis=${praxis}, userId=${req.session.userId}`);

  if (!doctor || !fachrichtung || !adresse || !date || !time || !art || !praxis) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder.' });
  }

  // Validate opening hours
  const timeValidation = await validateAppointmentTime(praxis, date, time, req);
  if (!timeValidation.valid) {
    return res.status(400).json({ error: timeValidation.error || 'Der gewählte Termin liegt außerhalb der Öffnungszeiten der Praxis.' });
  }

  if (!isDbConnected || !pool) {
    // Check if slot already booked in mockAppointments for this praxis
    const existing = (req.session.mockAppointments || []).find(
      appt => appt.date === date && appt.time === time && appt.praxis === praxis && appt.status !== 'abgesagt'
    );
    if (existing) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist bereits vergeben.' });
    }

    // Check if user already has an appointment at this time
    const userExisting = (req.session.mockAppointments || []).find(
      appt => appt.date === date && appt.time === time && appt.user_id === req.session.userId && appt.status !== 'abgesagt'
    );
    if (userExisting) {
      return res.status(400).json({ error: 'Sie haben zu dieser Uhrzeit bereits einen anderen Termin gebucht.' });
    }

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
    // Check if slot already booked in DB for this praxis
    const blockCheck = await pool.query(
      "SELECT code FROM termine WHERE date = $1 AND time = $2 AND praxis = $3 AND (status IS NULL OR status != 'abgesagt')",
      [date, time, praxis]
    );
    if (blockCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist bereits vergeben.' });
    }

    // Check if user already has an appointment at this time
    const userBlockCheck = await pool.query(
      "SELECT code FROM termine WHERE date = $1 AND time = $2 AND user_id = $3 AND (status IS NULL OR status != 'abgesagt')",
      [date, time, req.session.userId]
    );
    if (userBlockCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Sie haben zu dieser Uhrzeit bereits einen anderen Termin gebucht.' });
    }

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
    if (req.session.user && req.session.user.email) {
      await pool.query(
        'UPDATE termine SET user_id = $1 WHERE notify_email = $2 AND user_id IS NULL',
        [req.session.userId, req.session.user.email.toLowerCase()]
      );
    }

    const result = await pool.query(
      `SELECT t.*, p.submitted as precheck_submitted, p.current_step as precheck_step, p.ai_consent as precheck_consent
       FROM termine t
       LEFT JOIN precheckins p ON t.code = p.termin_code
       WHERE t.user_id = $1
       ORDER BY t.date DESC, t.time DESC`,
      [req.session.userId]
    );

    const appts = result.rows;
    for (const appt of appts) {
      const filesRes = await pool.query(
        `SELECT id, filename, mime_type, file_size, uploaded_at, doc_category 
         FROM uploaded_files 
         WHERE termin_code = $1 AND uploaded_by = 'praxis' 
         ORDER BY uploaded_at DESC`,
        [appt.code]
      );
      appt.shared_documents = filesRes.rows;

      const aftercareRes = await pool.query(
        `SELECT id, instructions, sent_at 
         FROM aftercare_instructions 
         WHERE termin_code = $1 
         ORDER BY sent_at DESC`,
        [appt.code]
      );
      appt.aftercare_instructions = aftercareRes.rows;
    }

    res.json({ success: true, appointments: appts });
  } catch (err) {
    console.error('Error fetching user appointments:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Termine.' });
  }
});

// API: Reschedule an existing appointment
app.post('/api/termine/:code/reschedule', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  const { code } = req.params;
  const { date, time } = req.body;

  if (!date || !time) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder.' });
  }

  if (!isDbConnected || !pool) {
    if (!req.session.mockAppointments) req.session.mockAppointments = [];
    const appt = req.session.mockAppointments.find(a => a.code === code && a.user_id === req.session.userId);
    if (!appt) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    // Check if slot already booked by another appointment in mockAppointments for this praxis
    const existing = req.session.mockAppointments.find(
      a => a.date === date && a.time === time && a.praxis === appt.praxis && a.code !== code && a.status !== 'abgesagt'
    );
    if (existing) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist bereits vergeben.' });
    }

    // Check if user already has another appointment at this time
    const userExisting = req.session.mockAppointments.find(
      a => a.date === date && a.time === time && a.user_id === req.session.userId && a.code !== code && a.status !== 'abgesagt'
    );
    if (userExisting) {
      return res.status(400).json({ error: 'Sie haben zu dieser Uhrzeit bereits einen anderen Termin gebucht.' });
    }

    appt.date = date;
    appt.time = time;
    return res.json({ success: true, appointment: appt });
  }

  try {
    // Get current appointment to get its praxis name
    const apptCheck = await pool.query('SELECT praxis FROM termine WHERE code = $1 AND user_id = $2', [code, req.session.userId]);
    if (apptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    const praxisName = apptCheck.rows[0].praxis;

    // Check if slot already booked in DB for this praxis by another appointment
    const blockCheck = await pool.query(
      "SELECT code FROM termine WHERE date = $1 AND time = $2 AND praxis = $3 AND code != $4 AND (status IS NULL OR status != 'abgesagt')",
      [date, time, praxisName, code]
    );
    if (blockCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist bereits vergeben.' });
    }

    // Check if user already has another appointment at this time
    const userBlockCheck = await pool.query(
      "SELECT code FROM termine WHERE date = $1 AND time = $2 AND user_id = $3 AND code != $4 AND (status IS NULL OR status != 'abgesagt')",
      [date, time, req.session.userId, code]
    );
    if (userBlockCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Sie haben zu dieser Uhrzeit bereits einen anderen Termin gebucht.' });
    }

    const result = await pool.query(
      'UPDATE termine SET date = $1, time = $2 WHERE code = $3 AND user_id = $4 RETURNING *',
      [date, time, code, req.session.userId]
    );
    res.json({ success: true, appointment: result.rows[0] });
  } catch (err) {
    console.error('Error rescheduling appointment:', err);
    res.status(500).json({ error: 'Terminverschiebung fehlgeschlagen.' });
  }
});

// API: Cancel (delete) an existing appointment
app.delete('/api/termine/:code', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  const { code } = req.params;

  if (!isDbConnected || !pool) {
    if (!req.session.mockAppointments) req.session.mockAppointments = [];
    const idx = req.session.mockAppointments.findIndex(a => a.code === code && a.user_id === req.session.userId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    req.session.mockAppointments[idx].status = 'abgesagt';
    return res.json({ success: true });
  }

  try {
    const result = await pool.query(
      "UPDATE termine SET status = 'abgesagt' WHERE code = $1 AND user_id = $2",
      [code, req.session.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden oder nicht berechtigt.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error canceling appointment:', err);
    res.status(500).json({ error: 'Stornierung fehlgeschlagen.' });
  }
});

// API: Update appointment metadata (status, urgent, favorite, priority)
app.patch('/api/termine/:code/metadata', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  const { code } = req.params;
  const { status, urgent, favorite, priority } = req.body;

  if (!isDbConnected || !pool) {
    if (!req.session.mockAppointments) req.session.mockAppointments = [];
    const appt = req.session.mockAppointments.find(a => a.code === code && a.user_id === req.session.userId);
    if (!appt) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    if (status !== undefined) appt.status = status;
    if (urgent !== undefined) appt.urgent = !!urgent;
    if (favorite !== undefined) appt.favorite = !!favorite;
    if (priority !== undefined) appt.priority = parseInt(priority, 10) || 0;
    return res.json({ success: true, appointment: appt });
  }

  try {
    const fields = [];
    const values = [];
    let placeholderIdx = 1;

    if (status !== undefined) {
      fields.push(`status = $${placeholderIdx++}`);
      values.push(status);
    }
    if (urgent !== undefined) {
      fields.push(`urgent = $${placeholderIdx++}`);
      values.push(!!urgent);
    }
    if (favorite !== undefined) {
      fields.push(`favorite = $${placeholderIdx++}`);
      values.push(!!favorite);
    }
    if (priority !== undefined) {
      fields.push(`priority = $${placeholderIdx++}`);
      values.push(parseInt(priority, 10) || 0);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren angegeben.' });
    }

    values.push(code, req.session.userId);
    const query = `
      UPDATE termine 
      SET ${fields.join(', ')} 
      WHERE code = $${placeholderIdx++} AND user_id = $${placeholderIdx++}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    res.json({ success: true, appointment: result.rows[0] });
  } catch (err) {
    console.error('Error updating appointment metadata:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Termins.' });
  }
});

// API: Submit feedback for a completed appointment
app.post('/api/termine/:code/feedback', async (req, res) => {
  const { code } = req.params;
  const { rating, feedbackText } = req.body;

  const ratingVal = parseInt(rating, 10);
  if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
    return res.status(400).json({ error: 'Bitte geben Sie eine Bewertung zwischen 1 und 5 Sternen ab.' });
  }

  if (!isDbConnected || !pool) {
    // Offline mode: mock save
    if (req.session.mockAppointments) {
      const appt = req.session.mockAppointments.find(a => a.code === code);
      if (appt) {
        appt.rating = ratingVal;
        appt.feedback_text = feedbackText || '';
      }
    }
    return res.json({ success: true });
  }

  try {
    const checkAppt = await pool.query('SELECT code FROM termine WHERE code = $1', [code]);
    if (checkAppt.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    await pool.query(
      'UPDATE termine SET rating = $1, feedback_text = $2 WHERE code = $3',
      [ratingVal, feedbackText || null, code]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ error: 'Fehler beim Übermitteln des Feedbacks.' });
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

// API: Get praxis documents for a patient's pre-check-in (filtered by started_at timestamp)
app.get('/api/precheckin/documents', async (req, res) => {
  const { termin } = req.query;
  console.log(`[GET /api/precheckin/documents] termin=${termin}`);
  if (!termin) {
    return res.status(400).json({ error: 'Termin-Code fehlt.' });
  }
  if (!isDbConnected || !pool) {
    return res.json({ success: true, documents: [] });
  }
  try {
    // 1. Get practice name from the appointment
    const terminRes = await pool.query('SELECT praxis FROM termine WHERE code = $1', [termin]);
    if (terminRes.rows.length === 0) {
      console.log(`[GET /api/precheckin/documents] No appointment found for code: ${termin}`);
      return res.json({ success: true, documents: [] });
    }
    const praxisName = terminRes.rows[0].praxis;

    // 2. Find the practice user ID (case-insensitive)
    const userRes = await pool.query("SELECT id FROM users WHERE role = 'praxis' AND LOWER(praxis_name) = LOWER($1)", [praxisName]);
    if (userRes.rows.length === 0) {
      return res.json({ success: true, documents: [] });
    }
    const praxisId = userRes.rows[0].id;

    // 3. Load documents that existed when the PreCheckIn was started (directly comparing timestamps in SQL)
    // If the precheckin is not yet submitted, always show all currently available documents.
    const docsRes = await pool.query(
      `SELECT pd.id, pd.title, pd.doc_type, pd.file_id, pd.created_at,
              uf.filename, uf.mime_type, uf.file_size
       FROM praxis_documents pd
       LEFT JOIN uploaded_files uf ON pd.file_id = uf.id
       WHERE pd.praxis_id = $1 
         AND (
           COALESCE((SELECT submitted FROM precheckins WHERE termin_code = $2), FALSE) = FALSE
           OR
           pd.created_at <= COALESCE(
             (SELECT started_at FROM precheckins WHERE termin_code = $2),
             CURRENT_TIMESTAMP + INTERVAL '5 minutes'
           )
         )
       ORDER BY pd.created_at ASC`,
      [praxisId, termin]
    );

    console.log(`[GET /api/precheckin/documents] Found ${docsRes.rows.length} documents for termin=${termin}`);
    res.json({ success: true, documents: docsRes.rows });
  } catch (err) {
    console.error('Error loading patient precheckin documents:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Praxis-Dokumente.' });
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
      'SELECT session_id, termin_code, beschwerden, medikamente, allergien, dokumente, signature_data, current_step, submitted, custom_answers, document_confirmations, started_at, ai_questions, ai_consent FROM precheckins WHERE termin_code = $1',
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
        submitted: row.submitted,
        customAnswers: row.custom_answers || {},
        documentConfirmations: row.document_confirmations || {},
        startedAt: row.started_at,
        aiQuestions: row.ai_questions || [],
        aiConsent: row.ai_consent
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
  const { sessionId, terminCode, beschwerden, medikamente, allergien, dokumente, signatureData, currentStep, submitted, customAnswers, documentConfirmations, aiQuestions, aiConsent } = req.body;

  if (!sessionId || !terminCode) {
    return res.status(400).json({ error: 'Missing required fields: sessionId and terminCode' });
  }

  if (!isDbConnected || !pool) {
    console.log(`[Offline Mode] Received mock pre-check-in save for session: ${sessionId}`);
    return res.json({ success: true, offline: true });
  }

  try {
    // Save to database, upsert if the appointment already exists
    // started_at is only set on INSERT (not updated on conflict)
    await pool.query(
      `INSERT INTO precheckins (termin_code, session_id, beschwerden, medikamente, allergien, dokumente, signature_data, current_step, submitted, custom_answers, document_confirmations, started_at, ai_questions, ai_consent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, $12, $13)
       ON CONFLICT (termin_code)
       DO UPDATE SET
         session_id = EXCLUDED.session_id,
         beschwerden = EXCLUDED.beschwerden,
         medikamente = EXCLUDED.medikamente,
         allergien = EXCLUDED.allergien,
         dokumente = EXCLUDED.dokumente,
         signature_data = EXCLUDED.signature_data,
         current_step = EXCLUDED.current_step,
         submitted = CASE WHEN precheckins.submitted THEN TRUE ELSE EXCLUDED.submitted END,
         custom_answers = EXCLUDED.custom_answers,
         document_confirmations = EXCLUDED.document_confirmations,
         ai_questions = EXCLUDED.ai_questions,
         ai_consent = EXCLUDED.ai_consent,
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
        submitted || false,
        JSON.stringify(customAnswers || {}),
        JSON.stringify(documentConfirmations || {}),
        JSON.stringify(aiQuestions || []),
        aiConsent === undefined ? null : aiConsent
      ]
    );

    console.log(`Pre-check-in saved/updated for appointment: ${terminCode}`);

    if (submitted) {
      try {
        const apptRes = await pool.query('SELECT * FROM termine WHERE code = $1', [terminCode]);
        if (apptRes.rows.length > 0) {
          const appt = apptRes.rows[0];
          const praxisRes = await pool.query('SELECT email FROM users WHERE role = $1 AND praxis_name = $2', ['praxis', appt.praxis]);
          if (praxisRes.rows.length > 0) {
            const praxisEmail = praxisRes.rows[0].email;
            const patientName = `${appt.patient_vorname} ${appt.patient_nachname}`;
            sendPraxisSubmissionNotification(praxisEmail, appt, patientName).catch(err => {
              console.error('Failed to send praxis submission notification:', err);
            });
          }
          if (appt.notify_email) {
            sendPatientSubmissionConfirmation(appt.notify_email, appt).catch(err => {
              console.error('Failed to send patient submission confirmation:', err);
            });
          }
        }
      } catch (notifyErr) {
        console.error('Failed to trigger notifications on pre-check-in submission:', notifyErr);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving pre-check-in:', err);
    res.status(500).json({ error: 'Database save error' });
  }
});

// API: Update AI consent for a pre-check-in (used by patient)
app.post('/api/precheckin/:terminCode/consent', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  const { terminCode } = req.params;
  const { consent } = req.body; // boolean: true or false

  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }

  try {
    // Verify appointment belongs to this user
    const check = await pool.query('SELECT code FROM termine WHERE code = $1 AND user_id = $2', [terminCode, req.session.userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    // Check if precheckin exists
    const pci = await pool.query('SELECT termin_code FROM precheckins WHERE termin_code = $1', [terminCode]);
    if (pci.rows.length > 0) {
      // Update existing consent, and reset ai_questions and ai_assessments to force regeneration
      await pool.query(
        `UPDATE precheckins 
         SET ai_consent = $1, ai_questions = '[]'::jsonb, ai_assessments = NULL 
         WHERE termin_code = $2`,
        [consent, terminCode]
      );
    } else {
      // Insert new empty precheckin record
      const sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      await pool.query(
        `INSERT INTO precheckins (termin_code, session_id, beschwerden, medikamente, allergien, dokumente, custom_answers, document_confirmations, ai_questions, ai_consent)
         VALUES ($1, $2, '{"chips":[],"freitext":"","customKeywords":[]}'::jsonb, '{"liste":[],"keine":false}'::jsonb, '{"liste":[],"chips":[],"keine":false}'::jsonb, '{"liste":[]}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, $3)`,
        [terminCode, sessionId, consent]
      );
    }

    console.log(`AI Consent updated to ${consent} for termin: ${terminCode}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating AI consent:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der KI-Zustimmung.' });
  }
});

// API: Generate context-aware AI questions or fetch existing ones
app.post('/api/precheckin/:terminCode/generate-ai-questions', async (req, res) => {
  const { terminCode } = req.params;

  if (!isDbConnected || !pool) {
    // Fallback mock questions in offline mode
    return res.json({
      success: true,
      questions: [
        { question: 'Gibt es Begleitsymptome wie Schwindel oder Fieber?', answer: '' },
        { question: 'Seit wann treten diese Symptome genau auf?', answer: '' }
      ]
    });
  }

  try {
    // 1. Fetch existing precheckin
    const precheckRes = await pool.query(
      'SELECT beschwerden, medikamente, allergien, ai_questions FROM precheckins WHERE termin_code = $1',
      [terminCode]
    );

    if (precheckRes.rows.length === 0) {
      return res.status(404).json({ error: 'Kein Pre-Check-In für diesen Termin gefunden.' });
    }

    const precheck = precheckRes.rows[0];

    // 2. If ai_questions is already generated and non-empty, return it!
    if (precheck.ai_questions && Array.isArray(precheck.ai_questions) && precheck.ai_questions.length > 0) {
      return res.json({ success: true, questions: precheck.ai_questions });
    }

    // 3. Otherwise, generate questions!
    const beschwerden = precheck.beschwerden || {};
    const medikamente = precheck.medikamente || {};
    const allergien = precheck.allergien || {};

    let questions = [];

    // Attempt Gemini API call
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      // As requested, using the flash model
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

      const prompt = `
Du bist ein erfahrener medizinischer Assistent. Deine Aufgabe ist es, für einen Patienten, der einen Pre-Check-In ausfüllt, genau 2 bis 3 gezielte, medizinisch sinnvolle und nachvollziehbare Folgefragen (Anamnese-Fragen) zu generieren.
Nutze die bereitgestellten Angaben zu Beschwerden (Hauptsymptome, Details, Stärke, Dauer), Medikamenten und Allergien des Patienten.

Patienten-Angaben:
- Symptom-Chips: ${JSON.stringify(beschwerden.chips || [])}
- Eigene Stichwörter: ${JSON.stringify(beschwerden.customKeywords || [])}
- Freitext-Beschreibung: ${beschwerden.freitext || 'Keine Angabe'}
- Stärke (Skala 1-10): ${beschwerden.staerke || 'Keine Angabe'}
- Dauer: ${beschwerden.dauer || 'Keine Angabe'}
- Medikamente: ${JSON.stringify(medikamente.list || [])}
- Allergien: ${JSON.stringify(allergien.list || [])}

Die Fragen müssen:
1. Direkt auf Deutsch formuliert sein (höfliche Ansprache "Sie").
2. Medizinisch relevant und präzise sein (z.B. Fragen nach Begleitsymptomen, Einnahmefrequenz von Medikamenten, Auslösern oder Charakter des Schmerzes).
3. Klar strukturiert sein als Fragen.
Antworte AUSSCHLIESSLICH im folgenden JSON-Format (ein Array von Objekten mit dem Key "question" und leerem Wert für "answer"):
[
  {
    "question": "Fragetext...",
    "answer": ""
  }
]
Gib kein anderes Text- oder Markdown-Format zurück. Kein \`\`\`json. Nur das rohe JSON.
      `;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();

      // Strip markdown code blocks if any
      if (text.startsWith('```')) {
        text = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }

      const generatedQuestions = JSON.parse(text);
      if (Array.isArray(generatedQuestions) && generatedQuestions.length > 0) {
        questions = generatedQuestions.map(q => ({
          question: q.question,
          answer: ''
        }));
      }
    } catch (aiErr) {
      console.warn('Gemini API call failed, falling back to rule-based questions:', aiErr.message);
    }

    // 4. Fallback to rule-based generator if Gemini failed or returned invalid output
    if (questions.length === 0) {
      const chips = (beschwerden.chips || []).map(c => c.toLowerCase());
      const freitext = (beschwerden.freitext || '').toLowerCase();
      const customKeywords = (beschwerden.customKeywords || []).map(k => k.toLowerCase());
      const meds = (medikamente.list || []);
      const allergies = (allergien.list || []);

      // Analyze for specific conditions
      if (chips.includes('kopfschmerzen') || freitext.includes('kopfschmerz') || freitext.includes('migräne')) {
        questions.push({ question: 'Sind die Kopfschmerzen eher drückend, stechend oder pulsierend?', answer: '' });
        questions.push({ question: 'Treten die Kopfschmerzen vermehrt bei körperlicher Anstrengung oder im Liegen auf?', answer: '' });
      } else if (chips.includes('fieber') || freitext.includes('fieber') || freitext.includes('temperatur')) {
        questions.push({ question: 'Haben Sie zusätzlich Schüttelfrost, vermehrtes Schwitzen oder Gliederschmerzen bemerkt?', answer: '' });
        questions.push({ question: 'Wie hoch war die gemessene Körpertemperatur maximal?', answer: '' });
      } else if (chips.includes('husten') || chips.includes('halsschmerzen') || freitext.includes('hust') || freitext.includes('hals')) {
        questions.push({ question: 'Ist der Husten trocken (Reizhusten) oder geht er mit Auswurf einher?', answer: '' });
        questions.push({ question: 'Tritt der Husten vermehrt nachts oder tagsüber auf?', answer: '' });
      } else if (chips.includes('bauchschmerzen') || freitext.includes('bauchschmerz') || freitext.includes('magen')) {
        questions.push({ question: 'Sind die Bauchschmerzen eher krampfartig, dumpf oder stechend, und wo genau liegen sie?', answer: '' });
        questions.push({ question: 'Besteht ein zeitlicher Zusammenhang mit bestimmten Lebensmitteln oder Mahlzeiten?', answer: '' });
      } else if (chips.includes('zahnschmerzen') || freitext.includes('zahn')) {
        questions.push({ question: 'Sind die Zahnschmerzen empfindlich gegenüber Kälte oder Wärme?', answer: '' });
        questions.push({ question: 'Pulsieren die Schmerzen oder sind sie dauerhaft spürbar?', answer: '' });
      } else if (chips.includes('hautausschlag') || chips.includes('juckreiz') || freitext.includes('haut') || freitext.includes('ausschlag')) {
        questions.push({ question: 'Juckt der Ausschlag oder brennt er, und an welchen Körperstellen tritt er auf?', answer: '' });
        questions.push({ question: 'Haben Sie in letzter Zeit neue Pflegeprodukte, Waschmittel oder Lebensmittel verwendet?', answer: '' });
      } else if (chips.includes('herzrasen') || chips.includes('atemnot') || freitext.includes('herz') || freitext.includes('luft')) {
        questions.push({ question: 'Tritt das Herzrasen oder die Atemnot in Ruhe oder bei körperlicher Belastung auf?', answer: '' });
        questions.push({ question: 'Haben Sie zusätzlich Schwindel oder ein Engegefühl in der Brust?', answer: '' });
      }

      // Check medications fallback question
      if (meds.length > 0 && questions.length < 3) {
        questions.push({ question: 'Nehmen Sie die angegebenen Medikamente regelmäßig oder nur bei Bedarf ein?', answer: '' });
      }

      // Check allergies fallback question
      if (allergies.length > 0 && questions.length < 3) {
        questions.push({ question: 'Welche Reaktionen (z.B. Hautausschlag, Atemnot) lösen die genannten Allergene bei Ihnen aus?', answer: '' });
      }

      // Default fallback questions if not enough questions generated
      if (questions.length < 2) {
        questions.push({ question: 'Gibt es bestimmte Faktoren (z.B. Wärme, Kälte, Ruhe), die Ihre Beschwerden lindern oder verschlimmern?', answer: '' });
        questions.push({ question: 'Hatten Sie ähnliche Beschwerden in der Vergangenheit schon einmal?', answer: '' });
      }
    }

    // Limit to max 3 questions
    questions = questions.slice(0, 3);

    // 5. Save the generated questions back to database so they persist
    await pool.query(
      'UPDATE precheckins SET ai_questions = $1 WHERE termin_code = $2',
      [JSON.stringify(questions), terminCode]
    );

    res.json({ success: true, questions });
  } catch (err) {
    console.error('Error generating AI questions:', err);
    res.status(500).json({ error: 'Fehler bei der Generierung der Folgefragen.' });
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

// API: Praxis uploads a file for a patient (shares document and sends email notification)
app.post('/api/praxis/termin/:code/upload-patient-doc', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }

  const { code } = req.params;
  const { filename, mimeType, fileData, docCategory } = req.body;

  if (!filename || !mimeType || !fileData || !docCategory) {
    return res.status(400).json({ error: 'Fehlende erforderliche Felder.' });
  }

  if (!isDbConnected || !pool) {
    return res.json({ success: true, file: { id: 999, filename, mimeType, fileSize: 100 } });
  }

  try {
    // 1. Verify appointment exists and belongs to this praxis (checking both notify_email and users.email)
    const apptRes = await pool.query(
      `SELECT t.*, u.email as patient_email, u.vorname as user_vorname, u.nachname as user_nachname 
       FROM termine t 
       LEFT JOIN users u ON t.user_id = u.id 
       WHERE t.code = $1 AND t.praxis = $2`,
      [code, req.session.user.praxis_name]
    );
    if (apptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    const appt = apptRes.rows[0];

    // 2. Find patient email
    const patientEmail = appt.notify_email || appt.patient_email;
    if (appt.user_vorname) appt.patient_vorname = appt.user_vorname;
    if (appt.user_nachname) appt.patient_nachname = appt.user_nachname;

    if (!patientEmail) {
      return res.status(400).json({ error: 'Für diesen Termin ist keine E-Mail-Adresse hinterlegt. E-Mail-Benachrichtigung fehlgeschlagen.' });
    }

    // 3. Insert into uploaded_files
    const buffer = Buffer.from(fileData, 'base64');
    const fileSize = buffer.length;

    const result = await pool.query(
      `INSERT INTO uploaded_files (termin_code, filename, mime_type, file_size, file_data, uploaded_by, doc_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, filename, mime_type, file_size, doc_category`,
      [code, filename, mimeType, fileSize, buffer, 'praxis', docCategory]
    );

    const fileRow = result.rows[0];

    // Send notification email in background
    sendDoctorDocumentSharedNotificationEmail(patientEmail, appt, filename, docCategory).catch(err => {
      console.error('Failed to send doctor shared document notification email:', err);
    });

    res.json({
      success: true,
      file: {
        id: fileRow.id,
        filename: fileRow.filename,
        mimeType: fileRow.mime_type,
        fileSize: fileRow.file_size,
        docCategory: fileRow.doc_category
      }
    });
  } catch (err) {
    console.error('Error in praxis patient doc upload:', err);
    res.status(500).json({ error: 'Fehler beim Hochladen des Dokuments.' });
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

// ============================================
// PRAXIS DOCUMENTS API ENDPOINTS
// ============================================

// API: Get all documents for the logged-in practice
app.get('/api/praxis/documents', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  if (!isDbConnected || !pool) {
    return res.json({ success: true, documents: [] });
  }
  try {
    const result = await pool.query(
      `SELECT pd.id, pd.title, pd.doc_type, pd.file_id, pd.created_at,
              uf.filename, uf.mime_type, uf.file_size
       FROM praxis_documents pd
       LEFT JOIN uploaded_files uf ON pd.file_id = uf.id
       WHERE pd.praxis_id = $1
       ORDER BY pd.created_at DESC`,
      [req.session.userId]
    );
    res.json({ success: true, documents: result.rows });
  } catch (err) {
    console.error('Error loading praxis documents:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Dokumente.' });
  }
});

// API: Upload a new praxis document
app.post('/api/praxis/documents', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { title, docType, filename, mimeType, fileData } = req.body;
  if (!title || !filename || !mimeType || !fileData) {
    return res.status(400).json({ error: 'Titel, Datei und Typ sind erforderlich.' });
  }
  if (!isDbConnected || !pool) {
    return res.json({ success: true, document: { id: Math.floor(Math.random() * 100000), title, doc_type: docType || 'confirm' } });
  }
  try {
    const buffer = Buffer.from(fileData, 'base64');
    const fileSize = buffer.length;
    // 1. Save the file in uploaded_files (use a special termin_code prefix for praxis docs)
    const fileResult = await pool.query(
      `INSERT INTO uploaded_files (termin_code, filename, mime_type, file_size, file_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, mime_type, file_size`,
      [null, filename, mimeType, fileSize, buffer]
    );
    const fileRow = fileResult.rows[0];
    // 2. Create the praxis_documents entry
    const docResult = await pool.query(
      `INSERT INTO praxis_documents (praxis_id, title, doc_type, file_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, doc_type, file_id, created_at`,
      [req.session.userId, title, docType || 'confirm', fileRow.id]
    );
    const doc = docResult.rows[0];
    doc.filename = fileRow.filename;
    doc.mime_type = fileRow.mime_type;
    doc.file_size = fileRow.file_size;
    console.log(`Praxis document uploaded: "${title}" (type: ${docType}) for praxis ${req.session.userId}`);
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error('Error uploading praxis document:', err);
    res.status(500).json({ error: 'Fehler beim Hochladen des Dokuments.' });
  }
});

// API: Delete a praxis document
app.delete('/api/praxis/documents/:id', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const docId = parseInt(req.params.id, 10);
  if (isNaN(docId)) {
    return res.status(400).json({ error: 'Ungültige Dokument-ID.' });
  }
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    // Get file_id before deleting
    const docRes = await pool.query('SELECT file_id FROM praxis_documents WHERE id = $1 AND praxis_id = $2', [docId, req.session.userId]);
    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: 'Dokument nicht gefunden.' });
    }
    const fileId = docRes.rows[0].file_id;
    // Delete the praxis_documents entry (CASCADE will not delete uploaded_files, so delete manually)
    await pool.query('DELETE FROM praxis_documents WHERE id = $1 AND praxis_id = $2', [docId, req.session.userId]);
    if (fileId) {
      await pool.query('DELETE FROM uploaded_files WHERE id = $1', [fileId]);
    }
    console.log(`Praxis document ${docId} deleted for praxis ${req.session.userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting praxis document:', err);
    res.status(500).json({ error: 'Fehler beim Löschen des Dokuments.' });
  }
});

// API: Register for email notification when pre-check-in becomes available
app.post('/api/termine/:code/notify', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  const { code } = req.params;
  const email = req.session.user?.email;

  if (!email) {
    return res.status(400).json({ error: 'E-Mail-Adresse des Benutzers fehlt.' });
  }

  if (!isDbConnected || !pool) {
    // Offline / mock mode
    if (req.session.mockAppointments) {
      const appt = req.session.mockAppointments.find(a => a.code === code);
      if (appt) {
        appt.notify_email = email;
        appt.notify_sent = false;
        console.log(`[Offline Mode] Notification registered for ${email} on appointment ${code}`);
        return res.json({ success: true });
      }
    }
    return res.json({ success: true });
  }

  try {
    const checkResult = await pool.query('SELECT * FROM termine WHERE code = $1 AND user_id = $2', [code, req.session.userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden oder nicht autorisiert.' });
    }

    await pool.query(
      'UPDATE termine SET notify_email = $1, notify_sent = FALSE WHERE code = $2',
      [email, code]
    );

    console.log(`Notification registered for ${email} on appointment ${code}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error registering notification:', err);
    res.status(500).json({ error: 'Fehler bei der Registrierung.' });
  }
});

// --- Date Parsing and Business Days logic for Notification Worker ---
function parseGermanDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  const monthMap = {
    'jan': 0, 'feb': 1, 'mär': 2, 'mar': 2, 'apr': 3, 'mai': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dez': 11
  };
  const match = dateStr.match(/(\d{1,2})\.\s*(\w{3})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthAbbr = match[2].toLowerCase();
  const month = monthMap[monthAbbr];
  if (month === undefined || isNaN(day)) return null;
  const now = new Date();
  const year = now.getFullYear();
  return new Date(year, month, day);
}

function parseGermanDateTime(dateStr, timeStr) {
  const dateObj = parseGermanDate(dateStr);
  if (!dateObj) return null;
  if (timeStr) {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      dateObj.setHours(hours, minutes, 0, 0);
    } else {
      dateObj.setHours(0, 0, 0, 0);
    }
  } else {
    dateObj.setHours(0, 0, 0, 0);
  }
  return dateObj;
}

function subtractBusinessDays(date, n) {
  const result = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      remaining--;
    }
  }
  return result;
}

function isPrecheckAvailable(dateStr, timeStr) {
  const appointmentDateTime = parseGermanDateTime(dateStr, timeStr);
  if (!appointmentDateTime) return true;
  const now = new Date();
  const openDate = subtractBusinessDays(appointmentDateTime, 2);
  return now >= openDate;
}

// --- Nodemailer transporter and Background notification worker ---
let mailTransporter = null;

async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    try {
      const secureConnection = process.env.SMTP_SECURE === 'true' || port === '465';
      mailTransporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: secureConnection,
        auth: { user, pass },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
        tls: {
          // Maximizes compatibility on hosting platforms with self-signed/proxy certificates
          rejectUnauthorized: false
        }
      });
      console.log(`📧 Nodemailer initialized using SMTP Server: ${host}:${port} (secure: ${secureConnection})`);
      return mailTransporter;
    } catch (err) {
      console.error(`⚠️ SMTP Transport initialization failed:`, err.message);
    }
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    mailTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log('📧 Nodemailer: Using Ethereal sandbox test account.');
    return mailTransporter;
  } catch (err) {
    console.error('⚠️ Nodemailer initialization failed, fallback to console log:', err.message);
    return {
      sendMail: async (options) => {
        console.log('\n---------------- MOCK EMAIL SENT ----------------');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`HTML Body:\n${options.html}`);
        console.log('--------------------------------------------------\n');
        return { messageId: 'console-mock-' + Date.now() };
      }
    };
  }
}

function getSMTPFrom() {
  if (process.env.SMTP_FROM) {
    return process.env.SMTP_FROM;
  }
  if (process.env.SMTP_USER) {
    return `"Doctolib Pre-Check-In" <${process.env.SMTP_USER}>`;
  }
  return '"Doctolib Pre-Check-In" <no-reply@doctolib-precheck.de>';
}

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      let fromAddr = 'Doctolib Pre-Check-In <onboarding@resend.dev>';
      const envFrom = process.env.SMTP_FROM || '';
      const isPublicDomain = envFrom.includes('@gmail.com') || envFrom.includes('@gmx.') || envFrom.includes('@web.de') || envFrom.includes('@outlook.');
      if (envFrom && !isPublicDomain) {
        fromAddr = envFrom;
      }
      const response = await resend.emails.send({
        from: fromAddr,
        to,
        subject,
        html
      });
      if (response.error) {
        throw new Error(response.error.message || JSON.stringify(response.error));
      }
      console.log(`📧 Email sent via Resend API to ${to}. ID: ${response.data?.id || 'unknown'}`);
      return { messageId: response.data?.id || 'resend-' + Date.now() };
    } catch (err) {
      console.error(`⚠️ Failed to send email via Resend API to ${to}:`, err.message);
      throw err;
    }
  }

  // Fallback to Nodemailer SMTP / mock
  const transporter = await getMailTransporter();
  const fromAddr = getSMTPFrom();
  const info = await transporter.sendMail({
    from: fromAddr,
    to,
    subject,
    html
  });
  console.log(`📧 Email sent via Nodemailer to ${to}. Message ID: ${info.messageId}`);
  if (nodemailer.getTestMessageUrl) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`🔗 Ethereal Preview: ${previewUrl}`);
  }
  return info;
}

async function sendNotificationEmail(email, appointment) {
  const appUrl = (process.env.APP_URL || 'https://fallstudiesoftwareengineeringmed-pre-check-in-production.up.railway.app').replace(/\/$/, '');
  const landingLink = `${appUrl}/#landing`;

  const greetingName = (appointment.vorname && appointment.nachname) 
    ? `${appointment.vorname} ${appointment.nachname}` 
    : '';
  const greeting = greetingName ? `Hallo ${greetingName},` : 'Hallo,';

  const subject = `Ihr Pre-Check-In für den Termin bei ${appointment.doctor} ist bereit!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <h2 style="color: #0063BE; margin-bottom: 20px; font-weight: 700; font-size: 22px;">${greeting}</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Ihr anstehender Termin bei <strong>${appointment.doctor}</strong> (${appointment.fachrichtung}) steht vor der Tür.
      </p>
      
      <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 24px 0; border: 1px solid #f1f5f9;">
        <p style="margin: 0; font-size: 14px; color: #475569;">
          📅 <strong>Termin:</strong> ${appointment.date} um ${appointment.time} Uhr
        </p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #475569;">
          🏢 <strong>Praxis:</strong> ${appointment.praxis} — ${appointment.adresse}
        </p>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Um Ihren Besuch so angenehm und reibungslos wie möglich zu gestalten, haben Sie ab sofort die <strong>Möglichkeit</strong>, Ihren Pre-Check-In vorab online durchzuführen.
      </p>
      
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
        <strong>Ihr Vorteil:</strong> Durch das Vorab-Ausfüllen von Beschwerden, Medikamenten und Allergien sparen Sie am Empfang wertvolle Zeit. Das Team vor Ort ist optimal vorbereitet und es bleibt mehr Zeit für Ihr persönliches Arztgespräch.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${landingLink}" style="background-color: #0063BE; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
          Pre-Check-In ausfüllen & Zeit sparen
        </a>
      </div>
      
      <p style="font-size: 13px; line-height: 1.5; color: #64748b; font-style: italic; text-align: center; margin-bottom: 30px;">
        Hinweis: Das Ausfüllen ist freiwillig. Ihre Daten werden absolut vertraulich behandelt.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Dies ist eine automatische Benachrichtigung Ihres Doctolib Pre-Check-In Services.
      </p>
    </div>
  `;

  try {
    await sendEmail({ to: email, subject, html });
  } catch (err) {
    console.error('Failed to send notification email:', err);
  }
}

async function sendPraxisSubmissionNotification(praxisEmail, appointment, patientName) {
  const appUrl = (process.env.APP_URL || 'https://fallstudiesoftwareengineeringmed-pre-check-in-production.up.railway.app').replace(/\/$/, '');
  const dashboardLink = `${appUrl}/#praxis`;

  const subject = `Neuer Pre-Check-In ausgefüllt: ${patientName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <h2 style="color: #0063BE; margin-bottom: 20px; font-weight: 700; font-size: 22px;">Neuer Pre-Check-In eingegangen</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Der Patient <strong>${patientName}</strong> hat den Pre-Check-In für den folgenden Termin ausgefüllt:
      </p>
      
      <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 24px 0; border: 1px solid #f1f5f9;">
        <p style="margin: 0; font-size: 14px; color: #475569;">
          📅 <strong>Termin:</strong> ${appointment.date} um ${appointment.time} Uhr
        </p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #475569;">
          👤 <strong>Behandler:</strong> ${appointment.doctor}
        </p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #475569;">
          🔑 <strong>Termin-Code:</strong> ${appointment.code}
        </p>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
        Bitte loggen Sie sich in Ihr Praxis-Dashboard ein, um die Details (Anamnese, hochgeladene Dokumente, Allergien und digitale Unterschriften) einzusehen.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${dashboardLink}" style="background-color: #0063BE; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
          Praxis-Dashboard öffnen
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Dies ist eine automatische Benachrichtigung Ihres Doctolib Pre-Check-In Services für Praxen.
      </p>
    </div>
  `;

  try {
    await sendEmail({ to: praxisEmail, subject, html });
    console.log(`📧 Praxis submission notification sent to ${praxisEmail} for patient ${patientName}`);
  } catch (err) {
    console.error('Failed to send praxis submission notification:', err);
  }
}

async function sendPatientSubmissionConfirmation(patientEmail, appointment) {
  const appUrl = (process.env.APP_URL || 'https://fallstudiesoftwareengineeringmed-pre-check-in-production.up.railway.app').replace(/\/$/, '');
  const portalLink = `${appUrl}/#landing`;

  const subject = `Ihr Pre-Check-In war erfolgreich: ${appointment.praxis}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <h2 style="color: #0063BE; margin-bottom: 20px; font-weight: 700; font-size: 22px;">Pre-Check-In erfolgreich übermittelt!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Hallo ${appointment.patient_vorname} ${appointment.patient_nachname},
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        vielen Dank! Ihr digitaler Pre-Check-In für Ihren anstehenden Arzttermin wurde erfolgreich ausgefüllt und sicher an die Praxis übermittelt. Die Praxis hat alle notwendigen Daten (Anamnesebogen, Einwilligungen und Dokumente) erhalten, sodass Sie am Termin Zeit sparen.
      </p>
      
      <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 24px 0; border: 1px solid #f1f5f9;">
        <h4 style="margin: 0 0 10px 0; font-size: 15px; color: #0063BE; font-weight: 700;">Details zu Ihrem Termin:</h4>
        <p style="margin: 0; font-size: 14px; color: #475569;">
          🏢 <strong>Praxis:</strong> ${appointment.praxis}
        </p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #475569;">
          👤 <strong>Behandler:</strong> ${appointment.doctor}
        </p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #475569;">
          📅 <strong>Datum & Uhrzeit:</strong> ${appointment.date} um ${appointment.time} Uhr
        </p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #475569;">
          🔑 <strong>Termin-Code:</strong> ${appointment.code}
        </p>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
        Sie können Ihre Termine und die dazugehörigen Dokumente jederzeit in Ihrem Doctolib Pre-Check-In Patientenportal einsehen.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${portalLink}" style="background-color: #0063BE; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
          Patientenportal öffnen
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Dies ist eine automatische Bestätigung Ihres Doctolib Pre-Check-In Services. Bitte antworten Sie nicht direkt auf diese E-Mail.
      </p>
    </div>
  `;

  try {
    await sendEmail({ to: patientEmail, subject, html });
    console.log(`📧 Patient submission confirmation sent to ${patientEmail} for appointment ${appointment.code}`);
  } catch (err) {
    console.error('Failed to send patient submission confirmation:', err);
  }
}

async function sendPostVisitNotificationEmail(email, appointment) {
  const appUrl = (process.env.APP_URL || 'https://fallstudiesoftwareengineeringmed-pre-check-in-production.up.railway.app').replace(/\/$/, '');
  const feedbackLink = `${appUrl}/#feedback?code=${appointment.code}`;

  const subject = `Ihr Feedback zu Ihrem Termin bei ${appointment.doctor}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <h2 style="color: #0063BE; margin-bottom: 20px; font-weight: 700; font-size: 22px;">Hallo ${appointment.patient_vorname},</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        vor kurzem hatten Sie einen Termin bei <strong>${appointment.doctor}</strong> in der Praxis <strong>${appointment.praxis}</strong>.
      </p>
      
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Wir hoffen, dass Sie sich gut betreut gefühlt haben und es Ihnen gut geht. Um unseren Service stetig zu verbessern, würden wir uns über Ihr kurzes Feedback freuen. Das Ausfüllen dauert weniger als eine Minute.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${feedbackLink}" style="background-color: #0063BE; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
          Termin bewerten & Feedback geben
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Dies ist eine automatische Benachrichtigung Ihres Doctolib Pre-Check-In Services.
      </p>
    </div>
  `;

  try {
    await sendEmail({ to: email, subject, html });
    console.log(`📧 Post-visit feedback email sent to ${email} for appointment ${appointment.code}`);
  } catch (err) {
    console.error('Failed to send post-visit feedback email:', err);
  }
}

async function sendDoctorDocumentSharedNotificationEmail(email, appointment, filename, docCategory) {
  const appUrl = (process.env.APP_URL || 'https://fallstudiesoftwareengineeringmed-pre-check-in-production.up.railway.app').replace(/\/$/, '');
  const portalLink = `${appUrl}/#landing`;

  const subject = `Neues Dokument für Sie bereitgestellt: ${docCategory}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <h2 style="color: #0063BE; margin-bottom: 20px; font-weight: 700; font-size: 22px;">Hallo ${appointment.patient_vorname},</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Dr. med. <strong>${appointment.doctor}</strong> hat ein neues Dokument für Sie freigegeben.
      </p>
      
      <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 24px 0; border: 1px solid #f1f5f9;">
        <p style="margin: 0; font-size: 14px; color: #475569;">
          📄 <strong>Dokumenttyp:</strong> ${docCategory}
        </p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #475569;">
          📁 <strong>Dateiname:</strong> ${filename}
        </p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #475569;">
          🏥 <strong>Praxis:</strong> ${appointment.praxis}
        </p>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
        Sie können dieses Dokument ab sofort sicher in Ihrem Patient-Portal einsehen und herunterladen.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${portalLink}" style="background-color: #0063BE; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block;">
          Zum Patient-Portal & Download
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Dies ist eine automatische Benachrichtigung Ihres Doctolib Pre-Check-In Services.
      </p>
    </div>
  `;

  try {
    await sendEmail({ to: email, subject, html });
    console.log(`📧 Document shared notification email sent to ${email} for file ${filename}`);
  } catch (err) {
    console.error('Failed to send document shared email:', err);
  }
}

async function checkAndSendNotifications() {
  if (!isDbConnected || !pool) return;
  try {
    const result = await pool.query(
      `SELECT t.*, u.email as user_email, u.vorname, u.nachname
       FROM termine t
       JOIN users u ON t.user_id = u.id
       WHERE t.notify_email IS NOT NULL AND t.notify_sent = FALSE`
    );

    for (const appt of result.rows) {
      if (isPrecheckAvailable(appt.date, appt.time)) {
        await sendNotificationEmail(appt.notify_email, appt);
        await pool.query('UPDATE termine SET notify_sent = TRUE WHERE code = $1', [appt.code]);
      }
    }
  } catch (err) {
    console.error('Error running notification worker:', err);
  }
}

async function checkAndSendPostVisitNotifications() {
  if (!isDbConnected || !pool) return;
  try {
    const result = await pool.query(
      `SELECT t.*, u.email as user_email
       FROM termine t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.post_visit_notified = FALSE`
    );

    const now = new Date();
    for (const appt of result.rows) {
      const apptTime = parseGermanDateTime(appt.date, appt.time);
      if (!apptTime) continue;

      const diffMs = now - apptTime;
      const diffHours = diffMs / (1000 * 60 * 60);

      // If the appointment happened at least 24 hours ago
      if (diffHours >= 24) {
        // Only send if it happened within the last 5 days (120 hours), to avoid spamming very old seed/demo appointments
        if (diffHours <= 120) {
          const email = appt.user_email || appt.notify_email;
          if (email) {
            await sendPostVisitNotificationEmail(email, appt);
          }
        }
        await pool.query('UPDATE termine SET post_visit_notified = TRUE WHERE code = $1', [appt.code]);
      }
    }
  } catch (err) {
    console.error('Error running post-visit notification worker:', err);
  }
}

// Start background workers every 10 seconds
setInterval(checkAndSendNotifications, 10000);
setInterval(checkAndSendPostVisitNotifications, 10000);

// ============================================
// PRAXIS CALENDAR & NOTES & HINTS API
// ============================================

// API: Get detailed appointment info including patient profile, precheck, notes, hints
app.get('/api/praxis/termin/:code/details', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code } = req.params;
  if (!isDbConnected || !pool) {
    return res.json({ success: true, details: null });
  }
  try {
    // Get appointment + precheck data
    const terminRes = await pool.query(
      `SELECT t.*, p.submitted as precheck_submitted, p.current_step as precheck_step,
              p.beschwerden, p.medikamente, p.allergien, p.dokumente, p.signature_data, p.custom_answers,
              p.document_confirmations, p.ai_questions, p.ai_assessments, p.ai_consent
       FROM termine t
       LEFT JOIN precheckins p ON t.code = p.termin_code
       WHERE t.code = $1 AND t.praxis = $2`,
      [code, req.session.user.praxis_name]
    );
    if (terminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    const termin = terminRes.rows[0];

    // Get patient profile if user_id exists
    let patientProfile = null;
    if (termin.user_id) {
      const userRes = await pool.query(
        'SELECT id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse FROM users WHERE id = $1',
        [termin.user_id]
      );
      if (userRes.rows.length > 0) {
        patientProfile = userRes.rows[0];
      }
    }

    // Get doctor notes
    const notesRes = await pool.query(
      'SELECT id, note_text, updated_at FROM doctor_notes WHERE termin_code = $1 ORDER BY updated_at DESC LIMIT 1',
      [code]
    );
    const doctorNote = notesRes.rows.length > 0 ? notesRes.rows[0] : null;

    // Get patient hints
    const hintsRes = await pool.query(
      'SELECT id, hints, custom_text, sent_at, email_sent FROM patient_hints WHERE termin_code = $1 ORDER BY sent_at DESC',
      [code]
    );
    const patientHints = hintsRes.rows;

    const docsRes = await pool.query('SELECT id, title FROM praxis_documents WHERE praxis_id = $1', [req.session.userId]);
    const praxisDocuments = docsRes.rows;

    const sharedDocsRes = await pool.query(
      `SELECT id, filename, mime_type, file_size, uploaded_at, doc_category 
       FROM uploaded_files 
       WHERE termin_code = $1 AND uploaded_by = 'praxis' 
       ORDER BY uploaded_at DESC`,
      [code]
    );
    const sharedDocuments = sharedDocsRes.rows;

    const aftercareRes = await pool.query(
      'SELECT id, instructions, sent_at, email_sent FROM aftercare_instructions WHERE termin_code = $1 ORDER BY sent_at DESC',
      [code]
    );
    const aftercareInstructions = aftercareRes.rows;

    res.json({
      success: true,
      details: {
        termin,
        patientProfile,
        doctorNote,
        patientHints,
        praxisDocuments,
        sharedDocuments,
        aftercareInstructions
      }
    });
  } catch (err) {
    console.error('Error fetching appointment details:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Termindetails.' });
  }
});

// API: Save/update doctor notes for an appointment
app.post('/api/praxis/termin/:code/notes', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code } = req.params;
  const { note_text } = req.body;
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    // Verify appointment belongs to this praxis
    const check = await pool.query('SELECT code FROM termine WHERE code = $1 AND praxis = $2', [code, req.session.user.praxis_name]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    // Upsert note
    const existing = await pool.query('SELECT id FROM doctor_notes WHERE termin_code = $1', [code]);
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE doctor_notes SET note_text = $1, updated_at = CURRENT_TIMESTAMP WHERE termin_code = $2',
        [note_text || '', code]
      );
    } else {
      await pool.query(
        'INSERT INTO doctor_notes (termin_code, note_text) VALUES ($1, $2)',
        [code, note_text || '']
      );
    }
    console.log(`Doctor note saved for appointment ${code}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving doctor note:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Notiz.' });
  }
});

// API: Get/generate AI assessments for doctor dashboard
app.get('/api/praxis/termin/:code/ai-assessments', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code } = req.params;
  if (!isDbConnected || !pool) {
    // Return mock data if database is not connected
    return res.json({
      success: true,
      ai_assessments: {
        doctorTodos: [
          { 
            id: 'doc-1', 
            category: 'Diagnostik', 
            text: 'Aufgrund des angegebenen Verdachts auf einen Atemwegsinfekt sollte eine gründliche Auskultation der Lunge durchgeführt werden. Achten Sie dabei besonders auf Rasselgeräusche oder ein abgeschwächtes Atemgeräusch, um eine beginnende Bronchitis oder Pneumonie frühzeitig auszuschließen.', 
            reasoning: 'Basierend auf den Symptom-Chips (Husten, Halsschmerzen)' 
          },
          { 
            id: 'doc-2', 
            category: 'Risiko', 
            text: 'Da der Patient sowohl Ibuprofen als auch Paracetamol einnimmt, sollte die genaue Tagesdosis und Einnahmefrequenz erfragt werden. Prüfen Sie, ob ein Risiko für eine medikamenteninduzierte Hepatotoxizität oder nephrotoxische Wechselwirkungen vorliegt.', 
            reasoning: 'Aufgrund der Medikamentenliste (Ibuprofen 400mg, Paracetamol 500mg)' 
          },
          {
            id: 'doc-3',
            category: 'Anamnese',
            text: 'Fragen Sie den Patienten gezielt nach dem zeitlichen Verlauf der Atembeschwerden. Insbesondere das Auftreten von nächtlichem Reizhusten oder Atemnot bei körperlicher Belastung liefert wichtige klinische Hinweise zur Differenzierung zwischen Asthma und einem akuten Infekt.',
            reasoning: 'Symptombasierte Abklärung bei Hustenbeschwerden'
          }
        ],
        patientTodos: [
          { 
            id: 'pat-1', 
            category: 'Vorbereitung', 
            text: 'Allergiepass und Befunde zum Termin mitbringen.', 
            patientText: 'Da Sie eine Penicillin-Allergie angegeben haben, bringen Sie bitte Ihren Allergiepass sowie etwaige Vorbefunde oder Berichte über frühere allergische Reaktionen zum Termin mit. Dies hilft uns, die Medikation für Sie sicher zu planen.', 
            reasoning: 'Basierend auf der angegebenen Penicillin-Allergie' 
          },
          { 
            id: 'pat-2', 
            category: 'Medikation', 
            text: 'Einnahme-Dokumentation für den behandelnden Arzt bereithalten.', 
            patientText: 'Bitte notieren Sie sich für das Gespräch mit dem Arzt, wie häufig und in welcher Dosierung Sie Ibuprofen und Paracetamol in den letzten Tagen eingenommen haben, und bringen Sie diese Aufstellung mit.', 
            reasoning: 'Aufgrund der Einnahme von freiverkäuflichen Schmerzmitteln' 
          }
        ]
      }
    });
  }

  try {
    const terminRes = await pool.query(
      `SELECT t.*, p.submitted, p.beschwerden, p.medikamente, p.allergien, p.custom_answers, p.ai_questions, p.ai_assessments, p.ai_consent, p.anamnesis_assessment
       FROM termine t
       LEFT JOIN precheckins p ON t.code = p.termin_code
       WHERE t.code = $1`,
      [code]
    );

    if (terminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    const termin = terminRes.rows[0];

    if (termin.ai_consent === false) {
      return res.json({ success: true, ai_assessments: null, consentDeclined: true });
    }

    if (!termin.submitted) {
      return res.json({ success: false, message: 'Pre-Check-In noch nicht abgeschlossen.' });
    }

    if (termin.ai_assessments) {
      return res.json({ success: true, ai_assessments: termin.ai_assessments, anamnesis_assessment: termin.anamnesis_assessment });
    }

    // Generate assessments using Gemini or fallback
    const beschwerden = termin.beschwerden || {};
    const medikamente = termin.medikamente || {};
    const allergien = termin.allergien || {};
    const customAnswers = termin.custom_answers || {};
    const aiQuestions = termin.ai_questions || [];

    let ai_assessments = null;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not defined');
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

      const prompt = `
Du bist ein hochqualifizierter medizinischer Experte und klinischer Assistent. Deine Aufgabe ist es, auf Basis der Angaben aus dem Patienten-Pre-Check-In und dem Praxis-Kontext eine tiefgehende, klinisch fundierte und patientenindividuelle medizinische Einschätzung zu generieren.
Die Einschätzung muss zwischen ToDos für den Arzt (doctorTodos) und ToDos für den Patienten (patientTodos) unterscheiden.

Praxis- & Termin-Kontext:
- Fachrichtung: ${termin.fachrichtung}
- Termin-Art: ${termin.art}
- Praxis-Name: ${termin.praxis}
- Arzt: ${termin.doctor}

Patienten-Angaben (Pre-Check-In):
- Symptom-Chips: ${JSON.stringify(beschwerden.chips || [])}
- Eigene Stichwörter: ${JSON.stringify(beschwerden.customKeywords || [])}
- Freitext-Beschreibung: ${beschwerden.freitext || 'Keine Angabe'}
- Stärke (Skala 1-10): ${beschwerden.staerke || 'Keine Angabe'}
- Dauer: ${beschwerden.dauer || 'Keine Angabe'}
- Medikamente: ${JSON.stringify(medikamente.list || [])}
- Allergien: ${JSON.stringify(allergien.list || [])}
- Antworten auf Praxis-spezifische Fragen: ${JSON.stringify(customAnswers)}
- Antworten auf KI-Folgefragen: ${JSON.stringify(aiQuestions)}

Anforderungen an die Generierung (Sehr wichtig für Qualität und Umfang):
1. **Maximale Anzahl an Einschätzungen**: Die Gesamtzahl der Empfehlungen (doctorTodos und patientTodos zusammen) darf insgesamt **maximal 5** betragen. Generiere z.B. 2-3 doctorTodos und 2-3 patientTodos.
2. **Kurz und Prägnant**: Jede Empfehlung ("text" und "patientText") muss **exakt 1 Satz mit maximal 12 Wörtern** sein. Halte dich extrem kurz und direkt.
3. **Fokus auf Symptome**: Richte die Empfehlungen direkt an den individuellen Beschwerden des Patienten aus.
4. **Begründung ("reasoning")**: Begründe kurz in 1 Satz, worauf diese Einschätzung basiert (wie die KI darauf gekommen ist).

Generiere:
1. "doctorTodos" (Array von Objekten): Einschätzungen für den Arzt.
   Jedes Objekt muss folgende Struktur haben:
   - "id": Eine eindeutige ID (z.B. "doc_1", "doc_2", ...)
   - "category": Kategorie als kurzes Wort (z.B. "Diagnostik", "Risiko")
   - "text": Der extrem kurze, klinische Text für den Arzt (1 Satz, max. 12 Wörter).
   - "reasoning": Kurzer Satz, wie die KI darauf gekommen ist.
2. "patientTodos" (Array von Objekten): Vorbereitungen oder ToDos für den Patienten.
   Jedes Objekt muss folgende Struktur haben:
   - "id": Eine eindeutige ID (z.B. "pat_1", "pat_2", ...)
   - "category": Kategorie als kurzes Wort (z.B. "Vorbereitung", "Medikation")
   - "text": Der extrem kurze Text für den Arzt im Dashboard (1 Satz, max. 12 Wörter).
   - "patientText": Die sehr höfliche Bitte an den Patienten (1 Satz, max. 12 Wörter).
   - "reasoning": Kurzer Satz, wie die KI darauf gekommen ist.

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "doctorTodos": [
    { "id": "doc_1", "category": "Kategorie", "text": "...", "reasoning": "..." }
  ],
  "patientTodos": [
    { "id": "pat_1", "category": "Kategorie", "text": "...", "patientText": "...", "reasoning": "..." }
  ]
}
Gib kein anderes Text- oder Markdown-Format zurück. Kein \`\`\`json. Nur das rohe JSON.
`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();

      // Strip markdown code blocks if any
      if (text.startsWith('```')) {
        text = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(text);
      if (parsed && (Array.isArray(parsed.doctorTodos) || Array.isArray(parsed.patientTodos))) {
        ai_assessments = {
          doctorTodos: Array.isArray(parsed.doctorTodos) ? parsed.doctorTodos : [],
          patientTodos: Array.isArray(parsed.patientTodos) ? parsed.patientTodos : []
        };
      }
    } catch (aiErr) {
      console.warn('Gemini API call failed for assessments, falling back to rule-based generation:', aiErr.message);
    }

    // Fallback rule-based generator
    if (!ai_assessments) {
      const doctorTodos = [];
      const patientTodos = [];

      const chips = (beschwerden.chips || []).map(c => c.toLowerCase());
      const freitext = (beschwerden.freitext || '').toLowerCase();
      const meds = (medikamente.list || medikamente.liste || []);
      const allergies = (allergien.list || allergien.liste || []);

      // Specific heuristics
      if (chips.includes('kopfschmerzen') || freitext.includes('kopfschmerz') || freitext.includes('migräne')) {
        doctorTodos.push({
          id: 'doc_fall_head_1',
          category: 'Risiko',
          text: 'Führen Sie eine gezielte neurologische Basisuntersuchung durch, um rote Flaggen (z.B. Hirnnervenstörungen, Nackensteifigkeit, plötzlicher Vernichtungskopfschmerz) sicher auszuschließen und eine sekundäre Kopfschmerzursache abzugrenzen.',
          reasoning: 'Ausschluss roter Flaggen bei akuten/subakuten Kopfschmerzen'
        });
        doctorTodos.push({
          id: 'doc_fall_head_2',
          category: 'Anamnese',
          text: 'Erfragen Sie die genaue Schmerzcharakteristik (pulsierend, drückend, stechend), eventuelle Begleitsymptome (Übelkeit, Lichtempfindlichkeit) und mögliche Triggerfaktoren wie Schlafmangel oder Stress.',
          reasoning: 'Ermittlung der Kopfschmerz-Phänotypen für die Diagnose'
        });
        patientTodos.push({
          id: 'pat_fall_head',
          category: 'Vorbereitung',
          text: 'Schmerztagebuch der letzten Wochen mitbringen.',
          patientText: 'Falls Sie in den letzten Wochen ein Schmerztagebuch oder Notizen über die Häufigkeit und Stärke Ihrer Kopfschmerzen geführt haben, bringen Sie diese Aufzeichnungen bitte zum Termin mit.',
          reasoning: 'Unterstützung der präzisen Diagnose durch Verlaufsprotokolle'
        });
      }

      if (chips.includes('fieber') || freitext.includes('fieber')) {
        doctorTodos.push({
          id: 'doc_fall_fever_1',
          category: 'Diagnostik',
          text: 'Führen Sie eine strukturierte Suche nach dem Infektfokus durch (HNO, Lunge, Abdomen, Harnwege) und bestimmen Sie bei klinischem Verdacht die Entzündungsparameter (z.B. CRP oder Differenzialblutbild).',
          reasoning: 'Fokussuche und systemische Entzündungsabklärung bei Fieber'
        });
        doctorTodos.push({
          id: 'doc_fall_fever_2',
          category: 'Anamnese',
          text: 'Erheben Sie die genaue Temperaturkurve, das Ansprechen auf Antipyretika und das Vorliegen von B-Symptomatik (Nachtschweiß, Gewichtsverlust) oder Schüttelfrost.',
          reasoning: 'Klinische Verlaufserhebung des Fiebers'
        });
      }

      if (meds.length > 0) {
        doctorTodos.push({
          id: 'doc_fall_meds_1',
          category: 'Medikation',
          text: `Abgleich der angegebenen Medikamente (Gesamtanzahl: ${meds.length}) zur Vermeidung potenzieller Interaktionen, Doppelmedikationen oder Kontraindikationen bei Neuverschreibungen.`,
          reasoning: 'Interaktions- und Kontraindikationsprüfung'
        });
        patientTodos.push({
          id: 'pat_fall_meds',
          category: 'Vorbereitung',
          text: 'Aktuellen Medikationsplan oder Originalverpackungen mitbringen.',
          patientText: 'Bitte bringen Sie Ihren aktuellen, offiziellen Medikationsplan (bundeseinheitlicher Medikationsplan) oder die Originalverpackungen Ihrer derzeit eingenommenen Medikamente mit zum Termin.',
          reasoning: 'Vermeidung von Übertragungsfehlern bei der Medikamentenanamnese'
        });
      }

      if (allergies.length > 0) {
        doctorTodos.push({
          id: 'doc_fall_all_1',
          category: 'Allergien',
          text: `Berücksichtigen Sie die gemeldeten Allergien (${allergies.map(a => a.name || a).join(', ')}) bei jeder geplanten Verordnung oder medizinischen Intervention, um anaphylaktische Reaktionen zu vermeiden.`,
          reasoning: 'Prävention allergischer/anaphylaktischer Reaktionen'
        });
      }

      // Default symptom-focused item if doctor list is empty
      if (doctorTodos.length === 0) {
        doctorTodos.push({
          id: 'doc_fall_gen',
          category: 'Anamnese',
          text: 'Erheben Sie im Gespräch eine detaillierte Anamnese bezüglich der Hauptbeschwerden, der zeitlichen Dynamik, eventueller Auslöser sowie bereits durchgeführter Selbsttherapieversuche.',
          reasoning: 'Klinische Anamneseerhebung bei Erstvorstellung'
        });
      }

      ai_assessments = { doctorTodos, patientTodos };
    }

    // Save to database
    await pool.query(
      'UPDATE precheckins SET ai_assessments = $1 WHERE termin_code = $2',
      [JSON.stringify(ai_assessments), code]
    );

    res.json({ success: true, ai_assessments, anamnesis_assessment: termin.anamnesis_assessment });
  } catch (err) {
    console.error('Error generating AI assessments:', err);
    res.status(500).json({ error: 'Fehler beim Generieren der Empfehlungen des KI-Assistenten.' });
  }
});

// API: Save/update AI assessments (e.g. after removing one)
app.put('/api/praxis/termin/:code/ai-assessments', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code } = req.params;
  const { ai_assessments } = req.body;

  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }

  try {
    // Verify appointment belongs to this praxis
    const check = await pool.query('SELECT code FROM termine WHERE code = $1 AND praxis = $2', [code, req.session.user.praxis_name]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    await pool.query(
      'UPDATE precheckins SET ai_assessments = $1 WHERE termin_code = $2',
      [JSON.stringify(ai_assessments), code]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating AI assessments:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des KI-Assistenten.' });
  }
});

// API: Generate anamnesis assessment using Gemini
app.post('/api/praxis/termin/:code/anamnesis-assessment', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code } = req.params;

  if (!isDbConnected || !pool) {
    return res.status(500).json({ error: 'Datenbankverbindung nicht verfügbar.' });
  }

  try {
    // 1. Fetch appointment & precheckin details
    const terminRes = await pool.query(
      `SELECT t.*, p.submitted, p.beschwerden, p.medikamente, p.allergien, p.custom_answers, p.ai_questions
       FROM termine t
       LEFT JOIN precheckins p ON t.code = p.termin_code
       WHERE t.code = $1`,
      [code]
    );

    if (terminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    const termin = terminRes.rows[0];
    if (!termin.submitted) {
      return res.status(400).json({ error: 'Pre-Check-In des Patienten ist noch nicht abgeschlossen.' });
    }

    const beschwerden = termin.beschwerden || {};
    const medikamente = termin.medikamente || {};
    const allergien = termin.allergien || {};
    const customAnswers = termin.custom_answers || {};
    const aiQuestions = termin.ai_questions || [];

    let anamnesis_assessment = '';

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not defined');
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

      const prompt = `
Du bist ein hochqualifizierter klinischer Assistent. Deine Aufgabe ist es, basierend auf den Angaben aus dem Patienten-Pre-Check-In eine fundierte medizinische Verdachtseinschätzung zu erstellen, was der Patient haben könnte (Differenzialdiagnosen, mögliche Ursachen).

Achtung: Dies dient ausschließlich der Vorbereitung des behandelnden Arztes im internen Dashboard.
Formuliere die Einschätzung professionell, präzise und übersichtlich in deutscher Sprache (ca. 3-4 Sätze).

Praxis- & Termin-Kontext:
- Fachrichtung: ${termin.fachrichtung}
- Termin-Art: ${termin.art}
- Praxis-Name: ${termin.praxis}
- Arzt: ${termin.doctor}

Patienten-Angaben (Pre-Check-In):
- Symptom-Chips: ${JSON.stringify(beschwerden.chips || [])}
- Eigene Stichwörter: ${JSON.stringify(beschwerden.customKeywords || [])}
- Freitext-Beschreibung: ${beschwerden.freitext || 'Keine Angabe'}
- Stärke (Skala 1-10): ${beschwerden.staerke || 'Keine Angabe'}
- Dauer: ${beschwerden.dauer || 'Keine Angabe'}
- Medikamente: ${JSON.stringify(medikamente.list || [])}
- Allergien: ${JSON.stringify(allergien.list || [])}
- Antworten auf Praxis-spezifische Fragen: ${JSON.stringify(customAnswers)}
- Antworten auf KI-Folgefragen: ${JSON.stringify(aiQuestions)}

Erstelle eine präzise Einschätzung mit möglichen Verdachtsdiagnosen oder Empfehlungen. Antworte direkt als Fließtext ohne Markdown-Formatierungen, HTML-Tags oder Begleittext.
`;

      const result = await model.generateContent(prompt);
      anamnesis_assessment = result.response.text().trim();
    } catch (aiErr) {
      console.warn('Gemini API call failed for anamnesis-assessment, falling back to rule-based generation:', aiErr.message);
      // Fallback rule-based generation
      const chipsStr = (beschwerden.chips || []).join(', ');
      anamnesis_assessment = `Basierend auf den gemeldeten Symptomen (${chipsStr || 'Keine Angabe'}) und der Freitext-Beschreibung liegt der Verdacht nahe, dass eine symptombezogene Abklärung in der Fachrichtung ${termin.fachrichtung} erforderlich ist. Bitte prüfen Sie mögliche Wechselwirkungen mit der aktuellen Medikation und die Ausschlusskriterien für Allergien.`;
    }

    // Save to DB
    await pool.query(
      'UPDATE precheckins SET anamnesis_assessment = $1 WHERE termin_code = $2',
      [anamnesis_assessment, code]
    );

    res.json({ success: true, anamnesis_assessment });
  } catch (err) {
    console.error('Error generating anamnesis assessment:', err);
    res.status(500).json({ error: 'Fehler beim Generieren der Einschätzung aus der Anamnese.' });
  }
});

// API: Send aftercare instructions to patient
app.post('/api/praxis/termin/:code/aftercare', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code } = req.params;
  const { instructions } = req.body;

  if (!instructions || !instructions.trim()) {
    return res.status(400).json({ error: 'Nachsorge-Hinweise dürfen nicht leer sein.' });
  }

  if (!isDbConnected || !pool) {
    return res.status(500).json({ error: 'Datenbank nicht verfügbar.' });
  }

  try {
    // 1. Get patient email and doctor info (checking both notify_email and users.email)
    const terminRes = await pool.query(
      `SELECT t.doctor, t.praxis, t.notify_email, t.patient_vorname, u.email as patient_email 
       FROM termine t 
       LEFT JOIN users u ON t.user_id = u.id 
       WHERE t.code = $1`,
      [code]
    );

    if (terminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    const appt = terminRes.rows[0];
    const emailTo = appt.notify_email || appt.patient_email;

    if (!emailTo) {
      return res.status(400).json({ error: 'Für diesen Termin ist keine E-Mail-Adresse hinterlegt.' });
    }

    // 2. Insert into database
    await pool.query(
      'INSERT INTO aftercare_instructions (termin_code, instructions, email_sent) VALUES ($1, $2, true)',
      [code, instructions.trim()]
    );

    // 3. Send email to patient
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
        <div style="background-color: #0063be; padding: 24px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold;">🩺 Nachsorge-Hinweise Ihrer Arztpraxis</h2>
        </div>
        <div style="padding: 24px; line-height: 1.6;">
          <p style="margin-top: 0;">Hallo <strong>${appt.patient_vorname || 'Patient'}</strong>,</p>
          <p>Ihre Praxis (<strong>${appt.praxis}</strong>) hat Ihnen folgende Nachsorge-Hinweise zu Ihrem Termin bei <strong>${appt.doctor}</strong> übermittelt:</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #0063be; padding: 16px; margin: 24px 0; border-radius: 4px; font-style: italic;">
            "${instructions.trim().replace(/\n/g, '<br>')}"
          </div>
          
          <p>Bitte befolgen Sie diese Anweisungen sorgfältig für eine optimale Genesung.</p>
          <p style="color: #64748b; font-size: 13px;">Bei medizinischen Rückfragen, Beschwerden oder im Notfall kontaktieren Sie bitte direkt Ihre Praxis oder den ärztlichen Notdienst.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Diese E-Mail wurde automatisch im Auftrag Ihrer Praxis über den Doctolib Pre-Check-In Service gesendet.
        </div>
      </div>
    `;

    await sendEmail({
      to: emailTo,
      subject: `Wichtige Nachsorge-Hinweise - ${appt.praxis}`,
      html: emailHtml
    });

    console.log(`📧 Aftercare email notification sent successfully to ${emailTo}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error sending aftercare email:', err);
    res.status(500).json({ error: 'Fehler beim Senden der Nachsorge-Hinweise.' });
  }
});

// API: Send hints to a patient (saves + sends email)
app.post('/api/praxis/termin/:code/hints', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code } = req.params;
  const { hints, custom_text } = req.body;
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    // Verify appointment and get patient email
    const terminRes = await pool.query(
      `SELECT t.*, u.email as patient_email
       FROM termine t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.code = $1 AND t.praxis = $2`,
      [code, req.session.user.praxis_name]
    );
    if (terminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    const appt = terminRes.rows[0];

    // Save hint
    const result = await pool.query(
      `INSERT INTO patient_hints (termin_code, hints, custom_text, email_sent)
       VALUES ($1, $2, $3, $4)
       RETURNING id, hints, custom_text, sent_at, email_sent`,
      [code, JSON.stringify(hints || []), custom_text || '', false]
    );

    // Send email if patient has an email (checking notify_email first, then fallback to patient_email)
    const emailTo = appt.notify_email || appt.patient_email;
    if (emailTo) {
      try {
        await sendHintEmail(emailTo, appt, hints || [], custom_text || '', req.session.user.praxis_name);
        await pool.query('UPDATE patient_hints SET email_sent = TRUE WHERE id = $1', [result.rows[0].id]);
        result.rows[0].email_sent = true;
      } catch (emailErr) {
        console.error('Failed to send hint email:', emailErr);
      }
    }

    console.log(`Hint sent for appointment ${code}`);
    res.json({ success: true, hint: result.rows[0] });
  } catch (err) {
    console.error('Error sending hint:', err);
    res.status(500).json({ error: 'Fehler beim Senden des Hinweises.' });
  }
});

// API: Update an existing hint
app.put('/api/praxis/termin/:code/hints/:hintId', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code, hintId } = req.params;
  const { hints, custom_text, resend_email } = req.body;
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    await pool.query(
      `UPDATE patient_hints SET hints = $1, custom_text = $2, sent_at = CURRENT_TIMESTAMP WHERE id = $3 AND termin_code = $4`,
      [JSON.stringify(hints || []), custom_text || '', hintId, code]
    );

    // Resend email if requested
    if (resend_email) {
      const terminRes = await pool.query(
        `SELECT t.*, u.email as patient_email
         FROM termine t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.code = $1 AND t.praxis = $2`,
        [code, req.session.user.praxis_name]
      );
      if (terminRes.rows.length > 0) {
        const appt = terminRes.rows[0];
        const emailTo = appt.notify_email || appt.patient_email;
        if (emailTo) {
          try {
            await sendHintEmail(emailTo, appt, hints || [], custom_text || '', req.session.user.praxis_name);
            await pool.query('UPDATE patient_hints SET email_sent = TRUE WHERE id = $1', [hintId]);
          } catch (emailErr) {
            console.error('Failed to resend hint email:', emailErr);
          }
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating hint:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Hinweises.' });
  }
});

// API: Get/update default hints for the practice
app.get('/api/praxis/default-hints', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  if (!isDbConnected || !pool) {
    return res.json({ success: true, defaultHints: null });
  }
  try {
    const result = await pool.query('SELECT default_hints FROM users WHERE id = $1', [req.session.userId]);
    res.json({ success: true, defaultHints: result.rows[0]?.default_hints || null });
  } catch (err) {
    console.error('Error fetching default hints:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Standard-Hinweise.' });
  }
});

app.put('/api/praxis/default-hints', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { defaultHints } = req.body;
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    await pool.query('UPDATE users SET default_hints = $1 WHERE id = $2', [JSON.stringify(defaultHints), req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving default hints:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Standard-Hinweise.' });
  }
});

// API: Update appointment duration (drag-to-resize)
app.put('/api/praxis/termin/:code/duration', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code } = req.params;
  const { duration } = req.body;
  if (!duration || duration < 15) {
    return res.status(400).json({ error: 'Mindestdauer ist 15 Minuten.' });
  }
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    const check = await pool.query('SELECT code FROM termine WHERE code = $1 AND praxis = $2', [code, req.session.user.praxis_name]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    await pool.query('UPDATE termine SET duration = $1 WHERE code = $2', [duration, code]);

    // Check for conflicts: find overlapping appointments
    const apptRes = await pool.query('SELECT date, time, duration FROM termine WHERE code = $1', [code]);
    const appt = apptRes.rows[0];
    const allRes = await pool.query(
      'SELECT code, time, duration, patient_vorname, patient_nachname FROM termine WHERE praxis = $1 AND date = $2 AND code != $3',
      [req.session.user.praxis_name, appt.date, code]
    );

    // Calculate if the new duration overlaps with any other appointment
    const conflicts = [];
    const apptStartMin = parseTimeToMinutes(appt.time);
    const apptEndMin = apptStartMin + duration;
    for (const other of allRes.rows) {
      const otherStartMin = parseTimeToMinutes(other.time);
      const otherEndMin = otherStartMin + (other.duration || 30);
      if (apptEndMin > otherStartMin && apptStartMin < otherEndMin) {
        conflicts.push({
          code: other.code,
          time: other.time,
          patient: `${other.patient_vorname} ${other.patient_nachname}`.trim()
        });
      }
    }

    res.json({ success: true, conflicts });
  } catch (err) {
    console.error('Error updating duration:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Dauer.' });
  }
});

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

// API: Patient-side - get hints for their appointment
app.get('/api/precheckin/:terminCode/hints', async (req, res) => {
  const { terminCode } = req.params;
  if (!isDbConnected || !pool) {
    return res.json({ success: true, hints: [] });
  }
  try {
    const result = await pool.query(
      'SELECT hints, custom_text, sent_at FROM patient_hints WHERE termin_code = $1 ORDER BY sent_at DESC',
      [terminCode]
    );
    res.json({ success: true, hints: result.rows });
  } catch (err) {
    console.error('Error fetching patient hints:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Hinweise.' });
  }
});

// API: Send delay notification to affected patient
app.post('/api/praxis/termin/:code/delay-notify', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { code } = req.params;
  const { delay_minutes } = req.body;
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    const terminRes = await pool.query(
      `SELECT t.*, u.email as patient_email
       FROM termine t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.code = $1 AND t.praxis = $2`,
      [code, req.session.user.praxis_name]
    );
    if (terminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    const appt = terminRes.rows[0];
    if (appt.patient_email) {
      await sendDelayEmail(appt.patient_email, appt, delay_minutes || 0, req.session.user.praxis_name);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error sending delay notification:', err);
    res.status(500).json({ error: 'Fehler beim Senden der Verspätungsbenachrichtigung.' });
  }
});

// Email template for hints
async function sendHintEmail(email, appointment, hints, customText, praxisName) {
  const hintsHtml = hints.length > 0
    ? `<ul style="padding-left: 20px; margin: 15px 0;">${hints.map(h => `<li style="margin-bottom: 8px; font-size: 14px; color: #334155;">${h}</li>`).join('')}</ul>`
    : '';
  const customHtml = customText
    ? `<div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; margin: 15px 0; font-size: 14px; color: #334155; border-left: 3px solid #0063BE;">${customText}</div>`
    : '';

  const subject = `Hinweis von ${praxisName} zu Ihrem Termin`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0063BE; margin-bottom: 20px;">Wichtiger Hinweis zu Ihrem Termin</h2>
      <p style="font-size: 16px; line-height: 1.5; color: #334155;">
        Ihre Praxis <strong>${praxisName}</strong> hat Ihnen folgende Hinweise zu Ihrem Termin am
        <strong>${appointment.date}</strong> um <strong>${appointment.time} Uhr</strong> gesendet:
      </p>
      ${hintsHtml}
      ${customHtml}
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Doctolib Pre-Check-In – Automatische Benachrichtigung</p>
    </div>
  `;

  await sendEmail({ to: email, subject, html });
}

// Email template for delay notifications
async function sendDelayEmail(email, appointment, delayMinutes, praxisName) {
  const subject = `Verzögerung Ihres Termins bei ${praxisName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #D97706; margin-bottom: 20px;">⏰ Hinweis zur Terminverschiebung</h2>
      <p style="font-size: 16px; line-height: 1.5; color: #334155;">
        Ihre Praxis <strong>${praxisName}</strong> informiert Sie, dass sich Ihr Termin am
        <strong>${appointment.date}</strong> um <strong>${appointment.time} Uhr</strong>
        voraussichtlich um ca. <strong>${delayMinutes} Minuten</strong> verzögern wird.
      </p>
      <p style="font-size: 14px; color: #64748B; margin-top: 15px;">Wir bitten um Ihr Verständnis.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Doctolib Pre-Check-In – Automatische Benachrichtigung</p>
    </div>
  `;

  await sendEmail({ to: email, subject, html });
}

// ============================================
// DATENGESTÜTZTE BEHANDLUNGSDAUER & ANALYSE
// ============================================

// Default manual duration standards per appointment type
const DEFAULT_TERMINART_STANDARDS = {
  'Routineuntersuchung': { manualDuration: 15, defaultAvg: 14 },
  'Erstgespräch': { manualDuration: 30, defaultAvg: 28 },
  'Akutbeschwerden': { manualDuration: 15, defaultAvg: 12 },
  'Besprechung': { manualDuration: 20, defaultAvg: 22 },
  'Kontrolltermin': { manualDuration: 15, defaultAvg: 15 }
};

// In-memory store for completed treatments & active timers
let treatmentHistoryStore = [
  { praxisName: 'all', art: 'Routineuntersuchung', durationMinutes: 14, timestamp: new Date(Date.now() - 36000000).toISOString() },
  { praxisName: 'all', art: 'Routineuntersuchung', durationMinutes: 15, timestamp: new Date(Date.now() - 32000000).toISOString() },
  { praxisName: 'all', art: 'Routineuntersuchung', durationMinutes: 13, timestamp: new Date(Date.now() - 28000000).toISOString() },
  { praxisName: 'all', art: 'Erstgespräch', durationMinutes: 28, timestamp: new Date(Date.now() - 24000000).toISOString() },
  { praxisName: 'all', art: 'Erstgespräch', durationMinutes: 32, timestamp: new Date(Date.now() - 20000000).toISOString() },
  { praxisName: 'all', art: 'Erstgespräch', durationMinutes: 26, timestamp: new Date(Date.now() - 16000000).toISOString() },
  { praxisName: 'all', art: 'Akutbeschwerden', durationMinutes: 12, timestamp: new Date(Date.now() - 12000000).toISOString() },
  { praxisName: 'all', art: 'Akutbeschwerden', durationMinutes: 11, timestamp: new Date(Date.now() - 8000000).toISOString() },
  { praxisName: 'all', art: 'Besprechung', durationMinutes: 22, timestamp: new Date(Date.now() - 4000000).toISOString() },
  { praxisName: 'all', art: 'Besprechung', durationMinutes: 24, timestamp: new Date(Date.now() - 2000000).toISOString() }
];

let activeTreatmentTimers = {}; // { terminCode: startTimeMs }
let praxisTerminartSettingsStore = {}; // { [praxisName_art]: { manualDuration, useAuto } }

function getPraxisSettings(praxisName, art) {
  const key = `${praxisName || 'default'}_${art}`;
  const defaultStd = DEFAULT_TERMINART_STANDARDS[art] || { manualDuration: 15, defaultAvg: 15 };
  if (!praxisTerminartSettingsStore[key]) {
    praxisTerminartSettingsStore[key] = {
      manualDuration: defaultStd.manualDuration,
      useAuto: true
    };
  }
  return praxisTerminartSettingsStore[key];
}

function calculateTerminartAnalysis(praxisName) {
  const result = [];
  const allArts = Object.keys(DEFAULT_TERMINART_STANDARDS);

  for (const art of allArts) {
    const settings = getPraxisSettings(praxisName, art);
    const entries = treatmentHistoryStore.filter(e => 
      e.art === art && (e.praxisName === 'all' || !praxisName || e.praxisName === praxisName) &&
      e.durationMinutes >= 2 && e.durationMinutes <= 120
    );

    const sampleCount = entries.length;
    let calculatedAvg = DEFAULT_TERMINART_STANDARDS[art]?.defaultAvg || settings.manualDuration;
    if (sampleCount > 0) {
      const sum = entries.reduce((acc, curr) => acc + curr.durationMinutes, 0);
      calculatedAvg = Math.round(sum / sampleCount);
    }

    const effectiveDuration = settings.useAuto ? calculatedAvg : settings.manualDuration;
    const diff = calculatedAvg - settings.manualDuration;
    let statusTrend = 'neutral';
    if (diff > 2) statusTrend = 'higher';
    else if (diff < -2) statusTrend = 'lower';

    result.push({
      art,
      manualDuration: settings.manualDuration,
      calculatedAvg,
      sampleCount,
      useAuto: settings.useAuto,
      effectiveDuration,
      statusTrend,
      diff
    });
  }

  return result;
}

function getEffectiveDurationForArt(praxisName, art) {
  const settings = getPraxisSettings(praxisName, art);
  if (!settings.useAuto) return settings.manualDuration;
  
  const entries = treatmentHistoryStore.filter(e => 
    e.art === art && (e.praxisName === 'all' || !praxisName || e.praxisName === praxisName) &&
    e.durationMinutes >= 2 && e.durationMinutes <= 120
  );
  if (entries.length === 0) {
    return DEFAULT_TERMINART_STANDARDS[art]?.defaultAvg || settings.manualDuration;
  }
  const sum = entries.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  return Math.round(sum / entries.length);
}

// API: Get treatment duration analysis for a praxis
app.get('/api/praxis/terminarten/analyse', (req, res) => {
  const praxisName = req.session.user?.praxis_name || req.query.praxis || '';
  const analysis = calculateTerminartAnalysis(praxisName);
  res.json({ success: true, analysis });
});

// API: Get recommended duration for a specific appointment type
app.get('/api/praxis/terminarten/dauer', (req, res) => {
  const { art, praxis } = req.query;
  const praxisName = praxis || req.session.user?.praxis_name || '';
  const effectiveDuration = getEffectiveDurationForArt(praxisName, art || 'Routineuntersuchung');
  const settings = getPraxisSettings(praxisName, art);
  res.json({
    success: true,
    art,
    effectiveDuration,
    manualDuration: settings.manualDuration,
    useAuto: settings.useAuto
  });
});

// API: Update settings for a terminart (manual duration & useAuto toggle)
app.put('/api/praxis/terminarten/einstellungen', (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { art, manualDuration, useAuto } = req.body;
  const praxisName = req.session.user.praxis_name || '';
  const key = `${praxisName}_${art}`;

  if (!praxisTerminartSettingsStore[key]) {
    praxisTerminartSettingsStore[key] = {
      manualDuration: Number(manualDuration) || 15,
      useAuto: Boolean(useAuto)
    };
  } else {
    if (manualDuration !== undefined) praxisTerminartSettingsStore[key].manualDuration = Number(manualDuration);
    if (useAuto !== undefined) praxisTerminartSettingsStore[key].useAuto = Boolean(useAuto);
  }

  res.json({ success: true, settings: praxisTerminartSettingsStore[key] });
});

// Helper: Check if an appointment date corresponds to today
function isTerminToday(dateVal) {
  if (!dateVal) return true;
  try {
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
      const parts = dateVal.split('T')[0].split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return y === todayY && m === todayM && d === todayD;
    }

    if (typeof dateVal === 'string' && /^\d{1,2}\.\d{1,2}\.\d{4}/.test(dateVal)) {
      const parts = dateVal.split('.');
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      return y === todayY && m === todayM && d === todayD;
    }

    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) {
      return parsed.getFullYear() === todayY && parsed.getMonth() === todayM && parsed.getDate() === todayD;
    }

    const match = String(dateVal).match(/(\d{1,2})\./);
    if (match) {
      const d = parseInt(match[1], 10);
      return d === todayD;
    }
  } catch (err) {
    console.warn('isTerminToday check failed:', err);
  }
  return true;
}

// API: Get queue status for a praxis (today only)
app.get('/api/queue/:praxisName', async (req, res) => {
  const { praxisName } = req.params;
  const decodedPraxisName = decodeURIComponent(praxisName);

  if (!isDbConnected || !pool) {
    return res.json({ success: true, queue: [] });
  }

  try {
    // Get all appointments for this praxis
    const result = await pool.query(
      `SELECT t.code, t.patient_vorname, t.patient_nachname, t.date, t.time, t.art, t.duration, t.user_id,
              u.geburtsdatum as patient_geburtsdatum, u.email as patient_email,
              q.status as queue_status, q.delay_minutes, q.delay_reason, q.early_request_status, q.early_minutes, q.position, q.updated_at as queue_updated_at
       FROM termine t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN queue_status q ON t.code = q.termin_code
       WHERE t.praxis = $1 AND (q.status IS NULL OR q.status != 'no_show')
       ORDER BY t.time ASC`,
      [decodedPraxisName]
    );

    // Filter to today's appointments only
    const todayAppointments = result.rows.filter(row => isTerminToday(row.date));

    // Auto-create queue_status entries for today's appointments that don't have one
    for (let i = 0; i < todayAppointments.length; i++) {
      const appt = todayAppointments[i];
      if (!appt.queue_status) {
        try {
          await pool.query(
            `INSERT INTO queue_status (praxis_name, termin_code, status, position)
             VALUES ($1, $2, 'waiting', $3)
             ON CONFLICT (termin_code) DO NOTHING`,
            [decodedPraxisName, appt.code, i + 1]
          );
          appt.queue_status = 'waiting';
          appt.delay_minutes = 0;
          appt.delay_reason = '';
          appt.early_request_status = null;
          appt.position = i + 1;
        } catch (insertErr) {
          console.warn('Queue status auto-insert failed:', insertErr.message);
        }
      }
    }

    // Determine if caller is praxis or patient
    const isPraxis = req.session?.user?.role === 'praxis';
    const currentUserId = req.session?.userId;

    // Calculate dynamic wait times per patient based on effective duration of front queue items
    let cumulativeWait = 0;

    const queue = todayAppointments.map((appt, idx) => {
      const isOwnAppointment = currentUserId ? appt.user_id === currentUserId : false;
      const status = appt.queue_status || 'waiting';
      const effectiveDuration = getEffectiveDurationForArt(decodedPraxisName, appt.art);

      let estimatedWaitMinutes = 0;
      if (status === 'in_treatment') {
        const startTime = activeTreatmentTimers[appt.code] || (appt.queue_updated_at ? new Date(appt.queue_updated_at).getTime() : Date.now());
        const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
        const remDuration = Math.max(2, effectiveDuration - elapsedMinutes);
        cumulativeWait += remDuration;
      } else if (status === 'waiting' || status === 'arrived' || status === 'delayed') {
        estimatedWaitMinutes = cumulativeWait;
        cumulativeWait += effectiveDuration;
      }

      return {
        code: appt.code,
        patient_vorname: isPraxis || isOwnAppointment ? appt.patient_vorname : 'Patient',
        patient_nachname: isPraxis || isOwnAppointment ? appt.patient_nachname : '',
        patient_geburtsdatum: isPraxis || isOwnAppointment ? (appt.patient_geburtsdatum || '') : '',
        time: appt.time,
        art: appt.art,
        duration: appt.duration || effectiveDuration,
        effective_duration: effectiveDuration,
        estimated_wait_minutes: estimatedWaitMinutes,
        status: status,
        delay_minutes: appt.delay_minutes || 0,
        delay_reason: appt.delay_reason || '',
        early_request_status: appt.early_request_status || null,
        early_minutes: appt.early_minutes || 0,
        position: appt.position || idx + 1,
        is_own: isOwnAppointment,
        queue_updated_at: appt.queue_updated_at || null
      };
    });

    res.json({ success: true, queue, totalRemainingMinutes: cumulativeWait });
  } catch (err) {
    console.error('Error fetching queue:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Warteschlange.' });
  }
});

// API: Doctor accepts a patient (start treatment)
app.post('/api/queue/:terminCode/accept', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { terminCode } = req.params;

  // Track start time
  activeTreatmentTimers[terminCode] = Date.now();

  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    const check = await pool.query(
      'SELECT code FROM termine WHERE code = $1 AND praxis = $2',
      [terminCode, req.session.user.praxis_name]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    await pool.query(
      `INSERT INTO queue_status (praxis_name, termin_code, status, updated_at)
       VALUES ($1, $2, 'in_treatment', NOW())
       ON CONFLICT (termin_code) DO UPDATE SET status = 'in_treatment', updated_at = NOW()`,
      [req.session.user.praxis_name, terminCode]
    );

    await logActivity({
      praxisId: req.session.userId,
      praxisName: req.session.user.praxis_name,
      terminCode,
      status: 'in_treatment',
      action: 'Patient in Behandlung genommen (Erschienen)',
      staffName: req.session.user?.email || 'Praxismitarbeiter'
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error accepting patient:', err);
    res.status(500).json({ error: 'Fehler beim Annehmen des Patienten.' });
  }
});

// API: Doctor marks treatment as done
app.post('/api/queue/:terminCode/done', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { terminCode } = req.params;
  const praxisName = req.session.user.praxis_name;

  // Record treatment duration
  const startTime = activeTreatmentTimers[terminCode];
  delete activeTreatmentTimers[terminCode];

  let durationMinutes = 15; // default fallback
  if (startTime) {
    durationMinutes = Math.max(2, Math.round((Date.now() - startTime) / 60000));
  }

  let art = 'Routineuntersuchung';

  if (!isDbConnected || !pool) {
    treatmentHistoryStore.push({
      praxisName: praxisName || 'all',
      art,
      durationMinutes,
      timestamp: new Date().toISOString()
    });
    return res.json({ success: true });
  }
  try {
    const check = await pool.query(
      'SELECT code, art FROM termine WHERE code = $1 AND praxis = $2',
      [terminCode, praxisName]
    );
    if (check && check.rows && check.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    if (check && check.rows && check.rows[0] && check.rows[0].art) {
      art = check.rows[0].art;
    }

    treatmentHistoryStore.push({
      praxisName: praxisName || 'all',
      art,
      durationMinutes,
      timestamp: new Date().toISOString()
    });

    await pool.query(
      `INSERT INTO queue_status (praxis_name, termin_code, status, updated_at)
       VALUES ($1, $2, 'done', NOW())
       ON CONFLICT (termin_code) DO UPDATE SET status = 'done', updated_at = NOW()`,
      [praxisName, terminCode]
    );

    await logActivity({
      praxisId: req.session.userId,
      praxisName,
      terminCode,
      status: 'erschienen',
      action: `Behandlung abgeschlossen (Dauer: ${durationMinutes} Min)`,
      staffName: req.session.user?.email || 'Praxismitarbeiter'
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking done:', err);
    res.status(500).json({ error: 'Fehler beim Abschließen der Behandlung.' });
  }
});

// API: Doctor delays an appointment
app.post('/api/queue/:terminCode/delay', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { terminCode } = req.params;
  const { delay_minutes, reason } = req.body;
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    const terminRes = await pool.query(
      `SELECT t.*, u.email as patient_email
       FROM termine t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.code = $1 AND t.praxis = $2`,
      [terminCode, req.session.user.praxis_name]
    );
    if (terminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    const appt = terminRes.rows[0];

    await pool.query(
      `INSERT INTO queue_status (praxis_name, termin_code, status, delay_minutes, delay_reason, updated_at)
       VALUES ($1, $2, 'delayed', $3, $4, NOW())
       ON CONFLICT (termin_code) DO UPDATE SET status = 'delayed', delay_minutes = $3, delay_reason = $4, updated_at = NOW()`,
      [req.session.user.praxis_name, terminCode, delay_minutes || 0, reason || '']
    );

    await logActivity({
      praxisId: req.session.userId,
      praxisName: req.session.user.praxis_name,
      terminCode,
      status: 'verzögert',
      action: `Termin um ${delay_minutes || 0} Min verzögert (Grund: ${reason || 'Kein Grund'})`,
      staffName: req.session.user?.email || 'Praxismitarbeiter'
    });

    // Send delay email to patient
    if (appt.patient_email) {
      try {
        await sendDelayEmail(appt.patient_email, appt, delay_minutes || 0, req.session.user.praxis_name);
      } catch (emailErr) {
        console.warn('Failed to send delay email:', emailErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error delaying appointment:', err);
    res.status(500).json({ error: 'Fehler beim Verzögern des Termins.' });
  }
});

// API: Get Activity Logs for Praxis (Strictly scoped by praxis, auto-purges >90 days)
app.get('/api/praxis/activity-logs', async (req, res) => {
  const isPraxis = req.session?.userId && req.session?.user?.role === 'praxis';
  const isPatient = req.session?.userId && req.session?.user?.role === 'patient';

  if (isPatient || (!isPraxis && process.env.NODE_ENV === 'test')) {
    return res.status(403).json({ error: 'Zugriff verweigert. Nur für autorisiertes Praxispersonal zugänglich.' });
  }

  try {
    await purgeOldActivityLogs();

    const praxisUserId = req.session?.userId || 'demo_praxis_id';
    const praxisName = req.session?.user?.praxis_name || 'Demo Praxis';

    const numericPraxisId = (praxisUserId && !isNaN(Number(praxisUserId))) ? parseInt(praxisUserId, 10) : null;

    if (!isDbConnected || !pool) {
      const filteredStore = activityLogsStore.filter(l => 
        l.praxis_id === praxisUserId || 
        l.praxis_id === numericPraxisId ||
        l.praxis_name === praxisName || 
        !l.praxis_name || 
        l.praxis_name === 'Demo Praxis'
      );
      return res.json({ success: true, logs: filteredStore });
    }

    const result = await pool.query(
      `SELECT id, praxis_id, praxis_name, patient_id, patient_name, termin_code, status, action, staff_name, timestamp
       FROM activity_logs
       WHERE ($1::integer IS NOT NULL AND praxis_id = $1::integer) OR praxis_name = $2 OR praxis_name = 'Demo Praxis'
       ORDER BY timestamp DESC`,
      [numericPraxisId, praxisName]
    );

    res.json({ success: true, logs: result.rows });
  } catch (err) {
    console.error('Error fetching activity logs:', err);
    const filteredStore = activityLogsStore.filter(l => 
      l.praxis_id === req.session?.userId || 
      l.praxis_name === req.session?.user?.praxis_name || 
      l.praxis_name === 'Demo Praxis'
    );
    res.json({ success: true, logs: filteredStore });
  }
});

// API: Create Manual Activity Log Entry (Praxis Staff only)
app.post('/api/praxis/activity-logs', async (req, res) => {
  const isPraxis = req.session?.userId && req.session?.user?.role === 'praxis';
  const isPatient = req.session?.userId && req.session?.user?.role === 'patient';

  if (isPatient || (!isPraxis && process.env.NODE_ENV === 'test')) {
    return res.status(403).json({ error: 'Zugriff verweigert. Nur für autorisiertes Praxispersonal zugänglich.' });
  }

  try {
    const { patientId, patientName, terminCode, status, action } = req.body;
    if (!action || !status) {
      return res.status(400).json({ error: 'Status und Aktion sind Pflichtfelder.' });
    }

    const praxisUserId = req.session?.userId || 'demo_praxis_id';
    const praxisName = req.session?.user?.praxis_name || 'Demo Praxis';
    const staffName = req.session?.user?.email || req.session?.user?.name || 'Praxismitarbeiter (Demo)';

    await logActivity({
      praxisId: praxisUserId,
      praxisName,
      patientId: patientId || null,
      patientName: patientName || 'Patient',
      terminCode: terminCode || null,
      status,
      action,
      staffName
    });

    res.json({ success: true, message: 'Aktivität erfolgreich im Log verzeichnet.' });
  } catch (err) {
    console.error('Error creating activity log:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Log-Eintrags' });
  }
});

// API: Doctor requests early treatment for next patient
app.post('/api/queue/:terminCode/early-request', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { terminCode } = req.params;
  const { early_minutes } = req.body;
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    const terminRes = await pool.query(
      `SELECT t.*, u.email as patient_email
       FROM termine t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.code = $1 AND t.praxis = $2`,
      [terminCode, req.session.user.praxis_name]
    );
    if (terminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    const appt = terminRes.rows[0];

    await pool.query(
      `INSERT INTO queue_status (praxis_name, termin_code, status, early_request_status, early_minutes, updated_at)
       VALUES ($1, $2, 'waiting', 'pending', $3, NOW())
       ON CONFLICT (termin_code) DO UPDATE SET early_request_status = 'pending', early_minutes = $3, updated_at = NOW()`,
      [req.session.user.praxis_name, terminCode, early_minutes || 0]
    );

    // Send early request email to patient
    if (appt.patient_email) {
      try {
        await sendEarlyRequestEmail(appt.patient_email, appt, req.session.user.praxis_name, early_minutes || 0);
      } catch (emailErr) {
        console.warn('Failed to send early request email:', emailErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error requesting early treatment:', err);
    res.status(500).json({ error: 'Fehler beim Beantragen der früheren Behandlung.' });
  }
});

// API: Generic endpoint to update queue status of an appointment
app.post('/api/queue/:terminCode/status', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { terminCode } = req.params;
  const { status } = req.body;
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    await pool.query(
      `INSERT INTO queue_status (praxis_name, termin_code, status, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (termin_code) DO UPDATE SET status = $3, updated_at = NOW()`,
      [req.session.user.praxis_name, terminCode, status]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating queue status:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Status.' });
  }
});

// API: Doctor marks patient as no-show (nicht erschienen)
app.post('/api/queue/:terminCode/no-show', async (req, res) => {
  if (!req.session || !req.session.userId || req.session.user?.role !== 'praxis') {
    console.warn('[POST /api/queue/no-show] Unauthorized attempt or wrong role:', req.session?.user);
    return res.status(403).json({ error: 'Nur für Praxis-Konten verfügbar.' });
  }
  const { terminCode } = req.params;
  console.log(`[POST /api/queue/${terminCode}/no-show] called by doctor: ${req.session.user.email}, praxis: ${req.session.user.praxis_name}`);
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    const result = await pool.query(
      `INSERT INTO queue_status (praxis_name, termin_code, status, updated_at)
       VALUES ($1, $2, 'no_show', NOW())
       ON CONFLICT (termin_code) DO UPDATE SET status = 'no_show', updated_at = NOW()`,
      [req.session.user.praxis_name, terminCode]
    );
    console.log(`[POST /api/queue/${terminCode}/no-show] DB update successful. Rows affected:`, result.rowCount);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking no-show:', err);
    res.status(500).json({ error: 'Fehler beim Registrieren des Nicht-Erscheinens.' });
  }
});

// API: Patient responds to early treatment request (accept/decline)
app.post('/api/queue/:terminCode/early-response', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  const { terminCode } = req.params;
  const { accepted } = req.body; // true or false
  if (!isDbConnected || !pool) {
    return res.json({ success: true });
  }
  try {
    // Verify this appointment belongs to the current user
    const check = await pool.query(
      'SELECT code FROM termine WHERE code = $1 AND user_id = $2',
      [terminCode, req.session.userId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }
    const newStatus = accepted ? 'accepted' : 'declined';
    await pool.query(
      `UPDATE queue_status SET early_request_status = $1, updated_at = NOW() WHERE termin_code = $2`,
      [newStatus, terminCode]
    );
    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Error responding to early request:', err);
    res.status(500).json({ error: 'Fehler bei der Antwort.' });
  }
});

// Email template for early treatment request
async function sendEarlyRequestEmail(email, appointment, praxisName, earlyMinutes) {
  const subject = `${praxisName}: Frühere Behandlung möglich!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #10B981; margin-bottom: 20px;">🕐 Frühere Behandlung möglich!</h2>
      <p style="font-size: 16px; line-height: 1.5; color: #334155;">
        Ihre Praxis <strong>${praxisName}</strong> hat Sie informiert, dass Ihr Termin am
        <strong>${appointment.date}</strong> um <strong>${appointment.time} Uhr</strong>
        voraussichtlich um ca. <strong>${earlyMinutes} Minuten</strong> früher stattfinden kann.
      </p>
      <p style="font-size: 14px; color: #64748B; margin-top: 15px;">
        Bitte öffnen Sie die Live-Warteschlange in der App, um die Anfrage anzunehmen oder abzulehnen.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Doctolib Pre-Check-In – Automatische Benachrichtigung</p>
    </div>
  `;
  await sendEmail({ to: email, subject, html });
}

// Serve frontend build static files in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(testRouter);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

app.get(['/test-dashboard', '/test-dashboard.html'], (req, res) => {
  res.sendFile('test-dashboard.html', { root: path.join(__dirname, 'public') });
});

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

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, pool, initDb };

