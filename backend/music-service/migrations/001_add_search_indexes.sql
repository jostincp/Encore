-- =====================================================
-- Migration: Add Optimized Search Indexes
-- Description: Adds GENERATED tsvector column and GIN indexes
--              for ultra-fast full-text search in Spanish
-- Performance: Expected 10x improvement (500ms → 50ms)
-- Author: Encore Team
-- Date: 2025-12-25
-- =====================================================

-- =====================================================
-- STEP 1: Add search_vector GENERATED column
-- =====================================================
-- This column automatically computes and stores the tsvector
-- No need to recalculate on every query = HUGE performance boost

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(artist, '')), 'B')
  ) STORED;

COMMENT ON COLUMN songs.search_vector IS 
  'Auto-generated full-text search vector. Weight A=title (higher priority), B=artist';

-- =====================================================
-- STEP 2: Create GIN index on search_vector
-- =====================================================
-- GIN (Generalized Inverted Index) is optimized for full-text search
-- This is THE critical index for performance

CREATE INDEX IF NOT EXISTS idx_songs_search_vector 
  ON songs 
  USING GIN(search_vector);

COMMENT ON INDEX idx_songs_search_vector IS 
  'GIN index for ultra-fast full-text search. Expected 10x performance improvement';

-- =====================================================
-- STEP 3: Add popularity_score column for ranking
-- =====================================================
-- Used to boost popular songs in search results

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS popularity_score INT DEFAULT 0;

COMMENT ON COLUMN songs.popularity_score IS 
  'Popularity score (0-1000). Updated by analytics. Used for search ranking';

-- Create index for popularity-based sorting
CREATE INDEX IF NOT EXISTS idx_songs_popularity 
  ON songs(popularity_score DESC)
  WHERE popularity_score > 0;

COMMENT ON INDEX idx_songs_popularity IS 
  'Index for sorting by popularity. Partial index (only scores > 0) for efficiency';

-- =====================================================
-- STEP 4: Add exact match fallback index
-- =====================================================
-- For exact title/artist searches when full-text search isn't needed

CREATE INDEX IF NOT EXISTS idx_songs_title_artist 
  ON songs(title, artist)
  WHERE title IS NOT NULL AND artist IS NOT NULL;

COMMENT ON INDEX idx_songs_title_artist IS 
  'Composite index for exact title+artist lookups. Partial index for efficiency';

-- =====================================================
-- STEP 5: Add indexes for queue table
-- =====================================================
-- Optimize queue queries by bar_id and status

CREATE INDEX IF NOT EXISTS idx_queue_bar_status 
  ON queue(bar_id, status);

COMMENT ON INDEX idx_queue_bar_status IS 
  'Composite index for filtering queue by bar and status (pending/playing/completed)';

CREATE INDEX IF NOT EXISTS idx_queue_created_at 
  ON queue(created_at DESC);

COMMENT ON INDEX idx_queue_created_at IS 
  'Index for sorting queue by creation time (newest first)';

-- =====================================================
-- STEP 6: Add index for external_id lookups
-- =====================================================
-- Fast lookups when checking if YouTube/Spotify song already exists

CREATE INDEX IF NOT EXISTS idx_songs_source_id 
  ON songs(source, external_id);

COMMENT ON INDEX idx_songs_source_id IS 
  'Composite index for checking if external song (YouTube/Spotify) already exists in DB';

-- =====================================================
-- STEP 7: Update statistics for query planner
-- =====================================================
-- Ensures PostgreSQL query planner uses the new indexes optimally

ANALYZE songs;
ANALYZE queue;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify the migration worked correctly

-- 1. Check search_vector was created and populated
-- SELECT id, title, artist, search_vector FROM songs LIMIT 5;

-- 2. Test full-text search performance
-- EXPLAIN ANALYZE
-- SELECT id, title, artist,
--   ts_rank_cd(search_vector, websearch_to_tsquery('spanish', 'shakira')) AS rank
-- FROM songs
-- WHERE search_vector @@ websearch_to_tsquery('spanish', 'shakira')
-- ORDER BY rank DESC
-- LIMIT 20;

-- 3. Verify all indexes were created
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('songs', 'queue') 
-- ORDER BY tablename, indexname;

-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================
-- Uncomment and run if you need to rollback this migration

-- DROP INDEX IF EXISTS idx_songs_search_vector;
-- DROP INDEX IF EXISTS idx_songs_popularity;
-- DROP INDEX IF EXISTS idx_songs_title_artist;
-- DROP INDEX IF EXISTS idx_queue_bar_status;
-- DROP INDEX IF EXISTS idx_queue_created_at;
-- DROP INDEX IF EXISTS idx_songs_source_id;
-- ALTER TABLE songs DROP COLUMN IF EXISTS search_vector;
-- ALTER TABLE songs DROP COLUMN IF EXISTS popularity_score;

-- =====================================================
-- PERFORMANCE NOTES
-- =====================================================
-- Expected improvements:
-- - Full-text search: 500ms → 50-200ms (10x faster)
-- - Exact match: 300ms → 20-50ms (15x faster)
-- - Queue queries: 200ms → 10-30ms (20x faster)
--
-- Trade-offs:
-- - Disk space: ~20-30% increase (tsvector storage)
-- - INSERT/UPDATE: ~5-10% slower (index maintenance)
-- - Overall: HUGE net positive for read-heavy workload
