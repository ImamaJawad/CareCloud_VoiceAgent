# CareCloud Patient Registration System

## Live Demo
**Phone Number:** +1 (323) 618-2132
**API Base URL:** https://carecloud-voiceagent.onrender.com

## How It Works
Patient calls the phone number → speaks naturally → gets registered in the system

## Tech Stack
- **Voice:** Vapi (STT/TTS)
- **AI:** GPT-4o
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (Neon)
- **Hosting:** Render

## API Endpoints
- `GET /patients` — List all patients
- `GET /patients/:id` — Get patient by ID
- `POST /patients` — Create patient
- `PUT /patients/:id` — Update patient
- `DELETE /patients/:id` — Soft delete

## Test the API
```bash
curl https://carecloud-voiceagent.onrender.com/patients
```

Expected response:
```json
{
"data": [
{
"patient_id": "...",
"first_name": "Jane",
"last_name": "Doe",
...
}
],
"error": null
}
```

## Test by Phone
Call +1 (323) 618-2132 and follow the prompts.

## Architecture
1. Patient calls Vapi phone number
2. Vapi transcribes speech to text
3. GPT-4o understands intent
4. Vapi calls your `/webhook/vapi` endpoint
5. Backend validates and saves to PostgreSQL
6. Response sent back to caller

## Known Limitations
- Phone number validation is basic (10 digits)
- No HIPAA logging yet (would add for production)
- No authentication (would add for production)

## Next Steps for Production
- Add HIPAA-compliant audit logging
- Add patient authentication/login
- Add web dashboard for doctors
- Migrate to managed PostgreSQL with backups

## Security Notes
- Phone numbers are validated but not encrypted (would add for production)
- No audit logging yet (required for HIPAA compliance)
- For production deployment would need:
  - Encryption at rest and in transit
  - Audit logs for all patient data access
  - Role-based access control
  - Regular security audits
