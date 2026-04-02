DO 
DECLARE
    t record;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename != 'profiles'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all on %I" ON public.%I;', t.tablename, t.tablename);
        EXECUTE format('CREATE POLICY "Allow all on %I" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t.tablename, t.tablename);
        RAISE NOTICE 'Applied permissive RLS to %', t.tablename;
    END LOOP;
END;
;
