-- Supabase Auth Schema Setup --

-- 1. Create Profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add Approval columns to Arrivals
ALTER TABLE public.arrivals ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.arrivals ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);

-- Optional: Enable RLS (Row Level Security) - Leaving disabled for now to ensure MVP works
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.arrivals ENABLE ROW LEVEL SECURITY;

-- Note: User creation should happen via the Auth UI or admin script.
-- After a user signs up, a trigger can auto-create their profile, or we can do it client-side.
-- Let's create a trigger to auto-insert a profile when a new user signs up

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, department)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'role', new.raw_user_meta_data->>'department');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

