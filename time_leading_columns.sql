-- Essential Columns for Time Leading Percentage Calculations
-- Run this to see exactly what data we need and have available

-- 1. Check what columns exist in match_event table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'match_event' 
    AND column_name IN (
        'timestamp',
        'event_time', 
        'match_time_elapsed',
        'seconds_since_last_event',
        'scoring_user_name',
        'score_diff',
        'fencer_1_name',
        'fencer_2_name',
        'match_id'
    )
ORDER BY column_name;

-- 2. Check what columns exist in match table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'match' 
    AND column_name IN (
        'match_id',
        'bout_length_s',
        'final_score',
        'touches_against',
        'fencer_1_name',
        'fencer_2_name',
        'event_date'
    )
ORDER BY column_name;

-- 3. Sample data showing the exact columns we need
SELECT 
    -- From match_event table
    me.match_id,
    me.timestamp,
    me.match_time_elapsed,
    me.scoring_user_name,
    me.score_diff,
    me.fencer_1_name as event_fencer_1,
    me.fencer_2_name as event_fencer_2,
    
    -- From match table  
    m.bout_length_s,
    m.final_score,
    m.touches_against,
    m.fencer_1_name as match_fencer_1,
    m.fencer_2_name as match_fencer_2,
    
    -- Calculated fields for time leading
    CASE 
        WHEN me.score_diff > 0 THEN m.fencer_1_name
        WHEN me.score_diff < 0 THEN m.fencer_2_name
        ELSE 'Tied'
    END as current_leader,
    
    -- Time since previous event (for interval calculation)
    LAG(me.match_time_elapsed) OVER (
        PARTITION BY me.match_id 
        ORDER BY me.timestamp
    ) as previous_event_time

FROM match_event me
JOIN match m ON me.match_id = m.match_id
WHERE m.bout_length_s IS NOT NULL
ORDER BY me.match_id, me.timestamp
LIMIT 20;

-- 4. Check data completeness for time leading calculations
SELECT 
    'Total match_event records' as metric,
    COUNT(*) as count
FROM match_event
UNION ALL
SELECT 
    'Records with timestamp' as metric,
    COUNT(*) as count
FROM match_event 
WHERE timestamp IS NOT NULL
UNION ALL
SELECT 
    'Records with match_time_elapsed' as metric,
    COUNT(*) as count
FROM match_event 
WHERE match_time_elapsed IS NOT NULL
UNION ALL
SELECT 
    'Records with scoring_user_name' as metric,
    COUNT(*) as count
FROM match_event 
WHERE scoring_user_name IS NOT NULL
UNION ALL
SELECT 
    'Records with score_diff' as metric,
    COUNT(*) as count
FROM match_event 
WHERE score_diff IS NOT NULL
UNION ALL
SELECT 
    'Matches with bout_length_s' as metric,
    COUNT(*) as count
FROM match 
WHERE bout_length_s IS NOT NULL;

-- 5. Find the best match for testing time leading calculations
SELECT 
    m.match_id,
    m.fencer_1_name,
    m.fencer_2_name,
    m.bout_length_s as total_duration_seconds,
    m.final_score,
    m.touches_against,
    COUNT(me.match_event_id) as total_events,
    
    -- Check data completeness
    COUNT(CASE WHEN me.timestamp IS NOT NULL THEN 1 END) as events_with_timestamp,
    COUNT(CASE WHEN me.match_time_elapsed IS NOT NULL THEN 1 END) as events_with_elapsed_time,
    COUNT(CASE WHEN me.scoring_user_name IS NOT NULL THEN 1 END) as events_with_scorer,
    
    -- Data completeness percentage
    ROUND(
        COUNT(CASE WHEN me.timestamp IS NOT NULL 
                   AND me.match_time_elapsed IS NOT NULL 
                   AND me.scoring_user_name IS NOT NULL THEN 1 END)::numeric 
        / COUNT(me.match_event_id) * 100, 2
    ) as data_completeness_percent

FROM match m
JOIN match_event me ON m.match_id = me.match_id
WHERE m.bout_length_s IS NOT NULL 
    AND m.final_score IS NOT NULL
GROUP BY m.match_id, m.fencer_1_name, m.fencer_2_name, m.bout_length_s, m.final_score, m.touches_against
HAVING COUNT(me.match_event_id) > 0
ORDER BY data_completeness_percent DESC, COUNT(me.match_event_id) DESC
LIMIT 5;


