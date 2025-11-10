-- Create RPC function for anonymous match creation
-- This allows creating matches when user toggle is off (no authenticated user)
-- Run this SQL in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION create_anonymous_match(match_data jsonb)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result_record record;
BEGIN
  -- Insert the match with null user_id (anonymous)
  INSERT INTO match (
    user_id, 
    fencer_1_name, 
    fencer_2_name, 
    final_score, 
    event_date, 
    result, 
    score_diff, 
    match_type, 
    source
  )
  VALUES (
    NULL, -- user_id is always null for anonymous matches
    (match_data->>'fencer_1_name')::text,
    (match_data->>'fencer_2_name')::text,
    (match_data->>'final_score')::integer,
    (match_data->>'event_date')::timestamptz,
    (match_data->>'result')::text,
    (match_data->>'score_diff')::integer,
    (match_data->>'match_type')::text,
    (match_data->>'source')::text
  )
  RETURNING * INTO result_record;
  
  -- Return the full match record as JSON
  RETURN row_to_json(result_record);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_anonymous_match(jsonb) TO authenticated;

-- Optional: Grant to anon role if you want unauthenticated users to create matches
-- GRANT EXECUTE ON FUNCTION create_anonymous_match(jsonb) TO anon;

