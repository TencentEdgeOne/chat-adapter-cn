import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { Message } from 'chat';
import type { AdapterPostableMessage, RawMessage, WebhookOptions } from 'chat';
import {
  MinimalChatAdapter,
  accessToken,
  plainFormatted,
  postJson,
  postableText,
} from '@edgeone/chat-adapter-cn-shared';
import type { FeishuAdapterConfig, FeishuEvent, FeishuRawMessage, FeishuThreadId } from './types';

export type { FeishuAdapterConfig, FeishuEvent, FeishuRawMessage, FeishuThreadId } from './types';

export function feishuSignature(
  timestamp: string,
  nonce: string,
  encryptKey: string,
  body: string,
): string {
  return createHash('sha256').update(timestamp + nonce + encryptKey + body).digest('hex');
}

export function feishuDecrypt(encryptKey: string, encrypt: string): string {
  const key = createHash('sha256').update(encryptKey).digest();
  const buf = Buffer.from(encrypt, 'base64');
  const decipher = createDecipheriv('aes-256-cbc', key, buf.subarray(0, 16));
  return Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]).toString('utf8');
}

export function parseFeishuEvent(rawBody: string, encryptKey: string): FeishuEvent {
  const outer = JSON.parse(rawBody) as { encrypt?: unknown } & FeishuEvent;
  if (typeof outer.encrypt === 'string' && outer.encrypt) {
    return JSON.parse(feishuDecrypt(encryptKey, outer.encrypt)) as FeishuEvent;
  }
  return outer;
}

/** Decrypt if needed and return the challenge when this is a URL verification. */
export function verifyFeishuUrl(
  rawBody: string,
  encryptKey: string,
): { challenge: string } | undefined {
  try {
    const event = parseFeishuEvent(rawBody, encryptKey);
    if (event.type === 'url_verification' && typeof event.challenge === 'string') {
      return { challenge: event.challenge };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function messageText(raw: FeishuRawMessage): string {
  if (!raw.content) return '';
  try {
    const content = JSON.parse(raw.content) as { text?: unknown };
    return typeof content.text === 'string' ? content.text : raw.content;
  } catch {
    return raw.content;
  }
}

export class FeishuAdapter extends MinimalChatAdapter<FeishuThreadId, FeishuRawMessage> {
  readonly name = 'feishu';
  private botOpenId: string | undefined;

  constructor(private readonly config: FeishuAdapterConfig) {
    super();
  }

  encodeThreadId(platformData: FeishuThreadId): string {
    return `feishu:${platformData.chatType}:${platformData.chatId}`;
  }

  decodeThreadId(threadId: string): FeishuThreadId {
    const parts = threadId.split(':');
    if (parts[0] !== 'feishu' || (parts[1] !== 'p2p' && parts[1] !== 'group') || !parts[2]) {
      throw new Error(`invalid feishu thread id: ${threadId}`);
    }
    return { chatType: parts[1], chatId: parts.slice(2).join(':') };
  }

  channelIdFromThreadId(threadId: string): string {
    return threadId;
  }

  isDM(threadId: string): boolean {
    return this.decodeThreadId(threadId).chatType === 'p2p';
  }

  parseMessage(raw: FeishuRawMessage): Message<FeishuRawMessage> {
    const text = messageText(raw);
    const senderId = raw.sender?.sender_id?.open_id || raw.sender?.sender_id?.user_id || '';
    const mentioned = (raw.mentions ?? []).some(
      (m) => m.id?.open_id && this.botOpenId && m.id.open_id === this.botOpenId,
    );
    return new Message({
      id: raw.message_id,
      threadId: this.encodeThreadId({
        chatId: raw.chat_id,
        chatType: raw.chat_type === 'p2p' ? 'p2p' : 'group',
      }),
      text,
      formatted: plainFormatted(text),
      raw,
      author: {
        userId: senderId,
        userName: senderId,
        fullName: senderId,
        isBot: raw.sender?.sender_type === 'app',
        isMe: Boolean(this.botOpenId && senderId === this.botOpenId),
      },
      metadata: { dateSent: new Date(), edited: false },
      attachments: [],
      isMention:
        raw.chat_type === 'p2p' ||
        mentioned ||
        (!this.botOpenId && (raw.mentions ?? []).length > 0),
    });
  }

  async postMessage(
    threadId: string,
    message: AdapterPostableMessage,
  ): Promise<RawMessage<FeishuRawMessage>> {
    const { chatId } = this.decodeThreadId(threadId);
    const text = postableText(message);
    const token = await this.tenantToken();
    const body = await postJson<{ data?: { message_id?: string } }>(
      'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text }),
        }),
      },
    );
    const messageId = body.data?.message_id;
    if (!messageId) throw new Error('feishu postMessage returned no message_id');
    return {
      id: messageId,
      threadId,
      raw: {
        message_id: messageId,
        chat_id: chatId,
        chat_type: this.decodeThreadId(threadId).chatType,
      },
    };
  }

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    const rawBody = await request.text();
    if (!this.verifySignature(request, rawBody)) {
      return new Response('unauthorized', { status: 401 });
    }
    const event = parseFeishuEvent(rawBody, this.config.encryptKey);
    const token = event.header?.token ?? event.token;
    if (token && token !== this.config.verificationToken) {
      return new Response('unauthorized', { status: 401 });
    }
    if (event.type === 'url_verification' && event.challenge) {
      return Response.json({ challenge: event.challenge });
    }

    const headerType = event.header?.event_type;
    const raw = event.event?.message;
    if (headerType !== 'im.message.receive_v1' || !raw?.chat_id || !raw.message_id) {
      return new Response('ok', { status: 200 });
    }
    raw.sender = event.event?.sender;
    await this.ensureBotOpenId();
    const message = this.parseMessage(raw);
    await this.requireChat().processMessage(this, message.threadId, message, options);
    return new Response('ok', { status: 200 });
  }

  private verifySignature(request: Request, rawBody: string): boolean {
    const timestamp = request.headers.get('x-lark-request-timestamp') ?? '';
    const nonce = request.headers.get('x-lark-request-nonce') ?? '';
    const provided = request.headers.get('x-lark-signature') ?? '';
    if (!timestamp || !nonce || !provided) return false;
    const expected = feishuSignature(timestamp, nonce, this.config.encryptKey, rawBody);
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async tenantToken(): Promise<string> {
    return accessToken(`feishu:${this.config.appId}`, async () => {
      const body = await postJson<{ tenant_access_token?: string; expire?: number }>(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          method: 'POST',
          body: JSON.stringify({
            app_id: this.config.appId,
            app_secret: this.config.appSecret,
          }),
        },
      );
      if (!body.tenant_access_token) throw new Error('feishu tenant_access_token missing');
      return { token: body.tenant_access_token, expiresInSec: body.expire ?? 7200 };
    });
  }

  private async ensureBotOpenId(): Promise<void> {
    if (this.botOpenId) return;
    const token = await this.tenantToken();
    const body = await postJson<{ bot?: { open_id?: string } }>(
      'https://open.feishu.cn/open-apis/bot/v3/info',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
    );
    this.botOpenId = body.bot?.open_id;
  }
}

export function createFeishuAdapter(config: FeishuAdapterConfig): FeishuAdapter {
  if (!config.appId || !config.appSecret || !config.encryptKey || !config.verificationToken) {
    throw new Error('feishu adapter requires appId, appSecret, encryptKey, verificationToken');
  }
  return new FeishuAdapter(config);
}
