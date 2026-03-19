/**
 * SecretRedactor — masks API keys, paths, and other secrets in log strings.
 */
export class SecretRedactor {
  private readonly patterns: Array<{ pattern: RegExp; replacement: string }>;

  constructor(extraPatterns: RegExp[] = []) {
    this.patterns = [
      // Gemini / Google API keys (AIza...)
      { pattern: /AIza[0-9A-Za-z_-]{35}/g, replacement: 'AIza****' },
      // Generic "key=..." or "apiKey: ..." patterns
      { pattern: /(api[_-]?key|token|secret|password)[=:\s]+['"]?[^\s'"&,}]{8,}['"]?/gi, replacement: '$1=****' },
      // Absolute Windows paths
      { pattern: /[A-Za-z]:\\[^\s,'"]+/g, replacement: '<path>' },
      // Absolute UNIX paths (starting with /)
      { pattern: /\/(?:home|Users|root|var|etc|tmp)\/[^\s,'"]+/g, replacement: '<path>' },
      // Extra caller-supplied patterns
      ...extraPatterns.map((pattern) => ({ pattern, replacement: '****' })),
    ];
  }

  redact(input: string): string {
    let result = input;
    for (const { pattern, replacement } of this.patterns) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  redactObject<T>(obj: T): T {
    return JSON.parse(this.redact(JSON.stringify(obj))) as T;
  }
}
