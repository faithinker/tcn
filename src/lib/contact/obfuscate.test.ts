import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OBFUSCATION_KEY,
  deobfuscateString,
  obfuscateString,
  toSafeNoscriptFallback,
} from './obfuscate';

describe('contact obfuscation', () => {
  it('correctly obfuscates and restores email addresses', () => {
    const email = 'mingoo@aks.ac.kr';
    const obfuscated = obfuscateString(email);

    expect(obfuscated).not.toContain('@');
    expect(obfuscated).not.toContain('mingoo');
    expect(obfuscated).not.toContain('aks.ac.kr');
    expect(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(obfuscated)).toBe(false);

    const restored = deobfuscateString(obfuscated);
    expect(restored).toBe(email);
  });

  it('correctly obfuscates and restores phone numbers', () => {
    const tel = '031-709-8111';
    const obfuscated = obfuscateString(tel);

    expect(obfuscated).not.toContain('-');
    expect(/\d{2,4}-\d{3,4}-\d{4}/.test(obfuscated)).toBe(false);

    const restored = deobfuscateString(obfuscated);
    expect(restored).toBe(tel);
  });

  it('supports custom cipher keys', () => {
    const raw = 'secret@example.com';
    const key = 0x3f;
    const obfuscated = obfuscateString(raw, key);

    expect(deobfuscateString(obfuscated, key)).toBe(raw);
    expect(deobfuscateString(obfuscated, DEFAULT_OBFUSCATION_KEY)).not.toBe(raw);
  });

  it('handles empty strings and edge cases', () => {
    expect(obfuscateString('')).toBe('');
    expect(deobfuscateString('')).toBe('');
  });

  it('formats safe noscript fallbacks without machine-harvestable patterns', () => {
    const email = 'mingoo@aks.ac.kr';
    const safeEmail = toSafeNoscriptFallback(email, 'email');
    expect(safeEmail).toBe('mingoo [at] aks.ac.kr');
    expect(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(safeEmail)).toBe(false);

    const phone = '031-709-8111';
    const safePhone = toSafeNoscriptFallback(phone, 'tel');
    expect(safePhone).toBe('031 - 709 - 8111');
    expect(/\d{2,4}-\d{3,4}-\d{4}/.test(safePhone)).toBe(false);
  });
});
