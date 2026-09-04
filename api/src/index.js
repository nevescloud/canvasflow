// Feedback endpoint for neves.cloud/canvasflow. Route in wrangler.jsonc.

const REPO = 'nevescloud/canvasflow';
const SITE = 'https://neves.cloud/canvasflow/';
const ENDPOINT = '/canvasflow/api/feedback';
const HOURLY_CAP = 30;
const MIN_ELAPSED_MS = 3000;
const MAX = { message: 4000, reason: 120, diagnostics: 600 };
const TITLE = { bug: 'Bug', feature: 'Request', uninstall: 'Uninstalled', other: 'Feedback' };
const LABEL = { bug: 'bug', feature: 'enhancement', uninstall: 'uninstall' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== ENDPOINT) return json({ error: 'not found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, { allow: 'POST' });
    if (!env.GITHUB_TOKEN) return json({ error: 'not configured' }, 503);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const { success } = await env.RL_IP.limit({ key: ip });
    if (!success) return json({ error: 'rate limited' }, 429);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
    const problem = validate(body);
    if (problem) return json({ error: problem }, 400);
    // A filled honeypot or an instant submit is a script. Answer as if it worked.
    if (body.hp || body.elapsed < MIN_ELAPSED_MS) return json({ ok: true }, 202);

    try {
      if (await recentCount(env) >= HOURLY_CAP) return json({ error: 'busy' }, 429);
      const issue = await createIssue(env, body);
      return json({ number: issue.number, url: issue.html_url }, 201);
    } catch (e) {
      console.error(e);
      return json({ error: 'github' }, 502);
    }
  }
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }
  });
}

function validate(b) {
  if (!b || typeof b !== 'object') return 'bad body';
  if (!Object.hasOwn(TITLE, b.kind)) return 'bad kind';
  b.message = clean(b.message, MAX.message);
  b.reason = clean(b.reason, MAX.reason);
  b.diagnostics = clean(b.diagnostics, MAX.diagnostics);
  b.hp = typeof b.hp === 'string' ? b.hp : '';
  b.elapsed = typeof b.elapsed === 'number' ? b.elapsed : 0;
  if (b.kind === 'uninstall' ? !b.reason : !b.message) return 'empty';
  return null;
}

// Drops control characters other than newline and tab, then trims and caps.
function clean(v, max) {
  return typeof v === 'string' ? v.replace(/[^\P{C}\n\t]/gu, '').trim().slice(0, max) : '';
}

// Sender text is data, never markdown: a fence longer than any backtick run
// inside it keeps @mentions, #refs and HTML inert.
function fence(text) {
  const longest = Math.max(2, ...(text.match(/`+/g) || []).map((r) => r.length));
  const f = '`'.repeat(longest + 1);
  return `${f}text\n${text}\n${f}`;
}

function title(b) {
  const first = (b.kind === 'uninstall' ? b.reason : b.message).split('\n')[0].trim();
  const short = first.length > 72 ? first.slice(0, 69).trimEnd() + '...' : first;
  return `${TITLE[b.kind]}: ${short}`;
}

function issueBody(b) {
  const lines = [`Sent through the [feedback form](${SITE}feedback.html), not by the account shown.`, ''];
  const text = b.kind === 'uninstall' ? [b.reason, b.message].filter(Boolean).join('\n\n') : b.message;
  lines.push(fence(text), '');
  if (b.diagnostics) {
    lines.push('<details><summary>Diagnostics (sender opted in)</summary>', '', fence(b.diagnostics), '', '</details>');
  }
  return lines.join('\n');
}

function gh(env, path, init = {}) {
  return fetch('https://api.github.com' + path, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'canvasflow-feedback',
      ...(init.headers || {})
    }
  });
}

// Issues the form created in the last hour. Bounds the damage from a script
// that clears the per-IP limit by rotating addresses.
async function recentCount(env) {
  const since = new Date(Date.now() - 3600e3).toISOString();
  const r = await gh(env, `/repos/${REPO}/issues?labels=from-form&state=all&sort=created&direction=desc&per_page=${HOURLY_CAP}`);
  if (!r.ok) throw new Error(`github list ${r.status}`);
  return (await r.json()).filter((i) => i.created_at >= since).length;
}

async function createIssue(env, b) {
  const labels = ['from-form'];
  if (LABEL[b.kind]) labels.push(LABEL[b.kind]);
  const r = await gh(env, `/repos/${REPO}/issues`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: title(b), body: issueBody(b), labels })
  });
  if (!r.ok) throw new Error(`github create ${r.status} ${await r.text()}`);
  return r.json();
}
