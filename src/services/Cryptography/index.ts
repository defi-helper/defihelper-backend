import { Factory } from '@services/Container';
import CryptoJSAes from 'crypto-js/aes';
import CryptoJSMD5 from 'crypto-js/md5';
import { enc as CryptoJSEncoding } from 'crypto-js';

export class Cryptography {
  constructor(private readonly key: string) {}

  md5 = (message: string): string => {
    return CryptoJSMD5(message).toString();
  };

  encrypt = (message: string): string => {
    return CryptoJSAes.encrypt(message, this.key).toString();
  };

  decrypt = (encrypted: string): string => {
    return CryptoJSAes.decrypt(encrypted, this.key).toString(CryptoJSEncoding.Utf8);
  };

  encryptJson = (rawJson: Record<string, any>): string => {
    return this.encrypt(JSON.stringify(rawJson));
  };

  decryptJson = (encryptedJson: string): Record<string, any> => {
    try {
      return JSON.parse(this.decrypt(encryptedJson));
    } catch (e) {
      return {};
    }
  };
}

export function cryptographyServiceFactory(key: string): Factory<Cryptography> {
  return () => new Cryptography(key);
}
