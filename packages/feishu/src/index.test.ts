import { describe, expect, it } from 'vitest';
import {
  createFeishuAdapter,
  feishuDecrypt,
  feishuSignature,
  verifyFeishuUrl,
} from './index';

describe('feishu crypto', () => {
  it('decrypts the official fixture', () => {
    expect(
      feishuDecrypt('test key', 'P37w+VZImNgPEO1RBhJ6RtKl7n6zymIbEG1pReEzghk='),
    ).toBe('hello world');
  });

  it('produces a 64-char hex signature', () => {
    expect(feishuSignature('1', '2', 'test key', '{"hello":true}')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('extracts url_verification challenge', () => {
    expect(
      verifyFeishuUrl(
        JSON.stringify({ type: 'url_verification', challenge: 'abc-123', token: 'tok' }),
        'test key',
      ),
    ).toEqual({ challenge: 'abc-123' });
  });

  it('ignores ordinary events', () => {
    expect(verifyFeishuUrl(JSON.stringify({ header: { event_type: 'im.message.receive_v1' } }), 'k')).toBeUndefined();
  });
});

describe('createFeishuAdapter', () => {
  it('encodes p2p thread ids and reports isDM', () => {
    const adapter = createFeishuAdapter({
      appId: 'cli_test',
      appSecret: 'secret',
      encryptKey: 'enc',
      verificationToken: 'tok',
    });
    expect(adapter.name).toBe('feishu');
    expect(adapter.encodeThreadId({ chatId: 'oc_1', chatType: 'p2p' })).toBe('feishu:p2p:oc_1');
    expect(adapter.isDM('feishu:p2p:oc_1')).toBe(true);
    expect(adapter.isDM('feishu:group:oc_2')).toBe(false);
  });
});
