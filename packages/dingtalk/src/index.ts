import { createHmac, timingSafeEqual } from 'node:crypto';
import { Message } from 'chat';
import type { AdapterPostableMessage, RawMessage, WebhookOptions } from 'chat';
import {
  MinimalChatAdapter,
  accessToken,
  plainFormatted,
  postJson,
  postableText,
} from '@edgeone/chat-adapter-cn-shared';
import type { DingtalkAdapterConfig, DingtalkKind, DingtalkRawMessage, DingtalkThreadId } from './types';

export type {
  DingtalkAdapterConfig,
  DingtalkKind,
  DingtalkRawMessage,
  DingtalkThreadId,
} from './types';

const SIGN_SKEW_MS = 60 * 60 * 1000;

export function dingtalkSign(timestamp: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(`${timestamp}\n${appSecret}`).digest('base64');
}

export function dingtalkSignatureFresh(timestamp: string, now = Date.now()): boolean {
  const ts = Number(timestamp);
  return Number.isFinite(ts) && Math.abs(now - ts) <= SIGN_SKEW_MS;
}

export class DingtalkAdapter extends MinimalChatAdapter<DingtalkThreadId, DingtalkRawMessage> {
  readonly name = 'dingtalk';

  constructor(private readonly config: DingtalkAdapterConfig) {
    super();
  }

  encodeThreadId(platformData: DingtalkThreadId): string {
    return `dingtalk:${platformData.kind}:${platformData.id}`;
  }

  decodeThreadId(threadId: string): DingtalkThreadId {
    const parts = threadId.split(':');
    if (parts[0] !== 'dingtalk' || (parts[1] !== 'p2p' && parts[1] !== 'group') || !parts[2]) {
      throw new Error(`invalid dingtalk thread id: ${threadId}`);
    }
    return { kind: parts[1], id: parts.slice(2).join(':') };
  }

  channelIdFromThreadId(threadId: string): string {
    return threadId;
  }

  isDM(threadId: string): boolean {
    return this.decodeThreadId(threadId).kind === 'p2p';
  }

  parseMessage(raw: DingtalkRawMessage): Message<DingtalkRawMessage> {
    const kind: DingtalkKind = raw.conversationType === '1' ? 'p2p' : 'group';
    const id = kind === 'p2p' ? raw.senderStaffId || raw.senderId || '' : raw.conversationId || '';
    const text = raw.text?.content?.trim() ?? '';
    const userId = raw.senderStaffId || raw.senderId || '';
    return new Message({
      id: raw.msgId || `${id}:${Date.now()}`,
      threadId: this.encodeThreadId({ kind, id }),
      text,
      formatted: plainFormatted(text),
      raw,
      author: {
        userId,
        userName: raw.senderNick || userId,
        fullName: raw.senderNick || userId,
        isBot: false,
        isMe: false,
      },
      metadata: { dateSent: new Date(), edited: false },
      attachments: [],
      isMention: kind === 'p2p' || raw.isInAtList === true,
    });
  }

  async postMessage(
    threadId: string,
    message: AdapterPostableMessage,
  ): Promise<RawMessage<DingtalkRawMessage>> {
    const { kind, id } = this.decodeThreadId(threadId);
    const text = postableText(message);
    const token = await this.token();
    const payload = {
      robotCode: this.config.robotCode,
      msgKey: 'sampleMarkdown',
      msgParam: JSON.stringify({ title: this.userName, text }),
    };
    if (kind === 'p2p') {
      await postJson('https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend', {
        method: 'POST',
        headers: { 'x-acs-dingtalk-access-token': token },
        body: JSON.stringify({ ...payload, userIds: [id] }),
      });
    } else {
      await postJson('https://api.dingtalk.com/v1.0/robot/groupMessages/send', {
        method: 'POST',
        headers: { 'x-acs-dingtalk-access-token': token },
        body: JSON.stringify({ ...payload, openConversationId: id }),
      });
    }
    return { id: `${kind}:${id}:${Date.now()}`, threadId, raw: { text: { content: text } } };
  }

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    const timestamp = request.headers.get('timestamp') ?? '';
    const sign = request.headers.get('sign') ?? '';
    if (!dingtalkSignatureFresh(timestamp)) {
      return new Response('unauthorized', { status: 401 });
    }
    const expected = dingtalkSign(timestamp, this.config.appSecret);
    const a = Buffer.from(sign);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return new Response('unauthorized', { status: 401 });
    }

    const raw = (await request.json()) as DingtalkRawMessage;
    if (raw.msgtype && raw.msgtype !== 'text') {
      return new Response('ok', { status: 200 });
    }
    const message = this.parseMessage(raw);
    if (!this.decodeThreadId(message.threadId).id) {
      throw new Error('dingtalk webhook missing conversation or sender id');
    }
    await this.requireChat().processMessage(this, message.threadId, message, options);
    return new Response('ok', { status: 200 });
  }

  private async token(): Promise<string> {
    return accessToken(`dingtalk:${this.config.appKey}`, async () => {
      const body = await postJson<{ accessToken?: string; expireIn?: number }>(
        'https://api.dingtalk.com/v1.0/oauth2/accessToken',
        {
          method: 'POST',
          body: JSON.stringify({
            appKey: this.config.appKey,
            appSecret: this.config.appSecret,
          }),
        },
      );
      if (!body.accessToken) throw new Error('dingtalk accessToken missing');
      return { token: body.accessToken, expiresInSec: body.expireIn ?? 7200 };
    });
  }
}

export function createDingtalkAdapter(config: DingtalkAdapterConfig): DingtalkAdapter {
  if (!config.appKey || !config.appSecret || !config.robotCode) {
    throw new Error('dingtalk adapter requires appKey, appSecret, robotCode');
  }
  return new DingtalkAdapter(config);
}
