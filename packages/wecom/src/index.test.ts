import { createCipheriv, randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WECOM_PROXY_URL,
  createWecomAdapter,
  resolveWecomProxyUrl,
  unwrapWecomProxyResponse,
  verifyWecomUrl,
  wecomDecrypt,
  wecomSignature,
  xmlTag,
} from './index';

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
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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

  it('posts gettoken and message/send through the SCF proxy', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as { path?: string };
      if (payload.path === '/cgi-bin/gettoken') {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 7200 }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ errcode: 0, errmsg: 'ok' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createWecomAdapter({
      corpId,
      agentId: '1000002',
      appSecret: 'secret',
      token,
      encodingAesKey,
    });
    await adapter.postMessage('wecom:alice', 'hello');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toBe(DEFAULT_WECOM_PROXY_URL);
    }
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body ?? '{}')));
    expect(bodies[0]).toEqual({
      path: '/cgi-bin/gettoken',
      method: 'GET',
      query: { corpid: corpId, corpsecret: 'secret' },
    });
    expect(bodies[1]).toMatchObject({
      path: '/cgi-bin/message/send',
      method: 'POST',
      query: { access_token: 'tok' },
      body: {
        touser: 'alice',
        msgtype: 'text',
        agentid: 1000002,
        text: { content: 'hello' },
      },
    });
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('qyapi.weixin.qq.com'))).toBe(
      true,
    );
  });

  it('rewrites an intranet Function URL to the public host', () => {
    expect(
      resolveWecomProxyUrl('https://1256816668-gzwfxjk50f.in.ap-singapore.tencentscf.com'),
    ).toBe(DEFAULT_WECOM_PROXY_URL);
    expect(DEFAULT_WECOM_PROXY_URL).not.toContain('.in.');
  });

  it('unwraps an API Gateway / Function URL envelope', () => {
    expect(
      unwrapWecomProxyResponse({
        isBase64Encoded: false,
        statusCode: 200,
        body: JSON.stringify({ access_token: 'tok', expires_in: 7200 }),
      }),
    ).toEqual({ access_token: 'tok', expires_in: 7200 });
  });

  it('rejects a Function URL echo of the adapter request', () => {
    expect(() =>
      unwrapWecomProxyResponse({
        httpMethod: 'POST',
        path: '/',
        requestContext: { sourceIp: '1.1.1.1' },
        body: JSON.stringify({
          path: '/cgi-bin/gettoken',
          method: 'GET',
          query: { corpid: 'x', corpsecret: 'x' },
        }),
      }),
    ).toThrow(/echoed the Function URL event/);
  });

  it('surfaces a Function URL echo instead of access_token missing', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          httpMethod: 'POST',
          path: '/',
          requestContext: { sourceIp: '1.1.1.1' },
          body: JSON.stringify({
            path: '/cgi-bin/gettoken',
            method: 'GET',
            query: { corpid: corpId, corpsecret: 'secret' },
          }),
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createWecomAdapter({
      corpId,
      agentId: '1000002',
      appSecret: 'secret',
      token,
      encodingAesKey,
    });
    await expect(adapter.postMessage('wecom:alice', 'hello')).rejects.toThrow(
      /echoed the Function URL event/,
    );
  });
});
