import { QueueController } from '../../../src/controllers/queueController';
import { QueueModel } from '../../../src/models/Queue';
import { queueEventService } from '../../../src/services/queueEventService';

jest.mock('../../../src/models/Queue');
jest.mock('../../../src/services/queueEventService');

describe('QueueController.songFinished', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };
    mockRequest = {};
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should mark current song as played and start next song', async () => {
    const queueId = 'queue-123';
    const barId = 'bar-456';
    const nextSong = { id: 'queue-789', title: 'Next Song' };

    mockRequest.body = { queueId };

    const mockQueueEntry = {
      id: queueId,
      bar_id: barId,
      status: 'playing'
    };

    const mockNextSongData = {
      id: 'queue-789',
      title: 'Next Song',
      artist: 'Next Artist'
    };

    (QueueModel.findById as jest.Mock)
      .mockResolvedValueOnce(mockQueueEntry) // Current song
      .mockResolvedValueOnce(mockNextSongData); // Next song with details

    (QueueModel.update as jest.Mock).mockResolvedValue(mockQueueEntry);
    (QueueModel.getNextInQueue as jest.Mock).mockResolvedValue(nextSong);

    await QueueController.songFinished(mockRequest, mockResponse);

    expect(QueueModel.findById).toHaveBeenCalledWith(queueId);
    expect(QueueModel.update).toHaveBeenCalledWith(queueId, {
      status: 'played',
      played_at: expect.any(Date)
    });
    expect(QueueModel.getNextInQueue).toHaveBeenCalledWith(barId);
    expect(QueueModel.update).toHaveBeenCalledWith(nextSong.id, {
      status: 'playing'
    });
    expect(queueEventService.playNextSong).toHaveBeenCalledWith(barId, mockNextSongData);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      message: 'Next song started',
      data: {
        previous_song: mockQueueEntry,
        next_song: mockNextSongData
      }
    });
  });

  it('should handle no next song in queue', async () => {
    const queueId = 'queue-123';
    const barId = 'bar-456';

    mockRequest.body = { queueId };

    const mockQueueEntry = {
      id: queueId,
      bar_id: barId,
      status: 'playing'
    };

    (QueueModel.findById as jest.Mock).mockResolvedValue(mockQueueEntry);
    (QueueModel.update as jest.Mock).mockResolvedValue(mockQueueEntry);
    (QueueModel.getNextInQueue as jest.Mock).mockResolvedValue(null);

    await QueueController.songFinished(mockRequest, mockResponse);

    expect(queueEventService.playNextSong).toHaveBeenCalledWith(barId, null);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      message: 'No more songs in queue',
      data: {
        previous_song: mockQueueEntry,
        next_song: null
      }
    });
  });

  it('should return error if queueId is missing', async () => {
    mockRequest.body = {};

    await QueueController.songFinished(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'queueId is required'
    });
  });

  it('should return error if queue entry not found', async () => {
    const queueId = 'queue-123';
    mockRequest.body = { queueId };

    (QueueModel.findById as jest.Mock).mockResolvedValue(null);

    await QueueController.songFinished(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Queue entry not found'
    });
  });

  it('should return error if song is not currently playing', async () => {
    const queueId = 'queue-123';
    mockRequest.body = { queueId };

    const mockQueueEntry = {
      id: queueId,
      bar_id: 'bar-456',
      status: 'pending'
    };

    (QueueModel.findById as jest.Mock).mockResolvedValue(mockQueueEntry);

    await QueueController.songFinished(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Song is not currently playing'
    });
  });

  it('should handle database errors', async () => {
    const queueId = 'queue-123';
    mockRequest.body = { queueId };

    (QueueModel.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

    await QueueController.songFinished(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to handle song finished'
    });
  });
});