-- Update RPC function for anonymous match updates
-- This allows updating matches when user toggle is off (no authenticated user)
-- Run this SQL in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION update_anonymous_match(match_id_param text, updates jsonb)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    result_record record;
BEGIN
    UPDATE match
    SET 
        final_score = COALESCE((updates->>'final_score')::integer, final_score),
        result = COALESCE((updates->>'result')::text, result),
        score_diff = COALESCE((updates->>'score_diff')::integer, score_diff),
        final_period = COALESCE((updates->>'final_period')::integer, final_period),
        yellow_cards = COALESCE((updates->>'yellow_cards')::integer, yellow_cards),
        red_cards = COALESCE((updates->>'red_cards')::integer, red_cards),
        priority_assigned = COALESCE((updates->>'priority_assigned')::text, priority_assigned),
        bout_length_s = COALESCE((updates->>'bout_length_s')::integer, bout_length_s),
        is_complete = COALESCE((updates->>'is_complete')::boolean, is_complete),
        notes = COALESCE((updates->>'notes')::text, notes),
        period_number = COALESCE((updates->>'period_number')::integer, period_number),
        score_spp = COALESCE((updates->>'score_spp')::integer, score_spp),
        score_by_period = COALESCE((updates->'score_by_period')::jsonb, score_by_period),
        fencer_1_name = COALESCE((updates->>'fencer_1_name')::text, fencer_1_name),
        fencer_2_name = COALESCE((updates->>'fencer_2_name')::text, fencer_2_name)
    WHERE match_id = match_id_param::uuid
    RETURNING * INTO result_record;
    
    RETURN row_to_json(result_record);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_anonymous_match(text, jsonb) TO authenticated;

-- Optional: Grant to anon role if you want unauthenticated users to update matches
-- GRANT EXECUTE ON FUNCTION update_anonymous_match(text, jsonb) TO anon;

