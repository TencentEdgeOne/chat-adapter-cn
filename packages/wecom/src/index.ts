import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { Message } from 'chat';
import type { AdapterPostableMessage, RawMessage, WebhookOptions } from 'chat';
import {
  MinimalChatAdapter,
  accessToken,
  plainFormatted,
  postJson,
  postableText,
} from 'chat-adapter-cn-shared';
import type {
  WecomAdapterConfig,
  WecomRawMessage,
  WecomThreadId,
  WecomUrlVerification,
} from './types';

export type {
  WecomAdapterConfig,
  WecomRawMessage,
  WecomThreadId,
  WecomUrlVerification,
} from './types';

export function xmlTag(xml: string, tag: string): string {
  const cdata = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  if (cdata?.[1] != null) return cdata[1];
  const plain = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return plain?.[1] ?? '';
}

export function wecomSignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
): string {
  return createHash('sha1').update([token, timestamp, nonce, encrypt].sort().join('')).digest('hex');
}

export function wecomDecrypt(encodingAesKey: string, encrypt: string, receiveId: string): string {
  const key = Buffer.from(`${encodingAesKey}=`, 'base64');
  if (key.length !== 32) throw new Error('encodingAesKey must decode to 32 bytes');
  const iv = key.subarray(0, 16);
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  // Official WXBizMsgCrypt turns PKCS7 off and strips it by hand — Node's
  // auto-padding rejects the same ciphertext the docs ship as a fixture.
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([decipher.update(encrypt, 'base64'), decipher.final()]);
  const pad = decrypted[decrypted.length - 1];
  if (!pad || pad > 32) throw new Error('wecom decrypt: invalid pkcs7 padding');
  const unpadded = decrypted.subarray(0, decrypted.length - pad);
  const msgLen = unpadded.readUInt32BE(16);
  const msg = unpadded.subarray(20, 20 + msgLen).toString('utf8');
  const id = unpadded.subarray(20 + msgLen).toString('utf8');
  if (id !== receiveId) throw new Error(`wecom receiveid mismatch: got ${id}`);
  return msg;
}

function equalSig(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function query(url: string): URLSearchParams {
  try {
    return new URL(url, 'https://unused.local').searchParams;
  } catch {
    return new URLSearchParams();
  }
}

/** Decrypt GET echostr after verifying msg_signature. Returns plaintext. */
export function verifyWecomUrl(input: WecomUrlVerification): string {
  const expected = wecomSignature(input.token, input.timestamp, input.nonce, input.echostr);
  if (!equalSig(input.signature, expected)) throw new Error('wecom GET handshake signature mismatch');
  return wecomDecrypt(input.encodingAesKey, input.echostr, input.corpId);
}

export class WecomAdapter extends MinimalChatAdapter<WecomThreadId, WecomRawMessage> {
  readonly name = 'wecom';

  constructor(private readonly config: WecomAdapterConfig) {
    super();
  }

  encodeThreadId(platformData: WecomThreadId): string {
    return `wecom:${platformData.userId}`;
  }

  decodeThreadId(threadId: string): WecomThreadId {
    const parts = threadId.split(':');
    if (parts[0] !== 'wecom' || !parts[1]) throw new Error(`invalid wecom thread id: ${threadId}`);
    return { userId: parts.slice(1).join(':') };
  }

  channelIdFromThreadId(threadId: string): string {
    return threadId;
  }

  isDM(): boolean {
    return true;
  }

  parseMessage(raw: WecomRawMessage): Message<WecomRawMessage> {
    const text = raw.Content ?? '';
    return new Message({
      id: raw.MsgId || `${raw.FromUserName}:${raw.CreateTime ?? Date.now()}`,
      threadId: this.encodeThreadId({ userId: raw.FromUserName }),
      text,
      formatted: plainFormatted(text),
      raw,
      author: {
        userId: raw.FromUserName,
        userName: raw.FromUserName,
        fullName: raw.FromUserName,
        isBot: false,
        isMe: false,
      },
      metadata: {
        dateSent: raw.CreateTime ? new Date(Number(raw.CreateTime) * 1000) : new Date(),
        edited: false,
      },
      attachments: [],
      isMention: true,
    });
  }

  async postMessage(
    threadId: string,
    message: AdapterPostableMessage,
  ): Promise<RawMessage<WecomRawMessage>> {
    const { userId } = this.decodeThreadId(threadId);
    const text = postableText(message);
    const token = await this.token();
    await postJson(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          touser: userId,
          msgtype: 'markdown',
          agentid: Number(this.config.agentId) || this.config.agentId,
          markdown: { content: text },
        }),
      },
    );
    return {
      id: `${userId}:${Date.now()}`,
      threadId,
      raw: { FromUserName: userId, MsgId: '', MsgType: 'markdown', Content: text },
    };
  }

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    const rawBody = await request.text();
    const params = query(request.url);
    const encrypt = xmlTag(rawBody, 'Encrypt');
    if (!encrypt) throw new Error('wecom webhook missing Encrypt');
    const signature = params.get('msg_signature') ?? '';
    const timestamp = params.get('timestamp') ?? '';
    const nonce = params.get('nonce') ?? '';
    const expected = wecomSignature(this.config.token, timestamp, nonce, encrypt);
    if (!equalSig(signature, expected)) {
      return new Response('unauthorized', { status: 401 });
    }
    const xml = wecomDecrypt(this.config.encodingAesKey, encrypt, this.config.corpId);
    const raw: WecomRawMessage = {
      FromUserName: xmlTag(xml, 'FromUserName'),
      MsgId: xmlTag(xml, 'MsgId'),
      MsgType: xmlTag(xml, 'MsgType'),
      Content: xmlTag(xml, 'Content'),
      CreateTime: xmlTag(xml, 'CreateTime'),
      AgentID: xmlTag(xml, 'AgentID'),
    };
    if (raw.MsgType !== 'text' || !raw.FromUserName) {
      return new Response('ok', { status: 200 });
    }
    const message = this.parseMessage(raw);
    await this.requireChat().processMessage(this, message.threadId, message, options);
    return new Response('ok', { status: 200 });
  }

  private async token(): Promise<string> {
    return accessToken(`wecom:${this.config.corpId}:${this.config.agentId}`, async () => {
      const url =
        `https://qyapi.weixin.qq.com/cgi-bin/gettoken` +
        `?corpid=${encodeURIComponent(this.config.corpId)}` +
        `&corpsecret=${encodeURIComponent(this.config.appSecret)}`;
      const body = await postJson<{ access_token?: string; expires_in?: number }>(url, {
        method: 'GET',
      });
      if (!body.access_token) throw new Error('wecom access_token missing');
      return { token: body.access_token, expiresInSec: body.expires_in ?? 7200 };
    });
  }
}

export function createWecomAdapter(config: WecomAdapterConfig): WecomAdapter {
  if (
    !config.corpId ||
    !config.agentId ||
    !config.appSecret ||
    !config.token ||
    !config.encodingAesKey
  ) {
    throw new Error('wecom adapter requires corpId, agentId, appSecret, token, encodingAesKey');
  }
  return new WecomAdapter(config);
}
