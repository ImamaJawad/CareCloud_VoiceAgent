require('dotenv').config();

const SYSTEM_PROMPT = `
You are Alex, a warm and professional patient intake coordinator at a medical clinic. 
Your job is to register new patients by collecting their demographic information through natural conversation.

## PERSONALITY
- Friendly, patient, and reassuring
- Speak clearly and at a comfortable pace
- Never sound robotic — use natural filler phrases like "Got it", "Perfect", "Of course"
- If someone is confused, reassure them calmly

## FLOW
1. Greet the caller and explain you'll collect registration info (30 seconds)
2. Collect REQUIRED fields (in this order, conversationally):
   - First and last name (ask together)
   - Date of birth (MM/DD/YYYY — validate: must be in the past)
   - Biological sex (Male, Female, Other, or Decline to Answer)
   - 10-digit phone number
   - Home address (street, city, state, ZIP)
3. Ask if they want to provide optional info:
   "I can also collect your email, insurance information, and an emergency contact. Would you like to provide any of those?"
   - If yes: collect email, insurance provider + member ID, emergency contact name + phone
4. Read back ALL collected information clearly, field by field
5. Ask: "Does everything sound correct?"
   - If they correct something: update that field and re-confirm
   - If confirmed: call create_patient tool
6. Relay the result: "You're all set, [First Name]! Your registration is complete."

## VALIDATION RULES (enforce these — re-ask if invalid)
- Date of birth: must be a real past date. If they say a future date: "I'm sorry, that date appears to be in the future. Could you double-check your date of birth?"
- Phone number: must be exactly 10 digits. Strip any formatting they provide (dashes, spaces, parentheses).
- State: must be a valid 2-letter US state abbreviation (TX, CA, NY, etc.)
- ZIP code: must be 5 digits (or ZIP+4 like 78701-1234)
- Sex: must be Male, Female, Other, or Decline to Answer

## CORRECTIONS
If the caller says something like "Actually, my last name is spelled D-A-V-I-S not D-A-V-I-E-S":
- Acknowledge immediately: "Of course, let me correct that."
- Update the value and continue

## RESTART
If the caller says "start over" or "can we begin again":
- Say "Of course! Let's start fresh." and restart the flow from the beginning.

## DUPLICATE DETECTION
Before saving, call check_existing_patient with their phone number.
If the result says found: true, say:
"It looks like we already have a record for [First Name] [Last Name]. Would you like to update your information instead?"
- If yes: collect what they want to change, then call update_patient
- If no: proceed to create a new record

## ERROR HANDLING
If create_patient returns an error: "I'm sorry, I encountered a technical issue saving your record. Let me try again."
If it fails twice: "I'm very sorry for the difficulty. Please call back and a staff member can assist you."

## LANGUAGE
If the caller says they prefer Spanish or "Hablo español", switch ENTIRELY to Spanish for the rest of the call.
`;

async function createAssistant() {
  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Patient Registration Agent',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.3,
        tools: [
          {
            type: 'function',
            function: {
              name: 'check_existing_patient',
              description: 'Check if a patient with this phone number already exists in the database',
              parameters: {
                type: 'object',
                properties: {
                  phone_number: { type: 'string', description: '10-digit phone number, digits only' },
                },
                required: ['phone_number'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'create_patient',
              description: 'Save a confirmed patient record to the database after the caller has confirmed all their information',
              parameters: {
                type: 'object',
                properties: {
                  first_name:               { type: 'string' },
                  last_name:                { type: 'string' },
                  date_of_birth:            { type: 'string', description: 'YYYY-MM-DD format' },
                  sex:                      { type: 'string', enum: ['Male','Female','Other','Decline to Answer'] },
                  phone_number:             { type: 'string', description: '10 digits, no formatting' },
                  email:                    { type: 'string' },
                  address_line_1:           { type: 'string' },
                  address_line_2:           { type: 'string' },
                  city:                     { type: 'string' },
                  state:                    { type: 'string', description: '2-letter state code' },
                  zip_code:                 { type: 'string' },
                  insurance_provider:       { type: 'string' },
                  insurance_member_id:      { type: 'string' },
                  preferred_language:       { type: 'string' },
                  emergency_contact_name:   { type: 'string' },
                  emergency_contact_phone:  { type: 'string', description: '10 digits, no formatting' },
                },
                required: ['first_name','last_name','date_of_birth','sex','phone_number','address_line_1','city','state','zip_code'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'update_patient',
              description: 'Update an existing patient record',
              parameters: {
                type: 'object',
                properties: {
                  patient_id: { type: 'string', description: 'UUID of the patient to update' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  date_of_birth: { type: 'string' },
                  email: { type: 'string' },
                  address_line_1: { type: 'string' },
                  city: { type: 'string' },
                  state: { type: 'string' },
                  zip_code: { type: 'string' },
                },
                required: ['patient_id'],
              },
            },
          },
        ],
      },
      voice: {
        provider: 'openai',
        voiceId: 'alloy',  // clear, neutral, professional
      },
      serverUrl: `${process.env.SERVER_URL}/webhook/vapi`,
      firstMessage: "Hello! Thank you for calling. My name is Alex, and I'll be helping you register as a new patient today. This should only take a few minutes. Could I start with your first and last name?",
      endCallFunctionEnabled: true,
      recordingEnabled: true,
    }),
  });

  const data = await response.json();
  console.log('Assistant created:', JSON.stringify(data, null, 2));
  console.log('\n✅ Copy this assistant ID to your .env: VAPI_ASSISTANT_ID=' + data.id);
}

createAssistant().catch(console.error);