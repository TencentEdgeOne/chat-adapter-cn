export type FeishuAdapterConfig = {
  appId: string;
  appSecret: string;
  encryptKey: string;
  verificationToken: string;
};

export type FeishuThreadId = { chatId: string; chatType: 'p2p' | 'group' };

export type FeishuRawMessage = {
  message_id: string;
  chat_id: string;
  chat_type: 'p2p' | 'group' | string;
  message_type?: string;
  content?: string;
  mentions?: Array<{ id?: { open_id?: string }; name?: string }>;
  sender?: { sender_id?: { open_id?: string; user_id?: string }; sender_type?: string };
};

export type FeishuEvent = {
  schema?: string;
  type?: string;
  challenge?: string;
  token?: string;
  header?: { event_type?: string; token?: string; app_id?: string };
  event?: {
    sender?: FeishuRawMessage['sender'];
    message?: FeishuRawMessage;
  };
};
