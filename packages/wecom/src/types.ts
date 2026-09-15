export type WecomAdapterConfig = {
  corpId: string;
  agentId: string;
  appSecret: string;
  token: string;
  encodingAesKey: string;
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
