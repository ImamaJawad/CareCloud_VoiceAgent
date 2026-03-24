const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('../db');

// Helper: format response envelope
const ok = (res, data, status = 200) => res.status(status).json({ data, error: null });
const fail = (res, message, status = 400) => res.status(status).json({ data: null, error: message });

// Helper: handle validation errors
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array().map(e => e.msg).join(', '), 422);
  next();
}

// ── GET /patients ──────────────────────────────────────────────────────────────
router.get('/', [
  query('last_name').optional().isString().trim(),
  query('date_of_birth').optional().isDate(),
  query('phone_number').optional().isString().trim(),
  validate,
], async (req, res) => {
  try {
    const { last_name, date_of_birth, phone_number } = req.query;
    const conditions = ['deleted_at IS NULL'];
    const values = [];
    let i = 1;

    if (last_name)     { conditions.push(`last_name ILIKE $${i++}`);      values.push(`%${last_name}%`); }
    if (date_of_birth) { conditions.push(`date_of_birth = $${i++}`);      values.push(date_of_birth); }
    if (phone_number)  { conditions.push(`phone_number = $${i++}`);       values.push(phone_number.replace(/\D/g, '')); }

    const { rows } = await pool.query(
      `SELECT * FROM patients WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      values
    );
    ok(res, rows);
  } catch (e) {
    console.error(e);
    fail(res, 'Server error', 500);
  }
});

// ── GET /patients/:id ──────────────────────────────────────────────────────────
router.get('/:id', [
  param('id').isUUID(),
  validate,
], async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM patients WHERE patient_id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows.length) return fail(res, 'Patient not found', 404);
    ok(res, rows[0]);
  } catch (e) {
    fail(res, 'Server error', 500);
  }
});

// ── POST /patients ─────────────────────────────────────────────────────────────
const patientValidators = [
  body('first_name').trim().matches(/^[A-Za-z\-']{1,50}$/).withMessage('Invalid first_name'),
  body('last_name').trim().matches(/^[A-Za-z\-']{1,50}$/).withMessage('Invalid last_name'),
  body('date_of_birth').isDate().custom(v => new Date(v) <= new Date()).withMessage('date_of_birth must be in the past'),
  body('sex').isIn(['Male','Female','Other','Decline to Answer']).withMessage('Invalid sex'),
  body('phone_number').matches(/^\d{10}$/).withMessage('phone_number must be 10 digits'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
  body('address_line_1').trim().notEmpty().withMessage('address_line_1 required'),
  body('city').trim().isLength({ min: 1, max: 100 }),
  body('state').matches(/^[A-Z]{2}$/).withMessage('state must be 2-letter abbreviation'),
  body('zip_code').matches(/^\d{5}(-\d{4})?$/).withMessage('Invalid zip_code'),
  body('emergency_contact_phone').optional({ nullable: true }).matches(/^\d{10}$/).withMessage('emergency_contact_phone must be 10 digits'),
];

router.post('/', [...patientValidators, validate], async (req, res) => {
  try {
    const {
      first_name, last_name, date_of_birth, sex, phone_number,
      email, address_line_1, address_line_2, city, state, zip_code,
      insurance_provider, insurance_member_id, preferred_language,
      emergency_contact_name, emergency_contact_phone,
    } = req.body;

    // Duplicate check by phone
    const existing = await pool.query(
      'SELECT patient_id, first_name, last_name FROM patients WHERE phone_number = $1 AND deleted_at IS NULL',
      [phone_number]
    );
    if (existing.rows.length) {
      return res.status(409).json({
        data: existing.rows[0],
        error: 'duplicate',
        message: `Record exists for ${existing.rows[0].first_name} ${existing.rows[0].last_name}`,
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO patients
        (first_name, last_name, date_of_birth, sex, phone_number,
         email, address_line_1, address_line_2, city, state, zip_code,
         insurance_provider, insurance_member_id, preferred_language,
         emergency_contact_name, emergency_contact_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [first_name, last_name, date_of_birth, sex, phone_number,
       email || null, address_line_1, address_line_2 || null, city, state, zip_code,
       insurance_provider || null, insurance_member_id || null,
       preferred_language || 'English', emergency_contact_name || null,
       emergency_contact_phone || null]
    );
    console.log('[PATIENT CREATED]', JSON.stringify(rows[0]));
    ok(res, rows[0], 201);
  } catch (e) {
    console.error(e);
    fail(res, 'Server error', 500);
  }
});

// ── PUT /patients/:id ──────────────────────────────────────────────────────────
router.put('/:id', [param('id').isUUID(), validate], async (req, res) => {
  try {
    const allowed = [
      'first_name','last_name','date_of_birth','sex','phone_number','email',
      'address_line_1','address_line_2','city','state','zip_code',
      'insurance_provider','insurance_member_id','preferred_language',
      'emergency_contact_name','emergency_contact_phone',
    ];
    const fields = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return fail(res, 'No valid fields to update', 400);

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = [req.params.id, ...fields.map(f => req.body[f])];

    const { rows } = await pool.query(
      `UPDATE patients SET ${setClause} WHERE patient_id = $1 AND deleted_at IS NULL RETURNING *`,
      values
    );
    if (!rows.length) return fail(res, 'Patient not found', 404);
    ok(res, rows[0]);
  } catch (e) {
    fail(res, 'Server error', 500);
  }
});

// ── DELETE /patients/:id (soft) ────────────────────────────────────────────────
router.delete('/:id', [param('id').isUUID(), validate], async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE patients SET deleted_at = NOW() WHERE patient_id = $1 AND deleted_at IS NULL RETURNING patient_id',
      [req.params.id]
    );
    if (!rows.length) return fail(res, 'Patient not found', 404);
    ok(res, { deleted: true, patient_id: rows[0].patient_id });
  } catch (e) {
    fail(res, 'Server error', 500);
  }
});

module.exports = router;