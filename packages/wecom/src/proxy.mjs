'use strict';

const WECOM_API_ORIGIN = 'https://qyapi.weixin.qq.com';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(statusCode, body) {
  return {
    isBase64Encoded: false,
    statusCode,
    headers: JSON_HEADERS,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function wecomTargetUrl(path, query) {
  if (
    !path.startsWith('/cgi-bin/') ||
    path.includes('://') ||
    path.includes('..') ||
    path.includes('\\')
  ) {
    throw new Error('invalid wecom path');
  }
  const url = new URL(path, WECOM_API_ORIGIN);
  if (url.protocol !== 'https:' || url.hostname !== 'qyapi.weixin.qq.com') {
    throw new Error('invalid wecom path');
  }
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }
  return url;
}

function parseEventBody(event) {
  try {
    const raw = event.body;
    if (raw == null || raw === '') throw new Error('empty body');
    if (typeof raw === 'object') return raw;
    const text = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && error.message === 'empty body') throw error;
    throw new Error('invalid json');
  }
}

async function forwardWecomApi(payload) {
  if (!payload || typeof payload.path !== 'string') {
    throw new Error('missing path');
  }
  const url = wecomTargetUrl(payload.path, payload.query);
  const method = (payload.method ?? 'POST').toUpperCase();
  const init = { method, headers: JSON_HEADERS };
  if (payload.body != null && method !== 'GET' && method !== 'HEAD') {
    init.body = typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body);
  }
  const res = await fetch(url, init);
  return { status: res.status, body: await res.text() };
}

export const main_handler = async (event, context) => {
  console.log('wecom proxy event', event);
  console.log('wecom proxy context', context);
  try {
    const payload = parseEventBody(event);
    const result = await forwardWecomApi(payload);
    return jsonResponse(result.status, result.body);
  } catch (error) {
    const errmsg = error instanceof Error ? error.message : 'invalid json';
    console.error('wecom proxy failed', errmsg);
    return jsonResponse(400, { errcode: -1, errmsg });
  }
};
