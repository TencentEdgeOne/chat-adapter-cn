# @edgeone/chat-adapter-feishu

[Feishu / Lark](https://open.feishu.cn) adapter for [Chat SDK](https://chat-sdk.dev).

```ts
import { createFeishuAdapter } from '@edgeone/chat-adapter-feishu';

const adapter = createFeishuAdapter({
  appId,
  appSecret,
  encryptKey,
  verificationToken,
});
```

Also exports `FeishuAdapter`, `FeishuAdapterConfig`, `feishuDecrypt`, `feishuSignature`, `verifyFeishuUrl`, and `parseFeishuEvent`.

Subscribe to `im.message.receive_v1`. URL verification can use `verifyFeishuUrl` from a thin webhook route.
