import { describe, expect, it } from 'vitest';
import { bytesToHex, hmacSha256, sha256, textEncoder } from '.';

describe('shared crypto primitives', () => {
  it('computes SHA-256 bytes for text input', async () => {
    await expect(sha256('abc').then(bytesToHex)).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('computes HMAC-SHA256 bytes for text and byte input', async () => {
    await expect(hmacSha256('value', 'secret').then(bytesToHex)).resolves.toBe(
      '50e03ebe65be98bb8bf11ba2c892d54c079aca2b0d3b0162769c6d757a25434f',
    );
    await expect(hmacSha256(textEncoder.encode('value'), 'secret').then(bytesToHex)).resolves.toBe(
      '50e03ebe65be98bb8bf11ba2c892d54c079aca2b0d3b0162769c6d757a25434f',
    );
  });
});
