import { describe, expect, it } from 'vitest';
import { plainFormatted, postableText } from './index';

describe('postableText', () => {
  it('reads string, raw, and markdown shapes', () => {
    expect(postableText('plain')).toBe('plain');
    expect(postableText({ raw: 'raw' })).toBe('raw');
    expect(postableText({ markdown: '**hi**' })).toBe('**hi**');
  });
});

describe('plainFormatted', () => {
  it('wraps text in a paragraph root', () => {
    expect(plainFormatted('hi').type).toBe('root');
    expect(plainFormatted('').children).toEqual([]);
  });
});
