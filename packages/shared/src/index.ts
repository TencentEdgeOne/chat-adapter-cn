/**
 * Shared floor for community Chat SDK adapters (Feishu / WeCom / DingTalk).
 *
 * The Adapter interface still requires reactions, history, and edit — these
 * platforms either cannot edit a sent text message or this first release
 * does not implement those surfaces, so they throw.
 */

import { stringifyMarkdown, toPlainText } from 'chat';
import type {
  Adapter,
  AdapterPostableMessage,
  ChatInstance,
  EmojiValue,
  FetchOptions,
  FetchResult,
  FormattedContent,
  Message,
  RawMessage,
  ThreadInfo,
  WebhookOptions,
} from 'chat';

export function postableText(message: AdapterPostableMessage): string {
  if (typeof message === 'string') return message;
  if ('raw' in message && typeof message.raw === 'string') return message.raw;
  if ('markdown' in message && typeof message.markdown === 'string') return message.markdown;
  if ('ast' in message && message.ast) return toPlainText(message.ast);
  throw new Error('unsupported postable message');
}

export function plainFormatted(text: string): FormattedContent {
  return {
    type: 'root',
    children: text
      ? [{ type: 'paragraph', children: [{ type: 'text', value: text }] }]
      : [],
  };
}

type CachedToken = { token: string; expiresAt: number };
const tokens = new Map<string, CachedToken>();

export async function accessToken(
  kind: string,
  fetcher: () => Promise<{ token: string; expiresInSec: number }>,
): Promise<string> {
  const cached = tokens.get(kind);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const next = await fetcher();
  tokens.set(kind, {
    token: next.token,
    expiresAt: Date.now() + next.expiresInSec * 1000,
  });
  return next.token;
}

export async function postJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`${url} HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  }
  if (!res.ok) {
    const detail = String(body.message ?? body.msg ?? body.errmsg ?? text).slice(0, 200);
    throw new Error(`${url} HTTP ${res.status}: ${detail}`);
  }
  if (typeof body.code === 'number' && body.code !== 0) {
    throw new Error(`${url} failed code=${body.code} ${String(body.msg ?? '')}`.trim());
  }
  if (typeof body.errcode === 'number' && body.errcode !== 0) {
    throw new Error(`${url} failed errcode=${body.errcode} ${String(body.errmsg ?? '')}`.trim());
  }
  if (typeof body.code === 'string' && body.code) {
    throw new Error(`${url} failed code=${body.code} ${String(body.message ?? '')}`.trim());
  }
  return body as T;
}

export abstract class MinimalChatAdapter<TThreadId, TRawMessage> implements Adapter<
  TThreadId,
  TRawMessage
> {
  abstract readonly name: string;
  readonly userName = 'assistant';
  readonly persistThreadHistory = true;
  readonly lockScope = 'channel' as const;

  protected chat: ChatInstance | undefined;

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
  }

  abstract handleWebhook(request: Request, options?: WebhookOptions): Promise<Response>;
  abstract parseMessage(raw: TRawMessage): Message<TRawMessage>;
  abstract postMessage(
    threadId: string,
    message: AdapterPostableMessage,
  ): Promise<RawMessage<TRawMessage>>;
  abstract encodeThreadId(platformData: TThreadId): string;
  abstract decodeThreadId(threadId: string): TThreadId;
  abstract channelIdFromThreadId(threadId: string): string;

  renderFormatted(content: FormattedContent): string {
    return stringifyMarkdown(content);
  }

  async startTyping(): Promise<void> {
    /* none of these platforms expose a typing indicator we can use */
  }

  async addReaction(): Promise<void> {
    this.unsupported('addReaction');
  }
  async removeReaction(
    _threadId: string,
    _messageId: string,
    _emoji: EmojiValue | string,
  ): Promise<void> {
    this.unsupported('removeReaction');
  }
  async deleteMessage(): Promise<void> {
    this.unsupported('deleteMessage');
  }
  async editMessage(): Promise<RawMessage<TRawMessage>> {
    this.unsupported('editMessage');
  }
  async fetchMessages(
    _threadId: string,
    _options?: FetchOptions,
  ): Promise<FetchResult<TRawMessage>> {
    this.unsupported('fetchMessages');
  }
  async fetchThread(_threadId: string): Promise<ThreadInfo> {
    this.unsupported('fetchThread');
  }

  protected requireChat(): ChatInstance {
    if (!this.chat) throw new Error(`${this.name} adapter is not initialized`);
    return this.chat;
  }

  protected unsupported(feature: string): never {
    throw new Error(`${this.name} does not support ${feature}`);
  }
}
