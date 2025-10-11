import { EnhancedYouTubeService } from '../../../src/services/enhancedYouTubeService';

describe('EnhancedYouTubeService', () => {
  let service: EnhancedYouTubeService;

  beforeEach(() => {
    // Get singleton instance
    service = EnhancedYouTubeService.getInstance();
  });

  describe('isAppropriateContent', () => {
    it('should return true for appropriate musical content', () => {
      const video = {
        title: 'Bohemian Rhapsody - Queen Official Music Video',
        description: 'Classic rock song by Queen',
        channelTitle: 'Queen Official',
        tags: ['rock', 'music', 'queen', 'classic']
      };

      // Access private method via type assertion
      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(true);
    });

    it('should return false for content with inappropriate keywords', () => {
      const video = {
        title: 'Some Song with NSFW content',
        description: 'This contains porn material',
        channelTitle: 'Random Channel',
        tags: ['music']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(false);
    });

    it('should return false for explicit language', () => {
      const video = {
        title: 'Song with explicit lyrics',
        description: 'Contains fuck and shit words',
        channelTitle: 'Rap Artist',
        tags: ['rap', 'hip hop']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(false);
    });

    it('should return false for violent content', () => {
      const video = {
        title: 'Song about violence',
        description: 'Lyrics contain kill and murder',
        channelTitle: 'Metal Band',
        tags: ['metal', 'heavy']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(false);
    });

    it('should return false for drug-related content', () => {
      const video = {
        title: 'Song about drugs',
        description: 'References to cocaine and heroin',
        channelTitle: 'Indie Artist',
        tags: ['indie', 'alternative']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(false);
    });

    it('should return false for hate speech', () => {
      const video = {
        title: 'Hate song',
        description: 'Contains racist content and nazi references',
        channelTitle: 'Controversial Artist',
        tags: ['controversial']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(false);
    });

    it('should return true for content with special characters and case variations', () => {
      const video = {
        title: 'SONG WITH SPECIAL CHARACTERS! @#$%',
        description: 'This is a clean song with ümlauts and ñoños',
        channelTitle: 'Official Music',
        tags: ['music', 'pop']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(true);
    });

    it('should return true for content with censored inappropriate words', () => {
      const video = {
        title: 'Song with f*ck and sh*t',
        description: 'Contains censored inappropriate words',
        channelTitle: 'Rap Music',
        tags: ['rap']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(true); // Censored words are not in the inappropriate keywords list
    });

    it('should handle empty or undefined fields gracefully', () => {
      const video = {
        title: 'Clean Song',
        description: undefined,
        channelTitle: '',
        tags: undefined
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(true);
    });

    it('should return true for music channels even without explicit music keywords', () => {
      const video = {
        title: 'Instrumental Track',
        description: 'No lyrics, just music',
        channelTitle: 'Records Official',
        tags: ['instrumental']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(true);
    });

    it('should return true for non-music content without inappropriate keywords', () => {
      const video = {
        title: 'Random Video',
        description: 'Not a music video',
        channelTitle: 'Random Channel',
        tags: ['random']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(true); // No inappropriate keywords, so allowed
    });

    it('should handle very long content strings', () => {
      const longString = 'music '.repeat(1000);
      const video = {
        title: 'Long Title ' + longString,
        description: 'Long description ' + longString,
        channelTitle: 'Music Channel',
        tags: ['music']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(true);
    });

    it('should be case insensitive for inappropriate keywords', () => {
      const video = {
        title: 'Song with PORN content',
        description: 'Contains NSFW material',
        channelTitle: 'Artist',
        tags: ['music']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(false);
    });

    it('should filter content with multiple inappropriate keywords', () => {
      const video = {
        title: 'Violent and explicit song',
        description: 'Contains violence, sex, and drugs references',
        channelTitle: 'Controversial Artist',
        tags: ['explicit', 'violent']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(false);
    });

    it('should filter content with inappropriate words even in music context', () => {
      const video = {
        title: 'Rock Band - Death Metal Song',
        description: 'Heavy metal track about death themes in music',
        channelTitle: 'Metal Records',
        tags: ['metal', 'rock', 'music']
      };

      const result = (service as any).isAppropriateContent(video);
      expect(result).toBe(false); // Contains 'death' which is flagged as inappropriate
    });
  });
});