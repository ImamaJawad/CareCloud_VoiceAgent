CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE patients (
  patient_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name          VARCHAR(50)  NOT NULL CHECK (first_name ~ '^[A-Za-z\-'']{1,50}$'),
  last_name           VARCHAR(50)  NOT NULL CHECK (last_name  ~ '^[A-Za-z\-'']{1,50}$'),
  date_of_birth       DATE         NOT NULL CHECK (date_of_birth <= CURRENT_DATE),
  sex                 VARCHAR(20)  NOT NULL CHECK (sex IN ('Male','Female','Other','Decline to Answer')),
  phone_number        CHAR(10)     NOT NULL CHECK (phone_number ~ '^\d{10}$'),
  email               VARCHAR(255) CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  address_line_1      VARCHAR(255) NOT NULL,
  address_line_2      VARCHAR(255),
  city                VARCHAR(100) NOT NULL,
  state               CHAR(2)      NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  zip_code            VARCHAR(10)  NOT NULL CHECK (zip_code ~ '^\d{5}(-\d{4})?$'),
  insurance_provider  VARCHAR(100),
  insurance_member_id VARCHAR(50),
  preferred_language  VARCHAR(50)  DEFAULT 'English',
  emergency_contact_name  VARCHAR(100),
  emergency_contact_phone CHAR(10) CHECK (emergency_contact_phone ~ '^\d{10}$'),
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed data
INSERT INTO patients (
  first_name, last_name, date_of_birth, sex, phone_number,
  email, address_line_1, city, state, zip_code
) VALUES
  ('Jane', 'Doe', '1985-04-12', 'Female', '5551234567',
   'jane.doe@email.com', '123 Main St', 'Austin', 'TX', '78701'),
  ('John', 'Smith', '1990-11-30', 'Male', '5559876543',
   NULL, '456 Oak Ave', 'Chicago', 'IL', '60601');