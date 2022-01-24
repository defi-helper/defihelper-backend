import { Factory } from '@services/Container';
import CryptoJSAes from 'crypto-js/aes';
import { enc as CryptoJSEncoding } from 'crypto-js';

export class Cryptography {
  constructor(private readonly key: string) {}

  encrypt(message: string): string {
    return CryptoJSAes.encrypt(message, this.key).toString();
  }

  decrypt(encrypted: string) {
    return CryptoJSAes.decrypt(encrypted, this.key).toString(CryptoJSEncoding.Utf8);
  }

  decryptJson(encryptedJson: string): Record<string, any> {
    try {
      return JSON.parse(this.decrypt(encryptedJson));
    } catch (e) {
      return {};
    }
  }
}

export function cryptographyServiceFactory(key: string): Factory<Cryptography> {
  return () => new Cryptography(key);
}
