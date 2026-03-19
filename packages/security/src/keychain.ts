import { createLogger } from '@docscope/shared-utils';
import process from 'node:process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const log = createLogger('keychain');

const ENCRYPTION_ALGO = 'aes-256-gcm';
const SALT = 'docscope-keychain-v1';

interface KeytarLike {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

// Attempt to load keytar (native module — may not be available on all platforms)
// If unavailable, fall back to encrypted file storage.
async function tryKeytar(): Promise<KeytarLike | null> {
  try {
    const kt = await import('keytar') as { default?: KeytarLike } & KeytarLike;
    return kt.default ?? kt;
  } catch {
    return null;
  }
}

function deriveKey(password: string): Buffer {
  return scryptSync(password, SALT, 32) as Buffer;
}

function encrypt(plaintext: string, password: string): string {
  const key = deriveKey(password);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
    tag: authTag.toString('hex'),
  });
}

function decrypt(ciphertext: string, password: string): string {
  const key = deriveKey(password);
  const { iv, data, tag } = JSON.parse(ciphertext) as {
    iv: string;
    data: string;
    tag: string;
  };
  const decipher = createDecipheriv(ENCRYPTION_ALGO, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8');
}

/**
 * KeychainStore — stores secrets in OS keychain (via keytar) with an
 * AES-256-GCM encrypted file fallback stored under `~/.config/docscope/`.
 */
export class KeychainStore {
  private readonly service = 'docscope';
  private readonly fallbackDir: string;
  private readonly fallbackFile: string;

  private get fallbackPassword(): string {
    const key = process.env['DOCSCOPE_MASTER_KEY'];
    if (!key) {
      throw new Error(`DOCSCOPE_MASTER_KEY must be set in the environment to store or read secrets securely when OS keychain is not available.`);
    }
    return key;
  }

  constructor() {
    const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? process.cwd();
    this.fallbackDir = join(home, '.config', 'docscope');
    this.fallbackFile = join(this.fallbackDir, 'secrets.enc');
  }

  async set(account: string, secret: string): Promise<void> {
    const kt = await tryKeytar();
    if (kt) {
      await kt.setPassword(this.service, account, secret);
      log.debug({ account }, 'Secret stored in OS keychain');
      return;
    }
    // Fallback: store in encrypted file
    this.fallbackSet(account, secret);
  }

  async get(account: string): Promise<string | null> {
    const kt = await tryKeytar();
    if (kt) {
      return kt.getPassword(this.service, account);
    }
    return this.fallbackGet(account);
  }

  async delete(account: string): Promise<boolean> {
    const kt = await tryKeytar();
    if (kt) {
      return kt.deletePassword(this.service, account);
    }
    return this.fallbackDelete(account);
  }

  private readFallback(): Record<string, string> {
    if (!existsSync(this.fallbackFile)) return {};
    try {
      const raw = readFileSync(this.fallbackFile, 'utf8');
      const decrypted = decrypt(raw, this.fallbackPassword);
      return JSON.parse(decrypted) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private writeFallback(data: Record<string, string>): void {
    mkdirSync(this.fallbackDir, { recursive: true });
    writeFileSync(this.fallbackFile, encrypt(JSON.stringify(data), this.fallbackPassword), 'utf8');
  }

  private fallbackSet(account: string, secret: string): void {
    const data = this.readFallback();
    data[account] = secret;
    this.writeFallback(data);
    log.debug({ account }, 'Secret stored in encrypted fallback file');
  }

  private fallbackGet(account: string): string | null {
    return this.readFallback()[account] ?? null;
  }

  private fallbackDelete(account: string): boolean {
    const data = this.readFallback();
    if (!(account in data)) return false;
    delete data[account];
    this.writeFallback(data);
    return true;
  }
}
