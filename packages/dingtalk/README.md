# @edgeone/chat-adapter-dingtalk

[DingTalk](https://open.dingtalk.com) adapter for [Chat SDK](https://chat-sdk.dev).

Built for an **internal-app robot**. Verifies the `timestamp` / `sign` headers and replies through the robot OpenAPI (`oToMessages/batchSend` and `groupMessages/send`). It does **not** use the inbound `sessionWebhook` (that URL expires in about 30 seconds).

## Install

```bash
npm install chat @edgeone/chat-adapter-dingtalk
```

`chat` is a peer dependency (`^4.39.0`).

## Usage

```ts
import { Chat } from 'chat';
import { createDingtalkAdapter } from '@edgeone/chat-adapter-dingtalk';

const adapter = createDingtalkAdapter({
  appKey,
  appSecret,
  robotCode,
});

const chat = new Chat({
  userName: 'assistant',
  adapters: { dingtalk: adapter },
  state,
});
```

Point the robot HTTP callback at the route you pass to `chat.webhooks.dingtalk`.

## Config

| Field | Type | Source |
| --- | --- | --- |
| `appKey` | `string` | App Key of the internal app |
| `appSecret` | `string` | App Secret (also the webhook signing key) |
| `robotCode` | `string` | `robotCode` of the app robot |

All three fields are required. Config is camelCase; do not pass `DINGTALK_*` environment variable names into the package.

## Thread IDs

| Chat type | Thread ID | Reply API |
| --- | --- | --- |
| Direct message (`conversationType === '1'`) | `dingtalk:p2p:<staffId>` | `robot/oToMessages/batchSend` (`userIds`) |
| Group | `dingtalk:group:<conversationId>` | `robot/groupMessages/send` (`openConversationId`) |

`isDM` is true when the kind is `p2p`. Group messages are treated as mentions when `isInAtList` is true.

The group id is the inbound `conversationId`, sent as `openConversationId`. Confirm that mapping against your app if group replies fail.

## Webhook

`handleWebhook` requires:

- `timestamp` no more than one hour off (`dingtalkSignatureFresh`)
- `sign` equal to `HMAC-SHA256(timestamp + '\n' + appSecret)` in Base64 (`dingtalkSign`)

Non-text `msgtype` values are acknowledged with `200`.

Replies use `msgKey: sampleMarkdown`.

## Exports

| Export | Description |
| --- | --- |
| `createDingtalkAdapter` | Factory |
| `DingtalkAdapter` | Adapter class |
| `DingtalkAdapterConfig` | Config type |
| `DingtalkKind` / `DingtalkThreadId` | `p2p` \| `group` and `{ kind, id }` |
| `DingtalkRawMessage` | Inbound payload type |
| `dingtalkSign` | Webhook HMAC |
| `dingtalkSignatureFresh` | Reject stale timestamps |

## Limitations

- `editMessage`, reactions, history, delete, and typing throw.
- Only text inbound messages are processed.
- Group send assumes `conversationId` is a valid `openConversationId`.

## License

MIT
