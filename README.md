# chat-adapter-cn

Community [Chat SDK](https://chat-sdk.dev) adapters for Feishu, WeCom, and DingTalk. The `@chat-adapter/*` npm scope is reserved for Vercel; these packages live under `@edgeone`.

| Package | Platform |
| --- | --- |
| [`@edgeone/chat-adapter-feishu`](packages/feishu) | Feishu / Lark |
| [`@edgeone/chat-adapter-wecom`](packages/wecom) | WeCom (self-built app, 1:1) |
| [`@edgeone/chat-adapter-dingtalk`](packages/dingtalk) | DingTalk internal-app robot |
| [`@edgeone/chat-adapter-cn-shared`](packages/shared) | Shared floor used by the three adapters |

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

These adapters implement webhook verification and `postMessage`. Reactions, history, and `editMessage` throw — Feishu PATCH only updates interactive cards, WeCom `update_template_card` is a one-shot button callback, and this first release posts a new message instead of editing.

```bash
pnpm install
pnpm test
pnpm build
```

## Publishing

CI publishes via npm [trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC). There is no `NPM_TOKEN`.

1. Publish each package once from your machine so the name exists on npm (`npm` has no pending publisher for a first version).
2. On each package page → **Settings → Trusted Publisher → GitHub Actions**:
   - Organization or user: `bleembleem`
   - Repository: `chat-adapter-cn`
   - Workflow filename: `publish.yml`
   - Environment: leave empty
   - Allowed action: `npm publish`
3. Push a `v*` tag or run **Actions → Publish → Run workflow**.

The workflow builds, tests, then `npm publish`es `@edgeone/chat-adapter-cn-shared` first and the three adapters after. Already-published versions are skipped.

```bash
git tag v0.1.0
git push origin v0.1.0
```

After they are on npm, switch the bot from `file:` paths to registry versions:

```bash
npm uninstall @edgeone/chat-adapter-cn-shared @edgeone/chat-adapter-feishu @edgeone/chat-adapter-wecom @edgeone/chat-adapter-dingtalk
npm install @edgeone/chat-adapter-feishu @edgeone/chat-adapter-wecom @edgeone/chat-adapter-dingtalk
```
