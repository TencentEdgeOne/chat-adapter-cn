import { createCipheriv, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createWecomAdapter, verifyWecomUrl, wecomDecrypt, wecomSignature, xmlTag } from './index';

const token = 'test-token';
const timestamp = '1700000000';
const nonce = 'nonce-1';
const encodingAesKey = randomBytes(32).toString('base64').replace(/=+$/, '');
const corpId = 'ww-test-corp';
const sampleXml =
  '<xml><FromUserName><![CDATA[alice]]></FromUserName><Content><![CDATA[hello]]></Content></xml>';

function pkcs7Pad(buf: Buffer, blockSize = 32): Buffer {
  const n = blockSize - (buf.length % blockSize);
  return Buffer.concat([buf, Buffer.alloc(n, n)]);
}

function wecomEncrypt(plain: string, receiveId: string): string {
  const key = Buffer.from(`${encodingAesKey}=`, 'base64');
  const iv = key.subarray(0, 16);
  const msg = Buffer.from(plain, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(msg.length);
  const raw = pkcs7Pad(Buffer.concat([randomBytes(16), len, msg, Buffer.from(receiveId)]));
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(raw), cipher.final()]).toString('base64');
}

describe('wecom crypto', () => {
  it('is stable for the same inputs', () => {
    expect(wecomSignature(token, timestamp, nonce, 'cipher')).toBe(
      wecomSignature(token, timestamp, nonce, 'cipher'),
    );
  });

  it('decrypts a locally encrypted message', () => {
    const xml = wecomDecrypt(encodingAesKey, wecomEncrypt(sampleXml, corpId), corpId);
    expect(xmlTag(xml, 'FromUserName')).toBe('alice');
    expect(xmlTag(xml, 'Content')).toBe('hello');
  });

  it('verifies GET echostr with locally encrypted ciphertext', () => {
    const echostr = wecomEncrypt(sampleXml, corpId);
    const plain = verifyWecomUrl({
      echostr,
      timestamp,
      nonce,
      signature: wecomSignature(token, timestamp, nonce, echostr),
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
      agentId: '1',
      appSecret: 'secret',
      token,
      encodingAesKey,
    });
    expect(adapter.name).toBe('wecom');
    expect(adapter.isDM()).toBe(true);
    expect(adapter.encodeThreadId({ userId: 'alice' })).toBe('wecom:alice');
  });
});
