-- Create RPC function to delete a user account from auth
-- Note: Direct deletion from auth.users may not work due to permissions
-- This function attempts to delete the user, but may require an Edge Function
-- with Admin API access for full functionality
-- Users can only delete their own account (enforced by checking auth.uid())

CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Verify that the user is trying to delete their own account
  IF auth.uid() IS NULL OR auth.uid() != target_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only delete your own account'
    );
  END IF;

  -- Attempt to delete the user from auth.users
  -- Note: This may fail if the function doesn't have proper permissions
  -- In that case, you'll need to create a Supabase Edge Function that uses
  -- the Admin API with service role key
  BEGIN
    DELETE FROM auth.users WHERE id = target_user_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'User account deleted successfully'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'User not found or could not be deleted. May require Edge Function with Admin API.'
      );
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient privileges. Auth user deletion requires Edge Function with Admin API.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to delete auth user: ' || SQLERRM
    );
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_user_account IS 'Attempts to delete a user account from auth.users. Users can only delete their own account. May require Edge Function with Admin API for full functionality.';

