-- Add missing seal time tracking column based on App.jsx state management
ALTER TABLE public.containers ADD COLUMN IF NOT EXISTS "timeSealed" TIMESTAMP WITH TIME ZONE;
