-- ==============================================================================
-- PROMPT ARENA: SUPER ADMIN PROVISIONING SCRIPT
-- ==============================================================================
-- Purpose:
-- Grants Super Administrator permissions to an authenticated Supabase user.
--
-- Instructions:
-- 1. Go to Supabase Dashboard -> Authentication -> Users.
-- 2. Click "Add User" -> "Create user" (enter a strong password, ensure email is confirmed).
-- 3. In this script, replace '<ADMIN_EMAIL>' with the exact email address.
-- 4. Execute this script in the Supabase SQL Editor.
-- 5. To provision a co-organizer / second administrator, repeat with their email.
-- ==============================================================================

DO $$
DECLARE
    target_email TEXT := '<ADMIN_EMAIL>'; -- <-- REPLACE WITH DESIRED ADMIN EMAIL
    target_user_id UUID;
BEGIN
    IF target_email = '<ADMIN_EMAIL>' OR target_email IS NULL OR trim(target_email) = '' THEN
        RAISE EXCEPTION 'Please replace <ADMIN_EMAIL> with a valid administrator email address.';
    END IF;

    -- 1. Locate user in auth.users
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE lower(email) = lower(trim(target_email));

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User "%" not found in auth.users. Please create the user in Supabase Dashboard (Authentication -> Users) first.', target_email;
    END IF;

    -- 2. Insert into public.admins table (referenced by RLS is_admin() checks)
    INSERT INTO public.admins (id, email, created_at)
    VALUES (target_user_id, lower(trim(target_email)), NOW())
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

    -- 3. Tag app_metadata to ensure admin bypass for internal triggers
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin_provisioned": true}'::jsonb
    WHERE id = target_user_id;

    RAISE NOTICE 'SUCCESS: User "%" (ID: %) successfully registered in public.admins.', target_email, target_user_id;
END;
$$;
