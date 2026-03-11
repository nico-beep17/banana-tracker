-- Patch: Add grossWeight and netWeight columns to containers table
-- Run this in Supabase SQL Editor

ALTER TABLE public.containers ADD COLUMN IF NOT EXISTS "grossWeight" NUMERIC;
ALTER TABLE public.containers ADD COLUMN IF NOT EXISTS "netWeight" NUMERIC;
ALTER TABLE public.containers ADD COLUMN IF NOT EXISTS "ventilation" TEXT;
ALTER TABLE public.containers ADD COLUMN IF NOT EXISTS "dateDeparted" DATE;
ALTER TABLE public.containers ADD COLUMN IF NOT EXISTS "transit_status" TEXT DEFAULT 'PENDING';
ALTER TABLE public.containers ADD COLUMN IF NOT EXISTS "transit_updated_at" TIMESTAMP WITH TIME ZONE;
