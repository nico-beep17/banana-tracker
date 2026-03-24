-- =============================================
-- LAVC ERP — Fix Empty Farms/Data on APK
-- 
-- PROBLEM: RLS may be enabled on tables like
-- `farms`, `arrivals`, etc., but no policies
-- allow authenticated users to read them. On
-- APK the auth header sometimes detaches 
-- silently, causing RLS to block reads → empty
-- dropdowns and lists.
--
-- FIX: Make all operational data tables readable
-- by ANY authenticated user (anon is still blocked).
-- Write access is still restricted per operation.
--
-- HOW TO RUN:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your LAVC project
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Paste this entire script and click "Run"
-- =============================================

-- ─── FARMS TABLE ───────────────────────────────
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read farms" ON public.farms;
CREATE POLICY "Authenticated users can read farms"
  ON public.farms FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert farms" ON public.farms;
CREATE POLICY "Authenticated users can insert farms"
  ON public.farms FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update farms" ON public.farms;
CREATE POLICY "Authenticated users can update farms"
  ON public.farms FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete farms" ON public.farms;
CREATE POLICY "Authenticated users can delete farms"
  ON public.farms FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── ARRIVALS TABLE ────────────────────────────
ALTER TABLE public.arrivals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read arrivals" ON public.arrivals;
CREATE POLICY "Authenticated users can read arrivals"
  ON public.arrivals FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert arrivals" ON public.arrivals;
CREATE POLICY "Authenticated users can insert arrivals"
  ON public.arrivals FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update arrivals" ON public.arrivals;
CREATE POLICY "Authenticated users can update arrivals"
  ON public.arrivals FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete arrivals" ON public.arrivals;
CREATE POLICY "Authenticated users can delete arrivals"
  ON public.arrivals FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── SAMPLINGS TABLE ───────────────────────────
ALTER TABLE public.samplings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read samplings" ON public.samplings;
CREATE POLICY "Authenticated users can read samplings"
  ON public.samplings FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert samplings" ON public.samplings;
CREATE POLICY "Authenticated users can insert samplings"
  ON public.samplings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update samplings" ON public.samplings;
CREATE POLICY "Authenticated users can update samplings"
  ON public.samplings FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete samplings" ON public.samplings;
CREATE POLICY "Authenticated users can delete samplings"
  ON public.samplings FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── CONTAINERS TABLE ──────────────────────────
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read containers" ON public.containers;
CREATE POLICY "Authenticated users can read containers"
  ON public.containers FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert containers" ON public.containers;
CREATE POLICY "Authenticated users can insert containers"
  ON public.containers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update containers" ON public.containers;
CREATE POLICY "Authenticated users can update containers"
  ON public.containers FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete containers" ON public.containers;
CREATE POLICY "Authenticated users can delete containers"
  ON public.containers FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── WEEKLY_RATES TABLE ────────────────────────
ALTER TABLE public.weekly_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read weekly_rates" ON public.weekly_rates;
CREATE POLICY "Authenticated users can read weekly_rates"
  ON public.weekly_rates FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert weekly_rates" ON public.weekly_rates;
CREATE POLICY "Authenticated users can insert weekly_rates"
  ON public.weekly_rates FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update weekly_rates" ON public.weekly_rates;
CREATE POLICY "Authenticated users can update weekly_rates"
  ON public.weekly_rates FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete weekly_rates" ON public.weekly_rates;
CREATE POLICY "Authenticated users can delete weekly_rates"
  ON public.weekly_rates FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── VERIFY: List all policies created ─────────
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('farms','arrivals','samplings','containers','weekly_rates')
ORDER BY tablename, cmd;
-- Run this inside the Supabase SQL Editor to enable true cloud syncing for the Materials Inventory Deliveries!

CREATE TABLE IF NOT EXISTS material_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TEXT NOT NULL,
    "farmCode" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    "referenceNo" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE material_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read material_deliveries" 
ON material_deliveries FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert material_deliveries" 
ON material_deliveries FOR INSERT 
TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated update material_deliveries" 
ON material_deliveries FOR UPDATE 
TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete material_deliveries" 
ON material_deliveries FOR DELETE 
TO authenticated USING (true);
