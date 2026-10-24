export const DEFAULT_OBFUSCATION_KEY = 0x5a;

/**
 * Obfuscates a string so that static HTML responses do not expose
 * email addresses or telephone numbers to scrapers and regex crawlers.
 */
export function obfuscateString(value: string, key = DEFAULT_OBFUSCATION_KEY): string {
  let hex = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i) ^ key;
    hex += code.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Reverses obfuscation given the hex string and cipher key.
 */
export function deobfuscateString(hex: string, key = DEFAULT_OBFUSCATION_KEY): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16) ^ key;
    str += String.fromCharCode(code);
  }
  return str;
}

/**
 * Returns a human-readable safe fallback representation (e.g., for <noscript>)
 * so users without JavaScript can still read it while regex harvesters are deterred.
 */
export function toSafeNoscriptFallback(value: string, type: 'email' | 'tel' | 'text'): string {
  if (type === 'email') {
    return value.replace('@', ' [at] ');
  }
  if (type === 'tel') {
    return value.replace(/-/g, ' - ');
  }
  return value;
}
