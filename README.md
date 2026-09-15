# chat-adapter-cn

Community [Chat SDK](https://chat-sdk.dev) adapters for Feishu, WeCom, and DingTalk.

The `@chat-adapter/*` npm scope is reserved for Vercel. These packages are published under `@edgeone` as `chat-adapter-<platform>`.

| Package | Platform | Scope |
| --- | --- | --- |
| [`@edgeone/chat-adapter-feishu`](packages/feishu) | [Feishu / Lark](https://open.feishu.cn) | DMs and group chats |
| [`@edgeone/chat-adapter-wecom`](packages/wecom) | [WeCom](https://developer.work.weixin.qq.com) | Self-built app, 1:1 only |
| [`@edgeone/chat-adapter-dingtalk`](packages/dingtalk) | [DingTalk](https://open.dingtalk.com) | Internal-app robot |
| [`@edgeone/chat-adapter-cn-shared`](packages/shared) | — | Shared floor (not a direct consumer dependency) |

## Install

```bash
npm install chat @edgeone/chat-adapter-feishu
# or
npm install chat @edgeone/chat-adapter-wecom
# or
npm install chat @edgeone/chat-adapter-dingtalk
```

`chat` is a peer dependency (`^4.39.0`).

## Usage

```ts
import { Chat } from 'chat';
import { createFeishuAdapter } from '@edgeone/chat-adapter-feishu';

const chat = new Chat({
  userName: 'assistant',
  adapters: {
    feishu: createFeishuAdapter({
      appId,
      appSecret,
      encryptKey,
      verificationToken,
    }),
  },
  state,
});
```

Each adapter implements webhook verification and `postMessage`. Point the vendor callback URL at the same HTTP route you pass to `chat.webhooks.<name>`.

## Capabilities

| Surface | Feishu | WeCom | DingTalk |
| --- | --- | --- | --- |
| Verify inbound webhooks | Yes | Yes | Yes |
| `postMessage` (text / markdown) | Yes | Yes | Yes |
| Edit a sent message | No | No | No |
| Reactions, history, delete | No | No | No |
| Typing indicator | No | No | No |

Feishu can only PATCH interactive cards. WeCom `update_template_card` is a one-shot button callback. This release always posts a new message instead of editing.

Thread IDs include a DM vs group prefix so Chat SDK `isDM` works:

- Feishu: `feishu:p2p:<chatId>` / `feishu:group:<chatId>`
- WeCom: `wecom:<userId>` (always a DM)
- DingTalk: `dingtalk:p2p:<staffId>` / `dingtalk:group:<conversationId>`

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## Publishing

CI uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC). There is no `NPM_TOKEN`.

npm cannot attach a Trusted Publisher until the package name exists. Publish `0.1.0` once from a logged-in machine, then on each package page go to **Settings → Trusted Publisher → GitHub Actions**:

- Organization or user: `bleembleem`
- Repository: `chat-adapter-cn`
- Workflow filename: `publish.yml`
- Environment: leave empty
- Allowed action: `npm publish`

Later releases: push a `v*` tag or run **Actions → Publish**. The workflow publishes `@edgeone/chat-adapter-cn-shared` first, then the three adapters, and skips versions already on the registry.

## License

MIT
