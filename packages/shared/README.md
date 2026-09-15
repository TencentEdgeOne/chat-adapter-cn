# @edgeone/chat-adapter-cn-shared

Shared floor for `@edgeone/chat-adapter-feishu`, `@edgeone/chat-adapter-wecom`, and `@edgeone/chat-adapter-dingtalk`.

You do not need to install this package directly. The three adapters depend on it.

## What it provides

| Export | Role |
| --- | --- |
| `MinimalChatAdapter` | `Adapter` base that implements webhook + `postMessage`, and throws for edit, reactions, history, and delete |
| `accessToken` | In-memory token cache with a 60s expiry skew |
| `postJson` | `fetch` helper that fails on HTTP errors and vendor `code` / `errcode` |
| `postableText` | Flatten a Chat SDK `AdapterPostableMessage` to a string |
| `plainFormatted` | Wrap plain text as `FormattedContent` |

These platforms cannot edit a sent text message in a way Chat SDK `editMessage` expects (Feishu PATCH is cards-only; WeCom `update_template_card` is a one-shot button callback). The base class throws on those surfaces so each adapter stays small.

## Install

Only if you are writing another adapter that wants the same floor:

```bash
npm install chat @edgeone/chat-adapter-cn-shared
```

`chat` is a peer dependency (`^4.39.0`).

## License

MIT
