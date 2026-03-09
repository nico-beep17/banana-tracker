const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
    console.log('Creating Payroll & HR tables...');

    // Use the Supabase REST API to run SQL via the rpc or direct table creation
    // Since we have service role key, we can use the management API

    // Try to create tables by inserting a test record and seeing if table exists
    // First check if employees table exists
    const { data: empCheck, error: empError } = await supabase.from('employees').select('id').limit(1);

    if (empError && empError.code === '42P01') {
        console.log('employees table does not exist - need to create via SQL Editor');
        console.log('ERROR: Cannot create tables via the Supabase JS client.');
        console.log('You must run the SQL in the Supabase Dashboard SQL Editor.');
        return;
    } else if (empError && empError.message.includes('404')) {
        console.log('employees table not found (404). Creating via REST...');
    } else if (!empError) {
        console.log('✅ employees table already exists!');
    } else {
        console.log('employees check error:', empError.message, empError.code);
    }

    // Check dtr_records
    const { error: dtrError } = await supabase.from('dtr_records').select('id').limit(1);
    if (!dtrError) {
        console.log('✅ dtr_records table already exists!');
    } else {
        console.log('dtr_records check:', dtrError.message, dtrError.code);
    }

    // Check attendance_locations
    const { error: locError } = await supabase.from('attendance_locations').select('id').limit(1);
    if (!locError) {
        console.log('✅ attendance_locations table already exists!');
    } else {
        console.log('attendance_locations check:', locError.message, locError.code);
    }

    // Check accounting_periods
    const { error: apError } = await supabase.from('accounting_periods').select('id').limit(1);
    if (!apError) {
        console.log('✅ accounting_periods table already exists!');
    } else {
        console.log('accounting_periods check:', apError.message, apError.code);
    }

    // Try to use the SQL endpoint directly
    console.log('\nAttempting to create tables via Supabase SQL endpoint...');

    const sql = `
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  department text,
  role text,
  employment_status text DEFAULT 'ACTIVE',
  basic_rate numeric DEFAULT 0,
  rate_type text DEFAULT 'DAILY',
  bank_account_no text,
  sss_no text, phic_no text, hdmf_no text, tin_no text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dtr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  record_date date NOT NULL,
  regular_hours numeric DEFAULT 8,
  overtime_hours numeric DEFAULT 0,
  status text DEFAULT 'PRESENT',
  time_in timestamptz, time_out timestamptz,
  latitude_in numeric, longitude_in numeric,
  latitude_out numeric, longitude_out numeric,
  location_id_in uuid, location_id_out uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  radius_meters numeric DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
  `;

    // Use the Supabase REST /sql endpoint (requires service role)
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
        console.log('✅ Tables created successfully!');
    } else {
        const text = await response.text();
        console.log('RPC attempt result:', response.status, text);

        // Try the management API
        console.log('\nTrying management API...');
        const mgmtResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
            },
        });
        const mgmtText = await mgmtResponse.text();
        console.log('Management API:', mgmtResponse.status);
    }
}

setup().catch(console.error);
