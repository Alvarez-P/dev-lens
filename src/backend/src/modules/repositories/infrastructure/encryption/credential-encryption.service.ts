import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../../../config/config.service';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

@Injectable()
export class CredentialEncryptionService {
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyHex = configService.repo.credentialEncryptionKey;
    if (!keyHex) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY is not configured');
    }

    // Derive a 32-byte key from the configured hex string
    const hash = crypto.createHash('sha256');
    hash.update(keyHex);
    this.encryptionKey = hash.digest();
  }

  /**
   * Encrypt a plaintext value.
   * Returns a base64-encoded string: iv + authTag + ciphertext.
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Concatenate: iv (16) + authTag (16) + ciphertext
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
    return combined.toString('base64');
  }

  /**
   * Decrypt a base64-encoded encrypted value.
   */
  decrypt(encryptedBase64: string): string {
    const combined = Buffer.from(encryptedBase64, 'base64');

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext.toString('hex'), 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }
}
