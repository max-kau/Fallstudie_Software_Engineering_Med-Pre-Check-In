import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Database connection pool setup
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

// Initialize database tables
async function initDb() {
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

    // 2. Create pre-check-ins table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS precheckins (
        session_id VARCHAR(100) PRIMARY KEY,
        termin_code VARCHAR(50) REFERENCES termine(code) ON DELETE CASCADE,
        beschwerden JSONB NOT NULL,
        medikamente JSONB NOT NULL,
        allergien JSONB NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "precheckins" verified/created.');
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
}

// Initialize tables on startup
await initDb();

// API: Get appointment info (or auto-seed if it doesn't exist)
app.get('/api/termin/:code', async (req, res) => {
  const { code } = req.params;

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

// API: Submit pre-check-in data
app.post('/api/precheckin', async (req, res) => {
  const { sessionId, terminCode, beschwerden, medikamente, allergien } = req.body;

  if (!sessionId || !terminCode) {
    return res.status(400).json({ error: 'Missing required fields: sessionId and terminCode' });
  }

  try {
    // Save to database, upsert if the session already exists
    await pool.query(
      `INSERT INTO precheckins (session_id, termin_code, beschwerden, medikamente, allergien)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id)
       DO UPDATE SET
         termin_code = EXCLUDED.termin_code,
         beschwerden = EXCLUDED.beschwerden,
         medikamente = EXCLUDED.medikamente,
         allergien = EXCLUDED.allergien,
         submitted_at = CURRENT_TIMESTAMP`,
      [
        sessionId,
        terminCode,
        JSON.stringify(beschwerden),
        JSON.stringify(medikamente),
        JSON.stringify(allergien)
      ]
    );

    console.log(`Pre-check-in saved/updated for session: ${sessionId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving pre-check-in:', err);
    res.status(500).json({ error: 'Database save error' });
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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
