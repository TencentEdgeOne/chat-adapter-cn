'use strict';

exports.main_handler = async (event, context) => {
  console.log('wecom proxy start');
  if (context) context.callbackWaitsForEmptyEventLoop = false;
  try {
    const https = require('https');
    const payload = parseEvent(event);
    const url = wecomUrl(payload.path, payload.query);
    const method = String(payload.method || 'POST').toUpperCase();
    console.log('wecom proxy forward', method, url.pathname);
    const text = await httpsJson(https, url, method, payload.body);
    try {
      return JSON.parse(text);
    } catch {
      return { errcode: -1, errmsg: text.slice(0, 200) };
    }
  } catch (error) {
    const errmsg = error instanceof Error ? error.message : String(error);
    console.error('wecom proxy failed', errmsg);
    return { errcode: -1, errmsg: errmsg };
  }
};

function parseEvent(event) {
  if (event && typeof event.path === 'string' && event.path.indexOf('/cgi-bin/') === 0) {
    return event;
  }
  const raw = event && event.body;
  if (raw == null || raw === '') throw new Error('empty body');
  if (typeof raw === 'object') return raw;
  const text = event && event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : String(raw);
  return JSON.parse(text);
}

function wecomUrl(path, query) {
  if (!path || path.indexOf('/cgi-bin/') !== 0 || path.indexOf('://') >= 0) {
    throw new Error('invalid wecom path');
  }
  const { URL } = require('url');
  const url = new URL(path, 'https://qyapi.weixin.qq.com');
  if (url.hostname !== 'qyapi.weixin.qq.com') throw new Error('invalid wecom path');
  Object.keys(query || {}).forEach((key) => url.searchParams.set(key, String(query[key])));
  return url;
}

function httpsJson(https, url, method, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: method, headers: { 'Content-Type': 'application/json' }, timeout: 8000 },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('qyapi timeout'));
    });
    req.on('error', reject);
    if (body != null && method !== 'GET' && method !== 'HEAD') {
      req.end(typeof body === 'string' ? body : JSON.stringify(body));
    } else {
      req.end();
    }
  });
}
