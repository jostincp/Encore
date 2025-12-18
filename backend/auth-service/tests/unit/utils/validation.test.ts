import { cleanPhoneNumber, validatePhone } from '../../../src/utils/validation';

describe('Phone Validation Utils', () => {
  describe('cleanPhoneNumber', () => {
    it('should remove spaces', () => {
      expect(cleanPhoneNumber('+57 300 123 4567')).toBe('+573001234567');
    });

    it('should remove parentheses and dashes', () => {
      expect(cleanPhoneNumber('+1 (555) 123-4567')).toBe('+15551234567');
    });

    it('should keep the leading plus', () => {
      expect(cleanPhoneNumber('+573001234567')).toBe('+573001234567');
    });

    it('should not add plus if missing (logic update check)', () => {
      // Logic: if it starts with +, clean. If not, just clean digits.
      // Validation will fail later if + is missing, but cleanPhoneNumber just cleans.
      expect(cleanPhoneNumber('3001234567')).toBe('3001234567');
    });

    it('should handle empty input', () => {
      expect(cleanPhoneNumber('')).toBe('');
    });
  });

  describe('validatePhone', () => {
    it('should accept valid E.164 numbers', () => {
      expect(validatePhone('+573001234567')).toBe(true);
      expect(validatePhone('+15551234567')).toBe(true);
    });

    it('should reject numbers without plus', () => {
      expect(validatePhone('573001234567')).toBe(false);
    });

    it('should reject numbers with spaces or other chars', () => {
      // validatePhone expects cleaned input or strict format? 
      // The implementation is strict: /^\+[1-9]\d{7,14}$/
      expect(validatePhone('+57 300 123')).toBe(false);
    });

    it('should reject numbers too short', () => {
      expect(validatePhone('+1234567')).toBe(false); // < 8 digits
    });

    it('should reject numbers too long', () => {
      expect(validatePhone('+1234567890123456')).toBe(false); // > 15 digits
    });
  });
});
