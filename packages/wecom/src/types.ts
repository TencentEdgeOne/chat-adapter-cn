export type WecomAdapterConfig = {
  corpId: string;
  agentId: string;
  appSecret: string;
  token: string;
  encodingAesKey: string;
  /**
   * Public SCF Function URL. WeCom token + send always go through this proxy
   * (fixed egress IP / 企业可信IP). Intranet `*.in.<region>.tencentscf.com`
   * hosts are rewritten to the public host. Direct qyapi calls are not used.
   */
  proxyUrl?: string;
};

/** Envelope the adapter POSTs to the SCF proxy. */
export type WecomProxyRequest = {
  path: string;
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
};

export type WecomThreadId = { userId: string };

export type WecomRawMessage = {
  FromUserName: string;
  MsgId: string;
  MsgType: string;
  Content: string;
  CreateTime?: string;
  AgentID?: string;
};

export type WecomUrlVerification = {
  echostr: string;
  timestamp: string;
  nonce: string;
  signature: string;
  token: string;
  encodingAesKey: string;
  corpId: string;
};
