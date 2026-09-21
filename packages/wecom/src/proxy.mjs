// Nodejs24.11 事件函数用这份（ESM）。执行方法: index.main_handler
// 贴进 index.js / index.mjs。不要 require / exports，否则 Duration 0ms、没有 Hello World。

export const main_handler = async (event, context) => {
  console.log('Hello World');
  console.log(event);
  console.log(context);

  try {
    const payload = parsePayload(event);
    if (!payload.path || payload.path.indexOf('/cgi-bin/') !== 0) {
      return { errcode: -1, errmsg: 'invalid path' };
    }
    const query = payload.query || {};
    const qs = new URLSearchParams(query).toString();
    const url = 'https://qyapi.weixin.qq.com' + payload.path + (qs ? '?' + qs : '');
    const method = String(payload.method || 'GET').toUpperCase();
    const init = { method, headers: { 'Content-Type': 'application/json' } };
    if (payload.body != null && method !== 'GET' && method !== 'HEAD') {
      init.body = typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body);
    }
    const res = await fetch(url, init);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { errcode: -1, errmsg: text.slice(0, 200) };
    }
  } catch (e) {
    const errmsg = e && e.message ? e.message : String(e);
    console.error('wecom proxy failed', errmsg);
    return { errcode: -1, errmsg };
  }
};

function parsePayload(event) {
  if (event && typeof event.path === 'string' && event.path.indexOf('/cgi-bin/') === 0) {
    return event;
  }
  if (event && typeof event.body === 'string' && event.body) {
    return JSON.parse(event.body);
  }
  if (event && event.body && typeof event.body === 'object') {
    return event.body;
  }
  throw new Error('missing path');
}
