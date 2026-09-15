# @edgeone/chat-adapter-feishu

[Feishu / Lark](https://open.feishu.cn) adapter for [Chat SDK](https://chat-sdk.dev).

Verifies encrypted event callbacks, handles URL verification, and posts text replies through the Feishu IM API.

## Install

```bash
npm install chat @edgeone/chat-adapter-feishu
```

`chat` is a peer dependency (`^4.39.0`).

## Usage

```ts
import { Chat } from 'chat';
import { createFeishuAdapter } from '@edgeone/chat-adapter-feishu';

const adapter = createFeishuAdapter({
  appId,
  appSecret,
  encryptKey,
  verificationToken,
});

const chat = new Chat({
  userName: 'assistant',
  adapters: { feishu: adapter },
  state,
});
```

Point the Feishu event Request URL at the route you pass to `chat.webhooks.feishu`. Subscribe to **`im.message.receive_v1`**. Enable encryption on **Events and Callbacks → Encryption**.

## Config

| Field | Type | Source |
| --- | --- | --- |
| `appId` | `string` | App ID |
| `appSecret` | `string` | App Secret |
| `encryptKey` | `string` | Encrypt Key |
| `verificationToken` | `string` | Verification Token |

All four fields are required. Config is camelCase; do not pass `FEISHU_*` environment variable names into the package.

## Thread IDs

| Chat type | Thread ID |
| --- | --- |
| Direct message | `feishu:p2p:<chatId>` |
| Group | `feishu:group:<chatId>` |

`isDM` is true when the middle segment is `p2p`. Mentions in a group are detected against the bot `open_id` from `bot/v3/info`.

## Webhook

`handleWebhook` checks `x-lark-request-timestamp`, `x-lark-request-nonce`, and `x-lark-signature`, decrypts the body when `encrypt` is present, and rejects a mismatched verification token.

URL verification (`type === 'url_verification'`) returns `{ challenge }`. You can also run that step in a thin handshake route before the Chat SDK sees the request:

```ts
import { verifyFeishuUrl } from '@edgeone/chat-adapter-feishu';

const verified = verifyFeishuUrl(rawBody, encryptKey);
if (verified) return Response.json({ challenge: verified.challenge });
```

`postMessage` sends `msg_type: text` to `open-apis/im/v1/messages` with `receive_id_type=chat_id`.

## Exports

| Export | Description |
| --- | --- |
| `createFeishuAdapter` | Factory |
| `FeishuAdapter` | Adapter class |
| `FeishuAdapterConfig` | Config type |
| `FeishuThreadId` | `{ chatId, chatType }` |
| `FeishuRawMessage` / `FeishuEvent` | Inbound payload types |
| `feishuDecrypt` | AES-256-CBC decrypt (`SHA-256(encryptKey)` as the key) |
| `feishuSignature` | `SHA-256(timestamp + nonce + encryptKey + body)` |
| `parseFeishuEvent` | Decrypt if needed, then parse JSON |
| `verifyFeishuUrl` | Return `{ challenge }` for `url_verification` |

## Limitations

- `editMessage`, reactions, history, and delete throw. Feishu PATCH only updates interactive cards; this release always posts a new text message.
- No typing indicator.
- Only `im.message.receive_v1` text messages are processed; other event types are acknowledged with `200`.

## License

MIT
