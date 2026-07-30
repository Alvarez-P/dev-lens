import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Password hashing service.
 * Wraps bcrypt for password hashing and comparison.
 */
@Injectable()
export class PasswordService {
  /**
   * Hash a plain text password.
   */
  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, SALT_ROUNDS);
  }

  /**
   * Compare a plain text password against a hash.
   */
  async compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
