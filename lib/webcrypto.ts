import { CryptoDigestAlgorithm, digest, getRandomValues, randomUUID } from 'expo-crypto';

type DigestAlgorithm = string | { name?: string };
type BinarySource = ArrayBuffer | ArrayBufferView;

const hasWebCryptoSupport = () =>
  typeof globalThis.crypto !== 'undefined' &&
  typeof globalThis.crypto.getRandomValues === 'function' &&
  typeof globalThis.crypto.subtle !== 'undefined' &&
  typeof globalThis.crypto.subtle.digest === 'function' &&
  typeof globalThis.TextEncoder !== 'undefined';

class Utf8TextEncoder {
  readonly encoding = 'utf-8';

  encode(input = ''): Uint8Array {
    const bytes: number[] = [];

    for (const character of input) {
      const codePoint = character.codePointAt(0);

      if (codePoint === undefined) {
        continue;
      }

      if (codePoint <= 0x7f) {
        bytes.push(codePoint);
        continue;
      }

      if (codePoint <= 0x7ff) {
        bytes.push(0xc0 | (codePoint >> 6));
        bytes.push(0x80 | (codePoint & 0x3f));
        continue;
      }

      if (codePoint <= 0xffff) {
        bytes.push(0xe0 | (codePoint >> 12));
        bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
        bytes.push(0x80 | (codePoint & 0x3f));
        continue;
      }

      bytes.push(0xf0 | (codePoint >> 18));
      bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    }

    return Uint8Array.from(bytes);
  }
}

const resolveDigestAlgorithm = (algorithm: DigestAlgorithm): CryptoDigestAlgorithm => {
  const name = (typeof algorithm === 'string' ? algorithm : algorithm?.name)?.toUpperCase();

  switch (name) {
    case 'SHA-1':
      return CryptoDigestAlgorithm.SHA1;
    case 'SHA-256':
      return CryptoDigestAlgorithm.SHA256;
    case 'SHA-384':
      return CryptoDigestAlgorithm.SHA384;
    case 'SHA-512':
      return CryptoDigestAlgorithm.SHA512;
    default:
      throw new TypeError(`Unsupported digest algorithm: ${String(name ?? algorithm)}`);
  }
};

const toUint8Array = (data: BinarySource): Uint8Array => {
  if (data instanceof ArrayBuffer) {
    return Uint8Array.from(new Uint8Array(data));
  }

  if (ArrayBuffer.isView(data)) {
    return Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  throw new TypeError('WebCrypto digest received an unsupported buffer source.');
};

const installWebCrypto = () => {
  if (hasWebCryptoSupport()) {
    return;
  }

  const cryptoObject = (globalThis.crypto ?? {}) as Record<string, any>;
  const subtleObject = (cryptoObject.subtle ?? {}) as Record<string, any>;

  if (typeof cryptoObject.getRandomValues !== 'function') {
    cryptoObject.getRandomValues = <T extends ArrayBufferView>(typedArray: T) =>
      getRandomValues(typedArray as any);
  }

  if (typeof cryptoObject.randomUUID !== 'function') {
    cryptoObject.randomUUID = () => randomUUID();
  }

  if (typeof subtleObject.digest !== 'function') {
    subtleObject.digest = async (algorithm: DigestAlgorithm, data: BinarySource) =>
      digest(
        resolveDigestAlgorithm(algorithm),
        toUint8Array(data) as unknown as ArrayBufferView<ArrayBuffer>
      );
  }

  cryptoObject.subtle = subtleObject;

  if (typeof globalThis.crypto === 'undefined') {
    Object.defineProperty(globalThis, 'crypto', {
      value: cryptoObject,
      configurable: true,
      writable: true,
    });
  }

  if (typeof globalThis.TextEncoder === 'undefined') {
    Object.defineProperty(globalThis, 'TextEncoder', {
      value: Utf8TextEncoder,
      configurable: true,
      writable: true,
    });
  }
};

installWebCrypto();
