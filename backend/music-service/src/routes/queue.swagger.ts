/**
 * @swagger
 * /api/music/queue/{barId}:
 *   get:
 *     summary: Get bar's music queue
 *     description: Retrieve the current music queue for a specific bar with pagination
 *     tags: [Queue]
 *     parameters:
 *       - in: path
 *         name: barId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bar ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, playing, played, skipped, rejected]
 *         description: Filter by queue entry status
 *       - in: query
 *         name: include_song
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include song details in response
 *       - in: query
 *         name: include_user
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include user details in response
 *     responses:
 *       200:
 *         description: Bar's music queue
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
 *                         $ref: '#/components/schemas/QueueEntry'
 *             example:
 *               items:
 *                 - id: "123e4567-e89b-12d3-a456-426614174000"
 *                   bar_id: "123e4567-e89b-12d3-a456-426614174001"
 *                   song_id: "123e4567-e89b-12d3-a456-426614174002"
 *                   user_id: "123e4567-e89b-12d3-a456-426614174003"
 *                   position: 1
 *                   status: "pending"
 *                   priority_play: false
 *                   points_used: 10
 *                   requested_at: "2024-01-15T10:30:00Z"
 *                   song:
 *                     title: "Bohemian Rhapsody"
 *                     artist: "Queen"
 *                     duration: 355
 *                   user:
 *                     first_name: "John"
 *                     last_name: "Doe"
 *               total: 15
 *               page: 1
 *               limit: 20
 *               totalPages: 1
 *       400:
 *         description: Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bar not found
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
 * /api/music/queue/{barId}/current:
 *   get:
 *     summary: Get currently playing song
 *     description: Retrieve the song that is currently playing in the bar
 *     tags: [Queue]
 *     parameters:
 *       - in: path
 *         name: barId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bar ID
 *     responses:
 *       200:
 *         description: Currently playing song
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueueEntry'
 *             example:
 *               id: "123e4567-e89b-12d3-a456-426614174000"
 *               bar_id: "123e4567-e89b-12d3-a456-426614174001"
 *               status: "playing"
 *               song:
 *                 title: "Bohemian Rhapsody"
 *                 artist: "Queen"
 *                 duration: 355
 *               user:
 *                 first_name: "John"
 *                 last_name: "Doe"
 *               played_at: "2024-01-15T10:30:00Z"
 *       404:
 *         description: No song currently playing or bar not found
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
 * /api/music/queue/{barId}/next:
 *   get:
 *     summary: Get next song in queue
 *     description: Retrieve the next song to be played in the bar's queue
 *     tags: [Queue]
 *     parameters:
 *       - in: path
 *         name: barId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bar ID
 *     responses:
 *       200:
 *         description: Next song in queue
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueueEntry'
 *       404:
 *         description: No next song in queue or bar not found
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
 * /api/music/queue:
 *   post:
 *     summary: Add song to queue
 *     description: Add a song to a bar's music queue
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bar_id, song_id]
 *             properties:
 *               bar_id:
 *                 type: string
 *                 format: uuid
 *                 description: Bar ID
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               song_id:
 *                 type: string
 *                 format: uuid
 *                 description: Song ID
 *                 example: "123e4567-e89b-12d3-a456-426614174001"
 *               priority_play:
 *                 type: boolean
 *                 description: Whether this is a priority play (costs more points)
 *                 default: false
 *               points_used:
 *                 type: integer
 *                 description: Points to use for this request
 *                 minimum: 1
 *                 example: 10
 *     responses:
 *       201:
 *         description: Song added to queue successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueueEntry'
 *             example:
 *               id: "123e4567-e89b-12d3-a456-426614174000"
 *               bar_id: "123e4567-e89b-12d3-a456-426614174001"
 *               song_id: "123e4567-e89b-12d3-a456-426614174002"
 *               user_id: "123e4567-e89b-12d3-a456-426614174003"
 *               position: 5
 *               status: "pending"
 *               priority_play: false
 *               points_used: 10
 *               requested_at: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Invalid input data or insufficient points
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_data:
 *                 summary: Invalid input data
 *                 value:
 *                   error: "ValidationError"
 *                   message: "Bar ID and Song ID are required"
 *               insufficient_points:
 *                 summary: Insufficient points
 *                 value:
 *                   error: "InsufficientPointsError"
 *                   message: "Not enough points to add song to queue"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bar or song not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Song already in queue
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
 * /api/music/queue/{id}:
 *   put:
 *     summary: Update queue entry
 *     description: Update status or other properties of a queue entry
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Queue entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, playing, played, skipped, rejected]
 *                 description: New status for the queue entry
 *               position:
 *                 type: integer
 *                 minimum: 1
 *                 description: New position in queue
 *               played_at:
 *                 type: string
 *                 format: date-time
 *                 description: Timestamp when song was played (for status 'played')
 *     responses:
 *       200:
 *         description: Queue entry updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueueEntry'
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
 *       403:
 *         description: Forbidden - cannot modify this queue entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Queue entry not found
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
 *     summary: Remove song from queue
 *     description: Remove a song from the queue (only by the user who added it or bar staff)
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Queue entry ID
 *     responses:
 *       204:
 *         description: Song removed from queue successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - cannot remove this queue entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Queue entry not found
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
 * /api/music/queue/{barId}/reorder:
 *   post:
 *     summary: Reorder queue
 *     description: Reorder songs in the queue (bar staff only)
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: barId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bar ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [queue_order]
 *             properties:
 *               queue_order:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, position]
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       description: Queue entry ID
 *                     position:
 *                       type: integer
 *                       minimum: 1
 *                       description: New position
 *                 description: Array of queue entries with new positions
 *                 example:
 *                   - id: "123e4567-e89b-12d3-a456-426614174000"
 *                     position: 1
 *                   - id: "123e4567-e89b-12d3-a456-426614174001"
 *                     position: 2
 *     responses:
 *       200:
 *         description: Queue reordered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue reordered successfully"
 *                 updated_entries:
 *                   type: integer
 *                   example: 5
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
 *       403:
 *         description: Forbidden - bar staff only
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bar not found
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
 * /api/music/queue/{barId}/clear:
 *   delete:
 *     summary: Clear queue
 *     description: Clear all pending songs from the queue (bar staff only)
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: barId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bar ID
 *       - in: query
 *         name: keep_current
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Whether to keep the currently playing song
 *     responses:
 *       200:
 *         description: Queue cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Queue cleared successfully"
 *                 cleared_entries:
 *                   type: integer
 *                   example: 12
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - bar staff only
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bar not found
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
 * /api/music/queue/{barId}/stats:
 *   get:
 *     summary: Get queue statistics
 *     description: Retrieve statistics about the bar's music queue
 *     tags: [Queue]
 *     parameters:
 *       - in: path
 *         name: barId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bar ID
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics (YYYY-MM-DD)
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Queue statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_requests:
 *                   type: integer
 *                   description: Total number of song requests
 *                   example: 150
 *                 pending_requests:
 *                   type: integer
 *                   description: Number of pending requests
 *                   example: 5
 *                 played_requests:
 *                   type: integer
 *                   description: Number of played requests
 *                   example: 120
 *                 skipped_requests:
 *                   type: integer
 *                   description: Number of skipped requests
 *                   example: 15
 *                 rejected_requests:
 *                   type: integer
 *                   description: Number of rejected requests
 *                   example: 10
 *                 average_wait_time:
 *                   type: number
 *                   format: float
 *                   description: Average wait time in minutes
 *                   example: 12.5
 *                 total_points_used:
 *                   type: integer
 *                   description: Total points used for requests
 *                   example: 1500
 *                 most_requested_songs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       song:
 *                         $ref: '#/components/schemas/Song'
 *                       request_count:
 *                         type: integer
 *                         example: 8
 *                   description: Most frequently requested songs
 *       400:
 *         description: Invalid date parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bar not found
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