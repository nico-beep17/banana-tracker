import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storage: window.localStorage,       // Explicit — ensures Capacitor WebView uses localStorage
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'lavc-banana-tracker-auth',  // Unique key to avoid conflicts
  },
});
