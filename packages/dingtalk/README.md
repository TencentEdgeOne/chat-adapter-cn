# chat-adapter-dingtalk

[DingTalk](https://open.dingtalk.com) internal-app robot adapter for [Chat SDK](https://chat-sdk.dev).

```ts
import { createDingtalkAdapter } from 'chat-adapter-dingtalk';

const adapter = createDingtalkAdapter({
  appKey,
  appSecret,
  robotCode,
});
```

Also exports `DingtalkAdapter`, `DingtalkAdapterConfig`, `dingtalkSign`, and `dingtalkSignatureFresh`.
