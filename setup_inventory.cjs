const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
    console.log('Creating Farm Inventory Transactions table...');

    const { error: existingError } = await supabase.from('farm_inventory_transactions').select('id').limit(1);
    if (!existingError) {
        console.log('✅ farm_inventory_transactions table already exists!');
        return;
    }

    const sql = `
CREATE TABLE IF NOT EXISTS farm_inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_code text NOT NULL,
  type text NOT NULL,
  quantity numeric NOT NULL,
  reference_no text,
  created_at timestamptz DEFAULT now()
);
  `;

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ query: sql })
    });

    console.log('RPC creation status:', response.status);
    console.log(await response.text());
}

setup().catch(console.error);
