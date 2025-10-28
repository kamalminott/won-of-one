# Priority Round Analytics - Supabase SQL Implementation

## 🗄️ **Database Schema Changes**

Run these SQL commands in your Supabase SQL Editor:

```sql
-- =====================================================
-- PRIORITY ROUND ANALYTICS IMPLEMENTATION
-- =====================================================

-- 1. Add priority tracking columns to match table
ALTER TABLE match 
ADD COLUMN priority_round BOOLEAN DEFAULT FALSE;

ALTER TABLE match 
ADD COLUMN priority_fencer VARCHAR(50);

ALTER TABLE match 
ADD COLUMN priority_winner VARCHAR(50);

ALTER TABLE match 
ADD COLUMN priority_duration_seconds INTEGER;

-- 2. Add comments to document the columns
COMMENT ON COLUMN match.priority_round IS 'Indicates if this match went to a priority round (tie-break)';
COMMENT ON COLUMN match.priority_fencer IS 'Name of the fencer who was assigned priority';
COMMENT ON COLUMN match.priority_winner IS 'Name of the fencer who won the priority round';
COMMENT ON COLUMN match.priority_duration_seconds IS 'Duration of the priority round in seconds';

-- 3. Create indexes for better query performance
CREATE INDEX idx_match_priority_round ON match(priority_round);
CREATE INDEX idx_match_priority_winner ON match(priority_winner);
CREATE INDEX idx_match_user_priority ON match(user_id, priority_round);

-- 4. Add constraints to ensure data integrity
ALTER TABLE match 
ADD CONSTRAINT check_priority_fencer 
CHECK (priority_fencer IS NULL OR priority_fencer IN ('alice', 'bob', fencer_1_name, fencer_2_name));

ALTER TABLE match 
ADD CONSTRAINT check_priority_winner 
CHECK (priority_winner IS NULL OR priority_winner IN (fencer_1_name, fencer_2_name));

ALTER TABLE match 
ADD CONSTRAINT check_priority_duration 
CHECK (priority_duration_seconds IS NULL OR priority_duration_seconds > 0);
```

---

## 📊 **Analytics Query Functions**

Create these functions in Supabase for easy analytics:

```sql
-- =====================================================
-- ANALYTICS FUNCTIONS
-- =====================================================

-- 1. Get priority round statistics for a user
CREATE OR REPLACE FUNCTION get_priority_stats(user_uuid UUID)
RETURNS TABLE (
  total_priority_rounds BIGINT,
  priority_wins BIGINT,
  priority_losses BIGINT,
  priority_win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_priority_rounds,
    SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins,
    SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses,
    ROUND(
      SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) * 100.0 / 
      NULLIF(COUNT(*), 0), 
      2
    ) as priority_win_rate
  FROM match 
  WHERE user_id = user_uuid 
    AND priority_round = true 
    AND is_complete = true;
END;
$$ LANGUAGE plpgsql;

-- 2. Get priority performance over time
CREATE OR REPLACE FUNCTION get_priority_performance_over_time(
  user_uuid UUID, 
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  match_date DATE,
  priority_rounds BIGINT,
  priority_wins BIGINT,
  priority_losses BIGINT,
  priority_win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(event_date) as match_date,
    COUNT(*) as priority_rounds,
    SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins,
    SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses,
    ROUND(
      SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) * 100.0 / 
      NULLIF(COUNT(*), 0), 
      2
    ) as priority_win_rate
  FROM match 
  WHERE user_id = user_uuid 
    AND priority_round = true 
    AND is_complete = true
    AND event_date >= CURRENT_DATE - INTERVAL '1 day' * days_back
  GROUP BY DATE(event_date)
  ORDER BY match_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. Get priority performance by opponent
CREATE OR REPLACE FUNCTION get_priority_performance_by_opponent(user_uuid UUID)
RETURNS TABLE (
  opponent_name TEXT,
  priority_rounds_vs_opponent BIGINT,
  priority_wins_vs_opponent BIGINT,
  priority_losses_vs_opponent BIGINT,
  priority_win_rate_vs_opponent NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fencer_2_name as opponent_name,
    COUNT(*) as priority_rounds_vs_opponent,
    SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins_vs_opponent,
    SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses_vs_opponent,
    ROUND(
      SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) * 100.0 / 
      NULLIF(COUNT(*), 0), 
      2
    ) as priority_win_rate_vs_opponent
  FROM match 
  WHERE user_id = user_uuid 
    AND priority_round = true 
    AND is_complete = true
  GROUP BY fencer_2_name
  ORDER BY priority_rounds_vs_opponent DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Get priority duration statistics
CREATE OR REPLACE FUNCTION get_priority_duration_stats(user_uuid UUID)
RETURNS TABLE (
  avg_duration_seconds NUMERIC,
  min_duration_seconds INTEGER,
  max_duration_seconds INTEGER,
  total_priority_rounds BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(priority_duration_seconds), 2) as avg_duration_seconds,
    MIN(priority_duration_seconds) as min_duration_seconds,
    MAX(priority_duration_seconds) as max_duration_seconds,
    COUNT(*) as total_priority_rounds
  FROM match 
  WHERE user_id = user_uuid 
    AND priority_round = true 
    AND priority_duration_seconds IS NOT NULL
    AND is_complete = true;
END;
$$ LANGUAGE plpgsql;

-- 5. Get recent priority rounds
CREATE OR REPLACE FUNCTION get_recent_priority_rounds(
  user_uuid UUID, 
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  match_id UUID,
  event_date DATE,
  fencer_1_name TEXT,
  fencer_2_name TEXT,
  priority_fencer TEXT,
  priority_winner TEXT,
  priority_duration_seconds INTEGER,
  result TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.match_id,
    m.event_date,
    m.fencer_1_name,
    m.fencer_2_name,
    m.priority_fencer,
    m.priority_winner,
    m.priority_duration_seconds,
    m.result
  FROM match m
  WHERE m.user_id = user_uuid 
    AND m.priority_round = true 
    AND m.is_complete = true
  ORDER BY m.event_date DESC, m.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```

---

## 🔍 **Direct Query Examples**

Use these queries directly in Supabase SQL Editor for testing:

```sql
-- =====================================================
-- DIRECT QUERY EXAMPLES
-- =====================================================

-- 1. Basic priority stats for a specific user
-- Replace 'your-user-id-here' with actual user ID
SELECT 
  COUNT(*) as total_priority_rounds,
  SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins,
  SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses,
  ROUND(
    SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) * 100.0 / 
    NULLIF(COUNT(*), 0), 
    2
  ) as priority_win_rate_percent
FROM match 
WHERE user_id = 'your-user-id-here' 
  AND priority_round = true 
  AND is_complete = true;

-- 2. Priority performance over last 30 days
SELECT 
  DATE(event_date) as match_date,
  COUNT(*) as priority_rounds,
  SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins,
  SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses
FROM match 
WHERE user_id = 'your-user-id-here' 
  AND priority_round = true 
  AND is_complete = true
  AND event_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(event_date)
ORDER BY match_date DESC;

-- 3. Priority performance by opponent
SELECT 
  fencer_2_name as opponent_name,
  COUNT(*) as priority_rounds_vs_opponent,
  SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins_vs_opponent,
  SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses_vs_opponent,
  ROUND(
    SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) * 100.0 / 
    NULLIF(COUNT(*), 0), 
    2
  ) as priority_win_rate_vs_opponent_percent
FROM match 
WHERE user_id = 'your-user-id-here' 
  AND priority_round = true 
  AND is_complete = true
GROUP BY fencer_2_name
ORDER BY priority_rounds_vs_opponent DESC;

-- 4. Priority duration analysis
SELECT 
  ROUND(AVG(priority_duration_seconds), 2) as avg_duration_seconds,
  MIN(priority_duration_seconds) as min_duration_seconds,
  MAX(priority_duration_seconds) as max_duration_seconds,
  COUNT(*) as total_priority_rounds
FROM match 
WHERE user_id = 'your-user-id-here' 
  AND priority_round = true 
  AND priority_duration_seconds IS NOT NULL
  AND is_complete = true;

-- 5. Recent priority rounds
SELECT 
  match_id,
  event_date,
  fencer_1_name,
  fencer_2_name,
  priority_fencer,
  priority_winner,
  priority_duration_seconds,
  result
FROM match 
WHERE user_id = 'your-user-id-here' 
  AND priority_round = true 
  AND is_complete = true
ORDER BY event_date DESC, created_at DESC
LIMIT 10;

-- 6. Priority rounds this month
SELECT 
  COUNT(*) as priority_rounds_this_month,
  SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins_this_month,
  SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses_this_month
FROM match 
WHERE user_id = 'your-user-id-here' 
  AND priority_round = true 
  AND is_complete = true
  AND EXTRACT(MONTH FROM event_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(YEAR FROM event_date) = EXTRACT(YEAR FROM CURRENT_DATE);

-- 7. Priority rounds this year
SELECT 
  COUNT(*) as priority_rounds_this_year,
  SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins_this_year,
  SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses_this_year
FROM match 
WHERE user_id = 'your-user-id-here' 
  AND priority_round = true 
  AND is_complete = true
  AND EXTRACT(YEAR FROM event_date) = EXTRACT(YEAR FROM CURRENT_DATE);
```

---

## 🧪 **Testing Queries**

Use these to test your implementation:

```sql
-- =====================================================
-- TESTING QUERIES
-- =====================================================

-- 1. Check if columns were added successfully
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'match' 
  AND column_name LIKE 'priority%'
ORDER BY column_name;

-- 2. Check if indexes were created
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'match' 
  AND indexname LIKE '%priority%';

-- 3. Test the functions (replace with actual user ID)
SELECT * FROM get_priority_stats('your-user-id-here');
SELECT * FROM get_priority_performance_over_time('your-user-id-here', 30);
SELECT * FROM get_priority_performance_by_opponent('your-user-id-here');
SELECT * FROM get_priority_duration_stats('your-user-id-here');
SELECT * FROM get_recent_priority_rounds('your-user-id-here', 5);

-- 4. Check for any existing priority data
SELECT COUNT(*) as total_matches_with_priority_data
FROM match 
WHERE priority_round = true;
```

---

## 📋 **Implementation Steps**

1. **Run the schema changes** (first SQL block)
2. **Create the functions** (second SQL block)  
3. **Test with direct queries** (third SQL block)
4. **Verify with testing queries** (fourth SQL block)
5. **Update your app code** to use these new columns

---

## ⚠️ **Important Notes**

- **Replace `'your-user-id-here'`** with actual user IDs when testing
- **Backup your database** before running schema changes
- **Test in development** before applying to production
- **The functions use `plpgsql`** which should be available in Supabase
- **Indexes will improve query performance** for large datasets

This gives you a complete priority round analytics system that you can query directly in Supabase!

