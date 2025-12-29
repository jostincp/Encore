-- =====================================================
-- Test Queries: Optimized Search Performance
-- Description: Example queries using the new indexes
-- Run these after migration to verify performance
-- =====================================================

-- =====================================================
-- QUERY 1: Full-Text Search with Ranking
-- =====================================================
-- This is the main search query that will be used in production
-- Expected performance: 50-200ms (vs 500-1000ms before)

SELECT 
  id,
  title,
  artist,
  thumbnail,
  duration,
  source,
  external_id,
  -- Calculate relevance rank combining text match + popularity
  ts_rank_cd(search_vector, websearch_to_tsquery('spanish', $1)) * 
  (1 + log(GREATEST(popularity_score, 1))) AS rank
FROM songs
WHERE search_vector @@ websearch_to_tsquery('spanish', $1)
ORDER BY rank DESC
LIMIT 20;

-- Example usage:
-- $1 = 'shakira'
-- $1 = 'bad bunny'
-- $1 = 'reggaeton'

-- =====================================================
-- QUERY 2: Exact Title Match (Fallback)
-- =====================================================
-- For when user searches exact title
-- Expected performance: 20-50ms

SELECT 
  id,
  title,
  artist,
  thumbnail,
  duration,
  source,
  external_id
FROM songs
WHERE title ILIKE $1 || '%'
  AND artist ILIKE $2 || '%'
ORDER BY popularity_score DESC
LIMIT 20;

-- Example usage:
-- $1 = 'Hips Don''t Lie'
-- $2 = 'Shakira'

-- =====================================================
-- QUERY 3: Popular Songs (Trending)
-- =====================================================
-- Get most popular songs overall
-- Expected performance: 10-30ms

SELECT 
  id,
  title,
  artist,
  thumbnail,
  duration,
  source,
  external_id,
  popularity_score
FROM songs
WHERE popularity_score > 100
ORDER BY popularity_score DESC
LIMIT 20;

-- =====================================================
-- QUERY 4: Queue for Bar
-- =====================================================
-- Get pending songs in queue for a specific bar
-- Expected performance: 10-30ms

SELECT 
  q.id,
  q.song_id,
  q.user_id,
  q.bar_id,
  q.status,
  q.position,
  q.created_at,
  s.title,
  s.artist,
  s.thumbnail,
  s.duration
FROM queue q
JOIN songs s ON q.song_id = s.id
WHERE q.bar_id = $1
  AND q.status = 'pending'
ORDER BY q.position ASC, q.created_at ASC
LIMIT 50;

-- Example usage:
-- $1 = 'bar-uuid-123'

-- =====================================================
-- QUERY 5: Check if Song Exists
-- =====================================================
-- Before adding song from YouTube/Spotify, check if it exists
-- Expected performance: 5-10ms

SELECT 
  id,
  title,
  artist,
  source,
  external_id
FROM songs
WHERE source = $1
  AND external_id = $2
LIMIT 1;

-- Example usage:
-- $1 = 'youtube'
-- $2 = 'dQw4w9WgXcQ'

-- =====================================================
-- PERFORMANCE TESTING
-- =====================================================
-- Run these with EXPLAIN ANALYZE to verify index usage

-- Test 1: Verify GIN index is used
EXPLAIN ANALYZE
SELECT id, title, artist
FROM songs
WHERE search_vector @@ websearch_to_tsquery('spanish', 'shakira')
LIMIT 20;
-- Look for: "Index Scan using idx_songs_search_vector"

-- Test 2: Verify popularity index is used
EXPLAIN ANALYZE
SELECT id, title, artist, popularity_score
FROM songs
WHERE popularity_score > 100
ORDER BY popularity_score DESC
LIMIT 20;
-- Look for: "Index Scan using idx_songs_popularity"

-- Test 3: Verify composite index is used
EXPLAIN ANALYZE
SELECT id, title, artist
FROM songs
WHERE source = 'youtube' AND external_id = 'test123'
LIMIT 1;
-- Look for: "Index Scan using idx_songs_source_id"

-- =====================================================
-- MAINTENANCE QUERIES
-- =====================================================

-- Update popularity scores (run periodically from analytics)
UPDATE songs
SET popularity_score = (
  SELECT COUNT(*)
  FROM queue
  WHERE queue.song_id = songs.id
    AND queue.created_at > NOW() - INTERVAL '7 days'
)
WHERE id IN (
  SELECT DISTINCT song_id
  FROM queue
  WHERE created_at > NOW() - INTERVAL '7 days'
);

-- Vacuum and analyze (run weekly for optimal performance)
VACUUM ANALYZE songs;
VACUUM ANALYZE queue;
