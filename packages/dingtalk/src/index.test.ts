import { describe, expect, it } from 'vitest';
import { createDingtalkAdapter, dingtalkSign, dingtalkSignatureFresh } from './index';

describe('dingtalk sign', () => {
  it('is stable for the same timestamp and secret', () => {
    expect(dingtalkSign('1613630252678', 'SECxxx')).toBe(dingtalkSign('1613630252678', 'SECxxx'));
  });

  it('accepts a fresh timestamp and rejects one older than an hour', () => {
    expect(dingtalkSignatureFresh(String(Date.now()))).toBe(true);
    expect(dingtalkSignatureFresh(String(Date.now() - 2 * 60 * 60 * 1000))).toBe(false);
  });
});

describe('createDingtalkAdapter', () => {
  it('distinguishes p2p and group thread ids', () => {
    const adapter = createDingtalkAdapter({
      appKey: 'key',
      appSecret: 'secret',
      robotCode: 'robot',
    });
    expect(adapter.name).toBe('dingtalk');
    expect(adapter.isDM('dingtalk:p2p:staff1')).toBe(true);
    expect(adapter.isDM('dingtalk:group:cid1')).toBe(false);
  });
});
