import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixContainers() {
    console.log("Checking if RPC exists...");
    const { data, error } = await supabase.rpc('execute_sql', {
        sql_string: 'ALTER TABLE public.containers ADD COLUMN IF NOT EXISTS "timeSealed" TIMESTAMP WITH TIME ZONE;'
    });

    if (error) {
        console.error("RPC 'execute_sql' failed. Likely doesn't exist. Please create an edge function or use the dashboard to run the SQL.");
        console.log(error);
    } else {
        console.log("Column 'timeSealed' added successfully via RPC.");
    }
}

fixContainers();
