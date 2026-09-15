import { describe, expect, it } from 'vitest';
import { createWecomAdapter, verifyWecomUrl, wecomDecrypt, wecomSignature, xmlTag } from './index';

const token = 'QDG6eK';
const timestamp = '1409659813';
const nonce = '1372623149';
const encrypt =
  'RypEvHKD8QQKFhvQ6QleEB4J58tiPdvo+rtK1I9qca6aM/wvqnLSV5zEPeusUiX5L5X/0lWfrf0QADHHhGd3QczcdCUpj911L3vg3W/sYYvuJTs3TUUkSUXxaccAS0qhxchrRYt66wiSpGLYL42aM6A8dTT+6k4aSknmPj48kzJs8qLjvd4Xgpue06DOdnLxAUHzM6+kDZ+HMZfJYuR+LtwGc2hgf5gsijff0ekUNXZiqATP7PF5mZxZ3Izoun1s4zG4LUMnvw2r+KqCKIw+3IQH03v+BCA9nMELNqbSf6tiWSrXJB3LAVGUcallcrw8V2t9EL4EhzJWrQUax5wLVMNS0+rUPA3k22Ncx4XXZS9o0MBH27Bo6BpNelZpS+/uh9KsNlY6bHCmJU9p8g7m3fVKn28H3KDYA5Pl/T8Z1ptDAVe0lXdQ2YoyyH2uyPIGHBZZIs2pDBS8R07+qN+E7Q==';
const encodingAesKey = 'jWmYm7qr5nMoAUwZRjGtBxmz3KA1tkAj3ykkR6q2B2C';
const corpId = 'wx5823bf96d3bd56c7';

describe('wecom crypto', () => {
  it('matches the official signature fixture', () => {
    expect(wecomSignature(token, timestamp, nonce, encrypt)).toBe(
      '477715d11cdb4164915debcba66cb864d751f3e6',
    );
  });

  it('decrypts the official message fixture', () => {
    const xml = wecomDecrypt(encodingAesKey, encrypt, corpId);
    expect(xmlTag(xml, 'FromUserName')).toBe('mycreate');
    expect(xmlTag(xml, 'Content')).toBe('hello');
  });

  it('verifies GET echostr with the same ciphertext', () => {
    const plain = verifyWecomUrl({
      echostr: encrypt,
      timestamp,
      nonce,
      signature: '477715d11cdb4164915debcba66cb864d751f3e6',
      token,
      encodingAesKey,
      corpId,
    });
    expect(xmlTag(plain, 'Content')).toBe('hello');
  });
});

describe('createWecomAdapter', () => {
  it('treats every thread as a DM', () => {
    const adapter = createWecomAdapter({
      corpId,
      agentId: '218',
      appSecret: 'secret',
      token,
      encodingAesKey,
    });
    expect(adapter.name).toBe('wecom');
    expect(adapter.isDM()).toBe(true);
    expect(adapter.encodeThreadId({ userId: 'alice' })).toBe('wecom:alice');
  });
});
