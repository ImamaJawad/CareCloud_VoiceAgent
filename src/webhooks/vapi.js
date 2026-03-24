const express = require('express');
const router = express.Router();
const pool = require('../db');

// Vapi sends POST to this endpoint for function tool calls
router.post('/', async (req, res) => {
  const { message } = req.body;

  // Handle tool calls from GPT-4o via Vapi
  if (message?.type === 'tool-calls') {
    const toolCall = message.toolCallList?.[0];
    const fnName = toolCall?.function?.name;
    const args = toolCall?.function?.arguments
  ? (typeof toolCall.function.arguments === 'string' 
      ? JSON.parse(toolCall.function.arguments) 
      : toolCall.function.arguments)
  : {};

    console.log(`[TOOL CALL] ${fnName}`, args);

    try {
      if (fnName === 'create_patient') {
        // Duplicate check first
        const existing = await pool.query(
          'SELECT patient_id, first_name, last_name FROM patients WHERE phone_number = $1 AND deleted_at IS NULL',
          [args.phone_number]
        );
        if (existing.rows.length) {
          const p = existing.rows[0];
          return res.json({
            results: [{
              toolCallId: toolCall.id,
              result: JSON.stringify({
                status: 'duplicate',
                patient_id: p.patient_id,
                message: `We already have a record for ${p.first_name} ${p.last_name}. Would you like to update your information instead?`,
              }),
            }],
          });
        }

        const { rows } = await pool.query(
          `INSERT INTO patients
            (first_name, last_name, date_of_birth, sex, phone_number,
             email, address_line_1, address_line_2, city, state, zip_code,
             insurance_provider, insurance_member_id, preferred_language,
             emergency_contact_name, emergency_contact_phone)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           RETURNING patient_id, first_name, last_name`,
          [
            args.first_name, args.last_name, args.date_of_birth, args.sex,
            args.phone_number, args.email || null,
            args.address_line_1, args.address_line_2 || null,
            args.city, args.state, args.zip_code,
            args.insurance_provider || null, args.insurance_member_id || null,
            args.preferred_language || 'English',
            args.emergency_contact_name || null, args.emergency_contact_phone || null,
          ]
        );
        console.log('[PATIENT SAVED]', rows[0]);
        return res.json({
          results: [{
            toolCallId: toolCall.id,
            result: JSON.stringify({
              status: 'success',
              patient_id: rows[0].patient_id,
              message: `Registration complete. Your patient ID is ${rows[0].patient_id}.`,
            }),
          }],
        });
      }

      if (fnName === 'update_patient') {
        const { patient_id, ...updates } = args;
        const allowed = [
          'first_name','last_name','date_of_birth','sex','phone_number','email',
          'address_line_1','address_line_2','city','state','zip_code',
          'insurance_provider','insurance_member_id','preferred_language',
          'emergency_contact_name','emergency_contact_phone',
        ];
        const fields = Object.keys(updates).filter(k => allowed.includes(k));
        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        await pool.query(
          `UPDATE patients SET ${setClause} WHERE patient_id = $1`,
          [patient_id, ...fields.map(f => updates[f])]
        );
        return res.json({
          results: [{ toolCallId: toolCall.id, result: JSON.stringify({ status: 'updated' }) }],
        });
      }

      if (fnName === 'check_existing_patient') {
        const { rows } = await pool.query(
          'SELECT patient_id, first_name, last_name FROM patients WHERE phone_number = $1 AND deleted_at IS NULL',
          [args.phone_number]
        );
        return res.json({
          results: [{
            toolCallId: toolCall.id,
            result: JSON.stringify(rows.length ? { found: true, ...rows[0] } : { found: false }),
          }],
        });
      }
    } catch (e) {
      console.error('[WEBHOOK ERROR]', e);
      return res.json({
        results: [{
          toolCallId: toolCall?.id,
          result: JSON.stringify({ status: 'error', message: 'Database error. Please try again.' }),
        }],
      });
    }
  }

  res.sendStatus(200);
});

module.exports = router;