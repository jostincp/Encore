/**
 * @swagger
 * /api/music/search:
 *   get:
 *     summary: Search for songs
 *     description: Search songs with various filters and pagination support
 *     tags: [Music]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (song title, artist, or album)
 *         example: "bohemian rhapsody queen"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: artist
 *         schema:
 *           type: string
 *         description: Filter by artist name
 *       - in: query
 *         name: album
 *         schema:
 *           type: string
 *         description: Filter by album name
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter by genre
 *       - in: query
 *         name: year_from
 *         schema:
 *           type: integer
 *         description: Filter by minimum release year
 *       - in: query
 *         name: year_to
 *         schema:
 *           type: integer
 *         description: Filter by maximum release year
 *       - in: query
 *         name: duration_min
 *         schema:
 *           type: integer
 *         description: Filter by minimum duration in seconds
 *       - in: query
 *         name: duration_max
 *         schema:
 *           type: integer
 *         description: Filter by maximum duration in seconds
 *       - in: query
 *         name: sources
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [youtube, spotify, local]
 *         description: Filter by music sources
 *         style: form
 *         explode: false
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Song'
 *             example:
 *               items:
 *                 - id: "123e4567-e89b-12d3-a456-426614174000"
 *                   title: "Bohemian Rhapsody"
 *                   artist: "Queen"
 *                   album: "A Night at the Opera"
 *                   duration: 355
 *                   genre: "Rock"
 *                   release_year: 1975
 *                   popularity_score: 95.8
 *                   is_available: true
 *               total: 1
 *               page: 1
 *               limit: 20
 *               totalPages: 1
 *       400:
 *         description: Invalid search parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "ValidationError"
 *               message: "Search query is required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/music/songs/{id}:
 *   get:
 *     summary: Get song details
 *     description: Retrieve detailed information about a specific song
 *     tags: [Music]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Song ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Song details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Song'
 *             example:
 *               id: "123e4567-e89b-12d3-a456-426614174000"
 *               title: "Bohemian Rhapsody"
 *               artist: "Queen"
 *               album: "A Night at the Opera"
 *               duration: 355
 *               genre: "Rock"
 *               release_year: 1975
 *               youtube_id: "fJ9rUzIMcZQ"
 *               spotify_id: "4u7EnebtmKWzUH433cf5Qv"
 *               thumbnail_url: "https://img.youtube.com/vi/fJ9rUzIMcZQ/maxresdefault.jpg"
 *               popularity_score: 95.8
 *               is_available: true
 *               created_at: "2024-01-15T10:30:00Z"
 *               updated_at: "2024-01-15T10:30:00Z"
 *       404:
 *         description: Song not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "NotFoundError"
 *               message: "Song not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/music/popular:
 *   get:
 *     summary: Get popular songs
 *     description: Retrieve a list of popular songs based on play count and ratings
 *     tags: [Music]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of songs to return
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter by genre
 *       - in: query
 *         name: time_range
 *         schema:
 *           type: string
 *           enum: [day, week, month, year, all_time]
 *           default: week
 *         description: Time range for popularity calculation
 *     responses:
 *       200:
 *         description: List of popular songs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Song'
 *             example:
 *               - id: "123e4567-e89b-12d3-a456-426614174000"
 *                 title: "Bohemian Rhapsody"
 *                 artist: "Queen"
 *                 popularity_score: 95.8
 *               - id: "123e4567-e89b-12d3-a456-426614174001"
 *                 title: "Stairway to Heaven"
 *                 artist: "Led Zeppelin"
 *                 popularity_score: 94.2
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/music/trending:
 *   get:
 *     summary: Get trending songs
 *     description: Retrieve currently trending songs based on recent activity
 *     tags: [Music]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of songs to return
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter by genre
 *     responses:
 *       200:
 *         description: List of trending songs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Song'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/music/recent:
 *   get:
 *     summary: Get recently played songs
 *     description: Retrieve recently played songs across all bars
 *     tags: [Music]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of songs to return
 *       - in: query
 *         name: bar_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by specific bar
 *     responses:
 *       200:
 *         description: List of recently played songs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Song'
 *                   - type: object
 *                     properties:
 *                       played_at:
 *                         type: string
 *                         format: date-time
 *                         description: When the song was played
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/music/songs:
 *   post:
 *     summary: Create a new song
 *     description: Add a new song to the database
 *     tags: [Music]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, artist, duration]
 *             properties:
 *               title:
 *                 type: string
 *                 description: Song title
 *                 example: "Bohemian Rhapsody"
 *               artist:
 *                 type: string
 *                 description: Artist name
 *                 example: "Queen"
 *               album:
 *                 type: string
 *                 description: Album name
 *                 example: "A Night at the Opera"
 *               duration:
 *                 type: integer
 *                 description: Song duration in seconds
 *                 example: 355
 *               genre:
 *                 type: string
 *                 description: Music genre
 *                 example: "Rock"
 *               release_year:
 *                 type: integer
 *                 description: Year of release
 *                 example: 1975
 *               youtube_id:
 *                 type: string
 *                 description: YouTube video ID
 *                 example: "fJ9rUzIMcZQ"
 *               spotify_id:
 *                 type: string
 *                 description: Spotify track ID
 *                 example: "4u7EnebtmKWzUH433cf5Qv"
 *               thumbnail_url:
 *                 type: string
 *                 format: uri
 *                 description: URL to song thumbnail image
 *     responses:
 *       201:
 *         description: Song created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Song'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Song already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/music/songs/{id}:
 *   put:
 *     summary: Update song details
 *     description: Update information for an existing song
 *     tags: [Music]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Song ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Song title
 *               artist:
 *                 type: string
 *                 description: Artist name
 *               album:
 *                 type: string
 *                 description: Album name
 *               duration:
 *                 type: integer
 *                 description: Song duration in seconds
 *               genre:
 *                 type: string
 *                 description: Music genre
 *               release_year:
 *                 type: integer
 *                 description: Year of release
 *               youtube_id:
 *                 type: string
 *                 description: YouTube video ID
 *               spotify_id:
 *                 type: string
 *                 description: Spotify track ID
 *               thumbnail_url:
 *                 type: string
 *                 format: uri
 *                 description: URL to song thumbnail image
 *     responses:
 *       200:
 *         description: Song updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Song'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Song not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Delete a song
 *     description: Remove a song from the database
 *     tags: [Music]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Song ID
 *     responses:
 *       204:
 *         description: Song deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Song not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/music/songs/{id}/availability:
 *   patch:
 *     summary: Update song availability
 *     description: Mark a song as available or unavailable
 *     tags: [Music]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Song ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [is_available]
 *             properties:
 *               is_available:
 *                 type: boolean
 *                 description: Whether the song should be available
 *                 example: false
 *               reason:
 *                 type: string
 *                 description: Reason for availability change
 *                 example: "Copyright claim"
 *     responses:
 *       200:
 *         description: Song availability updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Song'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Song not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */