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
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'patient';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS praxis_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS praxis_fachbereich VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS praxis_adresse VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS praxis_telefon VARCHAR(50);
    `);
    console.log('Table "users" verified/created with profile and role columns.');

    // Ensure user_id, notify_email and notify_sent columns exist on termine table
    await pool.query(`
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS notify_email VARCHAR(255);
      ALTER TABLE termine ADD COLUMN IF NOT EXISTS notify_sent BOOLEAN DEFAULT FALSE;
    `);

    // Ensure custom_answers exists in precheckins
    await pool.query(`
      ALTER TABLE precheckins ADD COLUMN IF NOT EXISTS custom_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
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

    // Remove the demo user if it exists to allow only custom testing
    await pool.query("DELETE FROM users WHERE email = 'max@doctolib.de'");
    console.log('Demo user max@doctolib.de verified removed from database.');

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
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' });
    }

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
      krankenkasse: user.krankenkasse,
      role: user.role,
      praxis_name: user.praxis_name,
      praxis_fachbereich: user.praxis_fachbereich,
      praxis_adresse: user.praxis_adresse,
      praxis_telefon: user.praxis_telefon
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
      `SELECT id, email, password_hash, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, role, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon 
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
      krankenkasse: user.krankenkasse,
      role: user.role,
      praxis_name: user.praxis_name,
      praxis_fachbereich: user.praxis_fachbereich,
      praxis_adresse: user.praxis_adresse,
      praxis_telefon: user.praxis_telefon
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
        'SELECT id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, role, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon FROM users WHERE id = $1',
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

  const { vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon } = req.body;

  if (!vorname || !nachname) {
    return res.status(400).json({ error: 'Vorname und Nachname sind erforderlich.' });
  }

  if (!isDbConnected || !pool) {
    return res.status(500).json({ error: 'Datenbank nicht verfügbar.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users 
       SET vorname = $1, nachname = $2, geburtsdatum = $3, telefonnummer = $4, strasse_hnr = $5, plz_ort = $6, krankenversicherung = $7, krankenkasse = $8, praxis_name = $9, praxis_fachbereich = $10, praxis_adresse = $11, praxis_telefon = $12 
       WHERE id = $13 
       RETURNING id, email, vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, role, praxis_name, praxis_fachbereich, praxis_adresse, praxis_telefon`,
      [vorname, nachname, geburtsdatum, telefonnummer, strasse_hnr, plz_ort, krankenversicherung, krankenkasse, praxis_name || null, praxis_fachbereich || null, praxis_adresse || null, praxis_telefon || null, req.session.userId]
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
    // Block if same praxis OR same user (excluding excludeCode)
    const matches = (req.session.mockAppointments || [])
      .filter(appt => appt.date === date && appt.code !== excludeCode && (appt.praxis === praxis || (userId && appt.user_id === userId)))
      .map(appt => appt.time);
    return res.json({ blocked: matches });
  }

  try {
    // Get slots where praxis is same (booked by anyone) OR user_id is current user (booked by this user), excluding current appointment
    const result = await pool.query(
      'SELECT time FROM termine WHERE date = $1 AND (praxis = $2 OR user_id = $3) AND code != $4',
      [date, praxis, userId || -1, excludeCode || '']
    );
    const blockedSlots = result.rows.map(row => row.time);
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

  if (!isDbConnected || !pool) {
    // Check if slot already booked in mockAppointments for this praxis
    const existing = (req.session.mockAppointments || []).find(
      appt => appt.date === date && appt.time === time && appt.praxis === praxis
    );
    if (existing) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist bereits vergeben.' });
    }

    // Check if user already has an appointment at this time
    const userExisting = (req.session.mockAppointments || []).find(
      appt => appt.date === date && appt.time === time && appt.user_id === req.session.userId
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
      'SELECT code FROM termine WHERE date = $1 AND time = $2 AND praxis = $3',
      [date, time, praxis]
    );
    if (blockCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist bereits vergeben.' });
    }

    // Check if user already has an appointment at this time
    const userBlockCheck = await pool.query(
      'SELECT code FROM termine WHERE date = $1 AND time = $2 AND user_id = $3',
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
      a => a.date === date && a.time === time && a.praxis === appt.praxis && a.code !== code
    );
    if (existing) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist bereits vergeben.' });
    }

    // Check if user already has another appointment at this time
    const userExisting = req.session.mockAppointments.find(
      a => a.date === date && a.time === time && a.user_id === req.session.userId && a.code !== code
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
      'SELECT code FROM termine WHERE date = $1 AND time = $2 AND praxis = $3 AND code != $4',
      [date, time, praxisName, code]
    );
    if (blockCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Dieser Termin-Slot ist bereits vergeben.' });
    }

    // Check if user already has another appointment at this time
    const userBlockCheck = await pool.query(
      'SELECT code FROM termine WHERE date = $1 AND time = $2 AND user_id = $3 AND code != $4',
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
    req.session.mockAppointments.splice(idx, 1);
    return res.json({ success: true });
  }

  try {
    const result = await pool.query(
      'DELETE FROM termine WHERE code = $1 AND user_id = $2',
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
      'SELECT session_id, termin_code, beschwerden, medikamente, allergien, dokumente, signature_data, current_step, submitted, custom_answers FROM precheckins WHERE termin_code = $1',
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
        customAnswers: row.custom_answers || {}
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
  const { sessionId, terminCode, beschwerden, medikamente, allergien, dokumente, signatureData, currentStep, submitted, customAnswers } = req.body;

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
      `INSERT INTO precheckins (termin_code, session_id, beschwerden, medikamente, allergien, dokumente, signature_data, current_step, submitted, custom_answers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
         custom_answers = EXCLUDED.custom_answers,
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
        JSON.stringify(customAnswers || {})
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

// Start background worker to check notifications every 10 seconds
setInterval(checkAndSendNotifications, 10000);

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
              p.beschwerden, p.medikamente, p.allergien, p.dokumente, p.signature_data, p.custom_answers
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

    res.json({
      success: true,
      details: {
        termin,
        patientProfile,
        doctorNote,
        patientHints
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

    // Send email if patient has an email
    if (appt.patient_email) {
      try {
        await sendHintEmail(appt.patient_email, appt, hints || [], custom_text || '', req.session.user.praxis_name);
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
      if (terminRes.rows.length > 0 && terminRes.rows[0].patient_email) {
        try {
          await sendHintEmail(terminRes.rows[0].patient_email, terminRes.rows[0], hints || [], custom_text || '', req.session.user.praxis_name);
          await pool.query('UPDATE patient_hints SET email_sent = TRUE WHERE id = $1', [hintId]);
        } catch (emailErr) {
          console.error('Failed to resend hint email:', emailErr);
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
