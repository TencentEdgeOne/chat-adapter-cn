# chat-adapter-wecom

[WeCom](https://developer.work.weixin.qq.com) (self-built app, 1:1) adapter for [Chat SDK](https://chat-sdk.dev).

```ts
import { createWecomAdapter } from 'chat-adapter-wecom';

const adapter = createWecomAdapter({
  corpId,
  agentId,
  appSecret,
  token,
  encodingAesKey,
});
```

Also exports `WecomAdapter`, `WecomAdapterConfig`, `wecomDecrypt`, `wecomSignature`, `xmlTag`, and `verifyWecomUrl` (GET `echostr`).
