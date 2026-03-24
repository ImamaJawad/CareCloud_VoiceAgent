require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const pool    = require('./db');

const patientsRouter = require('./routes/patients');
const vapiRouter     = require('./webhooks/vapi');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Routes
app.use('/patients', patientsRouter);
app.use('/webhook/vapi', vapiRouter);

// 404
app.use((req, res) => res.status(404).json({ data: null, error: 'Not found' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  // Test DB connection on startup
  try {
    await pool.query('SELECT 1');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Database connected`);
  } catch (e) {
    console.error('❌ DB connection failed:', e.message);
  }
});