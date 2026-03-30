DO $$
DECLARE
    t record;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          -- We EXCLUDE 'profiles' because we already set up a secure, role-based policy for it
          AND tablename != 'profiles'
    LOOP
        -- 1. Enable RLS on the table (if not already enabled)
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);
        
        -- 2. Drop the overly permissive policy if it exists so we can recreate it cleanly
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Allow all on %I" ON public.%I;', t.tablename, t.tablename);
        EXCEPTION WHEN others THEN
            -- Ignore drop errors
        END;

        -- 3. Create a permissive policy allowing ALL operations (INSERT/UPDATE/DELETE/SELECT)
        -- This mirrors the design found in your 'tmp-consignees.sql' setup template
        EXECUTE format('CREATE POLICY "Allow all on %I" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t.tablename, t.tablename);
        
        RAISE NOTICE 'Applied permissive RLS to %', t.tablename;
    END LOOP;
END;
$$;
