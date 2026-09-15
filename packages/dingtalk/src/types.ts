export type DingtalkAdapterConfig = {
  appKey: string;
  appSecret: string;
  robotCode: string;
};

export type DingtalkKind = 'p2p' | 'group';
export type DingtalkThreadId = { kind: DingtalkKind; id: string };

export type DingtalkRawMessage = {
  conversationId?: string;
  conversationType?: string;
  senderStaffId?: string;
  senderId?: string;
  senderNick?: string;
  msgId?: string;
  msgtype?: string;
  text?: { content?: string };
  isInAtList?: boolean;
};
