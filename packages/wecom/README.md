# @edgeone/chat-adapter-wecom

[WeCom](https://developer.work.weixin.qq.com) (WeChat Work) adapter for [Chat SDK](https://chat-sdk.dev).

Built for a **self-built app in 1:1 chat**. Verifies `msg_signature`, decrypts XML callbacks, and replies through a fixed-IP SCF proxy (`gettoken` + `message/send` as text). Callers do not talk to `qyapi.weixin.qq.com` directly.

## Install

```bash
npm install chat @edgeone/chat-adapter-wecom
```

`chat` is a peer dependency (`^4.39.0`).

## Usage

```ts
import { Chat } from 'chat';
import { createWecomAdapter } from '@edgeone/chat-adapter-wecom';

const adapter = createWecomAdapter({
  corpId,
  agentId,
  appSecret,
  token,
  encodingAesKey,
});

const chat = new Chat({
  userName: 'assistant',
  adapters: { wecom: adapter },
  state,
});
```

Use one URL for both steps: **GET** is URL verification (`echostr`); **POST** is an encrypted message. Point that URL at the route you pass to `chat.webhooks.wecom`. Chat SDK only sees POST; run GET verification in the route with `verifyWecomUrl`.

## Config

| Field | Type | Source |
| --- | --- | --- |
| `corpId` | `string` | Corp ID |
| `agentId` | `string` | Agent ID of the self-built app |
| `appSecret` | `string` | App Secret |
| `token` | `string` | Token from Receive messages |
| `encodingAesKey` | `string` | 43-character EncodingAESKey |
| `proxyUrl` | `string` | Optional. Public SCF Function URL. Defaults to the built-in proxy. Intranet `*.in.<region>.tencentscf.com` is rewritten to the public host. |

The first five fields are required. `gettoken` and `message/send` always go through `proxyUrl`. Config is camelCase; do not pass `WECOM_*` environment variable names into the package.

## Thread IDs

Every conversation is a DM:

```
wecom:<userId>
```

`isDM` is always `true`. Group / app-home chat is out of scope.

## URL verification (GET)

WeCom sends `msg_signature`, `timestamp`, `nonce`, and `echostr`. After the signature checks out, decrypt `echostr` and return the **plaintext** as `text/plain`:

```ts
import { verifyWecomUrl } from '@edgeone/chat-adapter-wecom';

const plain = verifyWecomUrl({
  echostr,
  timestamp,
  nonce,
  signature: msgSignature,
  token,
  encodingAesKey,
  corpId,
});
return new Response(plain, { headers: { 'Content-Type': 'text/plain' } });
```

Decrypt uses PKCS7 unpadding by hand (`setAutoPadding(false)`). Node auto-padding rejects the official WeCom ciphertext fixture.

## Webhook (POST)

`handleWebhook` reads `Encrypt` from the XML body, checks `msg_signature`, decrypts with `encodingAesKey` / `corpId`, and processes `MsgType=text`. Other types are acknowledged with `200`.

`postMessage` sends `msgtype: text` to `cgi-bin/message/send` via the proxy. WeCom's markdown client renders unsupported syntax as「同上。」

## Exports

| Export | Description |
| --- | --- |
| `createWecomAdapter` | Factory |
| `WecomAdapter` | Adapter class |
| `WecomAdapterConfig` | Config type |
| `WecomThreadId` | `{ userId }` |
| `WecomRawMessage` / `WecomUrlVerification` | Payload types |
| `wecomSignature` | SHA-1 of the sorted `token`, `timestamp`, `nonce`, `encrypt` |
| `wecomDecrypt` | AES-256-CBC decrypt + receive-id check |
| `xmlTag` | Read a tag from XML (`CDATA` or plain) |
| `verifyWecomUrl` | GET `echostr` → plaintext |
| `DEFAULT_WECOM_PROXY_URL` / `resolveWecomProxyUrl` | Built-in public proxy URL |

## Limitations

- 1:1 self-built app only.
- `editMessage` throws. `update_template_card` is a one-shot button `response_code`; this release always posts a new message.
- Reactions, history, delete, and typing are unsupported.

## License

MIT
