-- SQL Queries to Surface Columns for Time Leading Percentage Calculations
-- Run these in your Supabase SQL Editor to see what data is available

-- 1. Check match_event table structure and sample data
-- This shows all available columns in match_event table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'match_event' 
ORDER BY ordinal_position;

-- 2. Get sample match events with all timing-related columns
-- This shows the actual data structure for time leading calculations
SELECT 
    match_event_id,
    match_id,
    timestamp,
    event_time,
    match_time_elapsed,
    seconds_since_last_event,
    scoring_user_name,
    fencer_1_name,
    fencer_2_name,
    score_diff,
    event_type,
    created_at
FROM match_event 
ORDER BY timestamp 
LIMIT 10;

-- 3. Get match data with duration and fencer information
-- This shows match-level data needed for percentage calculations
SELECT 
    match_id,
    fencer_1_name,
    fencer_2_name,
    final_score,
    touches_against,
    bout_length_s,
    event_date,
    is_complete
FROM match 
WHERE bout_length_s IS NOT NULL 
    AND final_score IS NOT NULL
ORDER BY event_date DESC 
LIMIT 5;

-- 4. Get complete match timeline for a specific match
-- Replace 'YOUR_MATCH_ID' with an actual match_id from your database
SELECT 
    me.timestamp,
    me.match_time_elapsed,
    me.scoring_user_name,
    me.score_diff,
    m.fencer_1_name,
    m.fencer_2_name,
    m.bout_length_s,
    m.final_score,
    m.touches_against
FROM match_event me
JOIN match m ON me.match_id = m.match_id
WHERE me.match_id = 'YOUR_MATCH_ID'  -- Replace with actual match_id
ORDER BY me.timestamp;

-- 5. Check for matches with complete timing data
-- This identifies matches that have all required data for time leading calculations
SELECT 
    m.match_id,
    m.fencer_1_name,
    m.fencer_2_name,
    m.bout_length_s,
    m.final_score,
    m.touches_against,
    COUNT(me.match_event_id) as event_count,
    -- Check if all events have required timing data
    COUNT(CASE WHEN me.timestamp IS NOT NULL THEN 1 END) as events_with_timestamp,
    COUNT(CASE WHEN me.match_time_elapsed IS NOT NULL THEN 1 END) as events_with_elapsed_time,
    COUNT(CASE WHEN me.scoring_user_name IS NOT NULL THEN 1 END) as events_with_scorer,
    -- Check data completeness
    CASE 
        WHEN COUNT(me.match_event_id) = 0 THEN 'No Events'
        WHEN COUNT(me.match_event_id) = COUNT(CASE WHEN me.timestamp IS NOT NULL THEN 1 END)
             AND COUNT(me.match_event_id) = COUNT(CASE WHEN me.match_time_elapsed IS NOT NULL THEN 1 END)
             AND COUNT(me.match_event_id) = COUNT(CASE WHEN me.scoring_user_name IS NOT NULL THEN 1 END)
             AND m.bout_length_s IS NOT NULL
        THEN 'Complete Data'
        ELSE 'Incomplete Data'
    END as data_status
FROM match m
LEFT JOIN match_event me ON m.match_id = me.match_id
WHERE m.bout_length_s IS NOT NULL 
    AND m.final_score IS NOT NULL
GROUP BY m.match_id, m.fencer_1_name, m.fencer_2_name, m.bout_length_s, m.final_score, m.touches_against
ORDER BY m.event_date DESC
LIMIT 10;

-- 6. Analyze timing data quality
-- This shows the range and quality of timing data
SELECT 
    'match_time_elapsed' as column_name,
    MIN(match_time_elapsed) as min_value,
    MAX(match_time_elapsed) as max_value,
    AVG(match_time_elapsed) as avg_value,
    COUNT(*) as total_records,
    COUNT(match_time_elapsed) as non_null_records,
    ROUND(COUNT(match_time_elapsed)::numeric / COUNT(*) * 100, 2) as completeness_percent
FROM match_event
UNION ALL
SELECT 
    'seconds_since_last_event' as column_name,
    MIN(seconds_since_last_event) as min_value,
    MAX(seconds_since_last_event) as max_value,
    AVG(seconds_since_last_event) as avg_value,
    COUNT(*) as total_records,
    COUNT(seconds_since_last_event) as non_null_records,
    ROUND(COUNT(seconds_since_last_event)::numeric / COUNT(*) * 100, 2) as completeness_percent
FROM match_event;

-- 7. Get sample time leading calculation data
-- This shows the exact data structure needed for time leading calculations
WITH match_timeline AS (
    SELECT 
        me.match_id,
        me.timestamp,
        me.match_time_elapsed,
        me.scoring_user_name,
        me.score_diff,
        m.fencer_1_name,
        m.fencer_2_name,
        m.bout_length_s,
        m.final_score,
        m.touches_against,
        -- Calculate who was leading at each event
        CASE 
            WHEN me.score_diff > 0 THEN m.fencer_1_name
            WHEN me.score_diff < 0 THEN m.fencer_2_name
            ELSE 'Tied'
        END as leader_at_event,
        -- Calculate time since previous event
        LAG(me.match_time_elapsed) OVER (PARTITION BY me.match_id ORDER BY me.timestamp) as prev_time_elapsed
    FROM match_event me
    JOIN match m ON me.match_id = m.match_id
    WHERE me.match_id = 'YOUR_MATCH_ID'  -- Replace with actual match_id
)
SELECT 
    *,
    -- Calculate time interval for this event
    CASE 
        WHEN prev_time_elapsed IS NULL THEN match_time_elapsed
        ELSE match_time_elapsed - prev_time_elapsed
    END as time_interval
FROM match_timeline
ORDER BY timestamp;

-- 8. Check for potential data issues
-- This identifies potential problems with the data
SELECT 
    'Missing timestamps' as issue_type,
    COUNT(*) as count
FROM match_event 
WHERE timestamp IS NULL
UNION ALL
SELECT 
    'Missing match_time_elapsed' as issue_type,
    COUNT(*) as count
FROM match_event 
WHERE match_time_elapsed IS NULL
UNION ALL
SELECT 
    'Missing scorer names' as issue_type,
    COUNT(*) as count
FROM match_event 
WHERE scoring_user_name IS NULL
UNION ALL
SELECT 
    'Missing match duration' as issue_type,
    COUNT(*) as count
FROM match 
WHERE bout_length_s IS NULL
UNION ALL
SELECT 
    'Negative match_time_elapsed' as issue_type,
    COUNT(*) as count
FROM match_event 
WHERE match_time_elapsed < 0;

-- 9. Get the best match for time leading calculation testing
-- This finds a match with complete data for testing
SELECT 
    m.match_id,
    m.fencer_1_name,
    m.fencer_2_name,
    m.bout_length_s,
    m.final_score,
    m.touches_against,
    COUNT(me.match_event_id) as event_count,
    MIN(me.match_time_elapsed) as first_event_time,
    MAX(me.match_time_elapsed) as last_event_time
FROM match m
JOIN match_event me ON m.match_id = me.match_id
WHERE m.bout_length_s IS NOT NULL 
    AND m.final_score IS NOT NULL
    AND me.timestamp IS NOT NULL
    AND me.match_time_elapsed IS NOT NULL
    AND me.scoring_user_name IS NOT NULL
GROUP BY m.match_id, m.fencer_1_name, m.fencer_2_name, m.bout_length_s, m.final_score, m.touches_against
HAVING COUNT(me.match_event_id) > 0
ORDER BY event_count DESC, m.event_date DESC
LIMIT 1;


