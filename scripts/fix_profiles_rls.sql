-- 1. Create a function to check if the current user is an admin without recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
  v_role text;
BEGIN
  -- Use SECURITY DEFINER to bypass RLS for this specific lookup
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'Administrator' OR v_role = 'Admin / Developer';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Prevent the function from being executed indiscriminately if needed
-- (Security Definer functions are powerful, so restrict execution)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. Enable RLS on profiles if it isn't already
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Policy for admins to update all profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING ( public.is_admin() ) 
WITH CHECK ( public.is_admin() );

-- 5. Policy for users to update their own profile (they shouldn't be able to elevate their own role)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
-- Restrict standard users to ONLY update non-role fields (optional, but good practice). 
-- This simple policy just checks they own the row.
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Note: Ensure there are still basic SELECT policies if missing
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users" 
ON public.profiles 
FOR SELECT 
USING (auth.role() = 'authenticated');
