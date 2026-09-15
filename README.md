# chat-adapter-cn

Community [Chat SDK](https://chat-sdk.dev) adapters for Feishu, WeCom, and DingTalk. The `@chat-adapter/*` npm scope is reserved for Vercel; these packages follow the community `chat-adapter-<platform>` naming.

| Package | Platform |
| --- | --- |
| [`chat-adapter-feishu`](packages/feishu) | Feishu / Lark |
| [`chat-adapter-wecom`](packages/wecom) | WeCom (self-built app, 1:1) |
| [`chat-adapter-dingtalk`](packages/dingtalk) | DingTalk internal-app robot |
| [`chat-adapter-cn-shared`](packages/shared) | Shared floor used by the three adapters |

```ts
import { Chat } from 'chat';
import { createFeishuAdapter } from 'chat-adapter-feishu';

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

These adapters implement webhook verification and `postMessage`. Reactions, history, and `editMessage` throw — Feishu PATCH only updates interactive cards, WeCom `update_template_card` is a one-shot button callback, and this first release posts a new message instead of editing.

```bash
pnpm install
pnpm test
pnpm build
```
