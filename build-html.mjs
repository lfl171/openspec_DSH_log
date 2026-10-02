// build-html.mjs — 将 openspec-dsh-blog.md 转换为独立的 HTML 博客页面
// 用法: node build-html.mjs openspec-dsh-blog.md openspec-dsh-blog.html
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2] ?? 'openspec-dsh-blog.md';
const out = process.argv[3] ?? 'openspec-dsh-blog.html';

const md = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');

/* ---------------- inline ---------------- */
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inline(s) {
  const codes = [];
  const stash = (text) =>
    text.replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c);
      return `\u0000C${codes.length - 1}\u0000`;
    });
  const unstash = (text) =>
    text.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  // 先占位行内代码,再转义,避免反引号里的内容被再次处理
  let t = stash(s);
  t = esc(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => `<a href="${url}">${unstash(txt)}</a>`);
  t = t.replace(/&lt;(https?:\/\/[^&]+?)&gt;/g, (_, url) => `<a href="${url}">${url}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return unstash(t);
}
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';

/* ---------------- block ---------------- */
const lines = md.split('\n');
let i = 0;
const body = [];
const toc = [];
let h2n = 0;

const splitRow = (s) =>
  s
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());

while (i < lines.length) {
  const line = lines[i];

  // 代码块
  const fence = line.match(/^```(\w*)\s*$/);
  if (fence) {
    const lang = fence[1] || 'text';
    i++;
    const buf = [];
    while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
    i++; // 跳过结束围栏
    const label = { bash: 'bash', pwsh: 'powershell', powershell: 'powershell', yaml: 'yaml', markdown: 'markdown', md: 'markdown', js: 'js', text: 'text', json: 'json' }[lang] ?? lang;
    body.push(
      `<figure class="code"><figcaption><span class="lang">${esc(label)}</span>` +
        `<button class="copy" type="button" data-copy>复制</button></figcaption>` +
        `<pre><code class="lang-${esc(lang)}">${esc(buf.join('\n'))}</code></pre></figure>`
    );
    continue;
  }

  // 空行
  if (/^\s*$/.test(line)) {
    i++;
    continue;
  }

  // 分隔线
  if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
    body.push('<hr>');
    i++;
    continue;
  }

  // 标题
  const h = line.match(/^(#{1,6})\s+(.*)$/);
  if (h) {
    const lv = h[1].length;
    const raw = h[2].trim();
    // h2 形如 "4. 完整实战:…",序号由 ::before 渲染,故正文/目录里去掉前缀
    const text = lv === 2 ? raw.replace(/^\d+[.、)]\s*/, '') : raw;
    const id = slug(text);
    if (lv === 2) {
      h2n++;
      const num = String(h2n).padStart(2, '0');
      toc.push({ id, text, level: 2, num });
      body.push(`<h2 id="${id}" data-num="${num}">${inline(text)}</h2>`);
    } else if (lv === 3) {
      toc.push({ id, text, level: 3 });
      body.push(`<h3 id="${id}">${inline(text)}</h3>`);
    } else if (lv === 1) {
      body.push(`<h1 id="${id}">${inline(text)}</h1>`);
    } else {
      body.push(`<h${lv} id="${id}">${inline(text)}</h${lv}>`);
    }
    i++;
    continue;
  }

  // 表格
  if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
    const head = splitRow(line);
    i += 2;
    const rows = [];
    while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
    body.push(
      '<div class="table-wrap"><table><thead><tr>' +
        head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>'
    );
    continue;
  }

  // 引用块:连续行各自成段,更接近原文排版
  if (/^>\s?/.test(line)) {
    const buf = [];
    while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
    const groups = [];
    let cur = [];
    for (const l of buf) {
      if (/^\s*$/.test(l)) {
        if (cur.length) groups.push(cur);
        cur = [];
      } else cur.push(l);
    }
    if (cur.length) groups.push(cur);
    body.push('<blockquote>' + groups.map((g) => `<p>${g.map(inline).join('<br>')}</p>`).join('') + '</blockquote>');
    continue;
  }

  // 列表
  if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
    const buf = [];
    while (i < lines.length && (/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
      buf.push(lines[i++]);
    }
    body.push(renderList(buf));
    continue;
  }

  // 段落
  const buf = [line];
  i++;
  while (
    i < lines.length &&
    !/^\s*$/.test(lines[i]) &&
    !/^(#{1,6})\s+/.test(lines[i]) &&
    !/^```/.test(lines[i]) &&
    !/^\s*\|/.test(lines[i]) &&
    !/^>\s?/.test(lines[i]) &&
    !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
    !/^\s*(---|\*\*\*|___)\s*$/.test(lines[i])
  ) {
    buf.push(lines[i++]);
  }
  // 段落内换行保留为软换行,便于阅读
  body.push(`<p>${buf.map((l) => inline(l)).join('<br>\n')}</p>`);
}

function renderList(buf) {
  let html = '';
  const stack = [];
  const open = (ordered) => {
    stack.push(ordered ? 'ol' : 'ul');
    html += ordered ? '<ol>' : '<ul>';
  };
  const close = (to) => {
    while (stack.length > to) html += stack.pop() === 'ol' ? '</ol>' : '</ul>';
  };
  for (const raw of buf) {
    const m = raw.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (!m) {
      html += ' ' + inline(raw.trim());
      continue;
    }
    const depth = Math.min(Math.floor(m[1].length / 2), 2);
    const ordered = /\d+\./.test(m[2]);
    const want = depth + 1;
    if (stack.length < want) open(ordered);
    else {
      close(want);
      if (stack.length && (stack[stack.length - 1] === 'ol') !== ordered) {
        close(want - 1);
        open(ordered);
      }
    }
    const text = m[3].replace(/^\[[ xX]\]\s*/, (mm) => (mm.toLowerCase().includes('x') ? '' : ''));
    const isTask = /^\[[ xX]\]\s*/.test(m[3]);
    const done = /^\[[xX]\]/.test(m[3]);
    const inner = inline(isTask ? m[3].replace(/^\[[ xX]\]\s*/, '') : text);
    html += isTask
      ? `<li class="task${done ? ' done' : ''}"><span class="box" aria-hidden="true">${done ? '✓' : ''}</span><span>${inner}</span></li>`
      : `<li>${inner}</li>`;
  }
  close(0);
  return html;
}

/* ---------------- 文档外壳 ---------------- */
const plain = (s) => s.replace(/`/g, '').replace(/\*\*/g, '');
const tocHtml = toc
  .filter((t) => t.level === 2)
  .map((t) => {
    const kids = toc.filter((k) => k.level === 3 && toc.indexOf(k) > toc.indexOf(t) && (!toc.slice(toc.indexOf(t) + 1).find((x) => x.level === 2) || toc.indexOf(k) < toc.indexOf(toc.slice(toc.indexOf(t) + 1).find((x) => x.level === 2))));
    return (
      `<li><a href="#${t.id}"><span class="num">${t.num}</span>${esc(plain(t.text))}</a>` +
      (kids.length ? `<ul>${kids.map((k) => `<li><a href="#${k.id}">${esc(plain(k.text))}</a></li>`).join('')}</ul>` : '') +
      '</li>'
    );
  })
  .join('\n');

const title = 'OpenSpec 入门与实践:让 AI 编程从「许愿」变成「按规格交付」';

const page = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · OpenSpec × DSH</title>
<meta name="description" content="OpenSpec 使用与介绍,以及如何在 DeepSeek Harness(DSH)中落地 spec-driven development 的完整实践指南。">
<style>
  :root {
    --sidebar-w: 300px;
    --radius: 12px;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Roboto, sans-serif;
    --accent: #14807a;
    --accent-2: #1d6fd0;
  }
  html[data-theme="light"] {
    --bg: #f4f5f2;
    --bg-soft: #ffffff;
    --bg-code: #10201f;
    --fg: #18211f;
    --fg-soft: #5a6a67;
    --line: #dfe3dd;
    --line-soft: #eaede8;
    --quote: #eef3f1;
    --shadow: 0 1px 2px rgba(20, 40, 35, .06), 0 12px 40px rgba(20, 40, 35, .07);
    --accent: #0f766e;
    --accent-2: #1d6fd0;
    --mark: #fff3c4;
  }
  html[data-theme="dark"] {
    --bg: #0e1413;
    --bg-soft: #151d1c;
    --bg-code: #0a100f;
    --fg: #e6ece9;
    --fg-soft: #9aa8a4;
    --line: #26302e;
    --line-soft: #1d2624;
    --quote: #17211f;
    --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 18px 50px rgba(0, 0, 0, .45);
    --accent: #3fd0c0;
    --accent-2: #6cb2ff;
    --mark: #4a3c10;
  }
  @media (prefers-color-scheme: dark) {
    html[data-theme="auto"] {
      --bg: #0e1413; --bg-soft: #151d1c; --bg-code: #0a100f; --fg: #e6ece9; --fg-soft: #9aa8a4;
      --line: #26302e; --line-soft: #1d2624; --quote: #17211f;
      --shadow: 0 1px 2px rgba(0,0,0,.5), 0 18px 50px rgba(0,0,0,.45);
      --accent: #3fd0c0; --accent-2: #6cb2ff; --mark: #4a3c10;
    }
  }
  @media (prefers-color-scheme: light) {
    html[data-theme="auto"] {
      --bg: #f4f5f2; --bg-soft: #fff; --bg-code: #10201f; --fg: #18211f; --fg-soft: #5a6a67;
      --line: #dfe3dd; --line-soft: #eaede8; --quote: #eef3f1;
      --shadow: 0 1px 2px rgba(20,40,35,.06), 0 12px 40px rgba(20,40,35,.07);
      --accent: #0f766e; --accent-2: #1d6fd0; --mark: #fff3c4;
    }
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 88px; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font-family: var(--sans); font-size: 16.5px; line-height: 1.85;
    -webkit-font-smoothing: antialiased;
  }
  #progress {
    position: fixed; inset: 0 auto auto 0; height: 3px; width: 0;
    background: linear-gradient(90deg, var(--accent), var(--accent-2)); z-index: 60;
  }

  /* ---------- 侧栏 ---------- */
  aside {
    position: fixed; inset: 0 auto 0 0; width: var(--sidebar-w);
    background: var(--bg-soft); border-right: 1px solid var(--line);
    padding: 26px 0 40px; overflow-y: auto; z-index: 40;
  }
  aside .brand { padding: 0 24px 18px; border-bottom: 1px solid var(--line-soft); }
  aside .brand b { display:block; font-size: 17px; letter-spacing: .2px; }
  aside .brand span { color: var(--fg-soft); font-size: 12.5px; letter-spacing: .3px; text-transform: uppercase; }
  aside .meta { padding: 14px 24px; color: var(--fg-soft); font-size: 13px; }
  aside .meta code { background: var(--quote); padding: 1px 6px; border-radius: 6px; }
  nav { padding: 8px 12px 0; }
  nav ol { list-style: none; margin: 0; padding: 0; }
  nav > ol > li { margin: 2px 0; }
  nav a {
    display: flex; gap: 8px; align-items: baseline; text-decoration: none;
    color: var(--fg-soft); font-size: 14px; padding: 7px 12px; border-radius: 9px;
    border-left: 2px solid transparent; transition: .15s;
  }
  nav a:hover { color: var(--fg); background: var(--quote); }
  nav a.active { color: var(--accent); background: var(--quote); border-left-color: var(--accent); font-weight: 600; }
  nav .num { font-family: var(--mono); font-size: 11.5px; opacity: .7; }
  nav ul { list-style: none; margin: 2px 0 8px; padding: 0 0 0 26px; }
  nav ul a { font-size: 13px; padding: 4px 10px; color: var(--fg-soft); opacity: .85; }

  /* ---------- 正文 ---------- */
  main { margin-left: var(--sidebar-w); padding: 56px 40px 120px; }
  article { max-width: 860px; margin: 0 auto; }
  article > h1 {
    font-size: 2.15rem; line-height: 1.3; margin: 0 0 18px; letter-spacing: -.4px;
  }
  h2 {
    font-size: 1.5rem; margin: 3.4em 0 .9em; padding-top: 1.1em;
    border-top: 1px solid var(--line-soft); letter-spacing: -.2px; scroll-margin-top: 80px;
  }
  h2::before {
    content: attr(data-num);
    font-family: var(--mono); font-size: .8rem; color: var(--accent);
    display: block; margin-bottom: .35em; letter-spacing: 2px;
  }
  h3 { font-size: 1.14rem; margin: 2.2em 0 .6em; scroll-margin-top: 80px; }
  h4 { font-size: 1rem; margin: 1.6em 0 .4em; }
  p { margin: .95em 0; }
  a { color: var(--accent-2); text-decoration-thickness: 1px; text-underline-offset: 3px; }
  a:hover { color: var(--accent); }
  strong { font-weight: 650; }
  hr { border: 0; border-top: 1px solid var(--line-soft); margin: 2.6em 0; }
  ul, ol { padding-left: 1.35em; }
  li { margin: .34em 0; }
  li.task { list-style: none; margin-left: -1.35em; display: flex; gap: .6em; align-items: flex-start; }
  li.task .box {
    flex: 0 0 18px; height: 18px; margin-top: .34em; border: 1.5px solid var(--line);
    border-radius: 5px; font-size: 12px; line-height: 15px; text-align: center; color: var(--accent);
  }
  li.task.done .box { border-color: var(--accent); }
  code {
    font-family: var(--mono); font-size: .875em; background: var(--quote);
    padding: .15em .42em; border-radius: 6px; word-break: break-word;
  }
  blockquote {
    margin: 1.4em 0; padding: 1px 20px; background: var(--quote);
    border-left: 3px solid var(--accent); border-radius: 0 var(--radius) var(--radius) 0; color: var(--fg-soft);
  }
  blockquote p { margin: .8em 0; }

  /* ---------- 代码块 ---------- */
  figure.code {
    margin: 1.5em 0; background: var(--bg-code); border-radius: var(--radius);
    overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--line);
  }
  figure.code figcaption {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px 8px 16px; background: rgba(255,255,255,.04);
    border-bottom: 1px solid rgba(255,255,255,.07);
  }
  figure.code .lang {
    font-family: var(--mono); font-size: 11.5px; letter-spacing: 1.4px; text-transform: uppercase;
    color: #6fd7c8;
  }
  figure.code .copy {
    cursor: pointer; font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 7px;
    color: #b9c7c3; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  }
  figure.code .copy:hover { color: #fff; border-color: #6fd7c8; }
  figure.code .copy.ok { color: #0e1413; background: #6fd7c8; border-color: #6fd7c8; }
  figure.code pre { margin: 0; padding: 16px 18px 18px; overflow-x: auto; }
  figure.code code {
    background: none; padding: 0; border-radius: 0; color: #dfe9e6;
    font-size: 13.4px; line-height: 1.72; white-space: pre;
  }

  /* ---------- 表格 ---------- */
  .table-wrap { margin: 1.5em 0; overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); }
  table { border-collapse: collapse; width: 100%; font-size: 14.6px; background: var(--bg-soft); }
  th, td { padding: 10px 14px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line-soft); }
  th { background: var(--quote); font-weight: 650; white-space: nowrap; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover td { background: var(--quote); }
  td code { white-space: nowrap; }

  footer {
    margin-left: var(--sidebar-w); padding: 26px 40px 60px; color: var(--fg-soft); font-size: 13.5px;
    border-top: 1px solid var(--line-soft); text-align: center;
  }

  /* 移动端 */
  .topbar { display: none; }
  @media (max-width: 980px) {
    aside {
      position: fixed; inset: 0 0 0 0; width: 84vw; max-width: 330px;
      transform: translateX(-102%); transition: transform .22s ease; box-shadow: var(--shadow);
    }
    body.nav-open aside { transform: none; }
    body.nav-open::after {
      content: ""; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 35;
    }
    .topbar {
      display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 30;
      background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line); padding: 10px 16px;
    }
    .topbar button {
      font: inherit; font-size: 13px; color: var(--fg); background: var(--quote);
      border: 1px solid var(--line); border-radius: 9px; padding: 6px 12px; cursor: pointer;
    }
    .topbar .t { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    main, footer { margin-left: 0; }
    main { padding: 26px 20px 80px; }
    footer { padding: 22px 20px 50px; }
    article > h1 { font-size: 1.6rem; }
    h2 { font-size: 1.28rem; }
    body { font-size: 16px; }
  }
  @media print {
    aside, .topbar, #progress, figure.code .copy { display: none !important; }
    main, footer { margin: 0; padding: 0; }
    body { background: #fff; color: #000; font-size: 11.5pt; }
    figure.code { box-shadow: none; break-inside: avoid; }
    h2 { break-after: avoid; }
  }
</style>
</head>
<body>
<div id="progress"></div>

<header class="topbar">
  <button type="button" id="navToggle" aria-label="打开目录">目录</button>
  <span class="t">OpenSpec × DSH</span>
</header>

<aside id="sidebar">
  <div class="brand">
    <b>OpenSpec × DSH</b>
    <span>spec-driven development</span>
  </div>
  <div class="meta">
    基于 <code>OpenSpec 1.14.0</code> 实测 · DeepSeek Harness
  </div>
  <nav aria-label="目录">
    <ol>
${tocHtml}
    </ol>
  </nav>
</aside>

<main>
  <article>
${body.join('\n')}
  </article>
</main>

<footer>
  OpenSpec × DeepSeek Harness 实践笔记 · 命令输出均在 OpenSpec 1.14.0 上实测
</footer>

<script>
(function () {
  // 主题跟随系统;右上角/侧栏不再提供切换按钮
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('blog-theme'); } catch (e) {}
  if (saved === 'light' || saved === 'dark' || saved === 'auto') root.setAttribute('data-theme', saved);

  // 复制代码
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var code = b.closest('figure').querySelector('code');
      var text = code.innerText;
      var done = function () {
        b.textContent = '已复制';
        b.classList.add('ok');
        setTimeout(function () { b.textContent = '复制'; b.classList.remove('ok'); }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
      } else { fallback(text, done); }
    });
  });
  function fallback(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  // 侧栏开合(移动端)
  var toggle = document.getElementById('navToggle');
  toggle && toggle.addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
  document.addEventListener('click', function (e) {
    if (document.body.classList.contains('nav-open') && !e.target.closest('aside') && !e.target.closest('#navToggle')) {
      document.body.classList.remove('nav-open');
    }
  });
  document.querySelectorAll('aside a').forEach(function (a) {
    a.addEventListener('click', function () { document.body.classList.remove('nav-open'); });
  });

  // 阅读进度 + 目录高亮
  var bar = document.getElementById('progress');
  var links = Array.prototype.slice.call(document.querySelectorAll('nav a'));
  var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    bar.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
    var y = doc.scrollTop + 120, active = heads[0];
    heads.forEach(function (h) { if (h.offsetTop <= y) active = h; });
    links.forEach(function (a) {
      a.classList.toggle('active', active && a.getAttribute('href') === '#' + active.id);
    });
  }
  var raf = null;
  window.addEventListener('scroll', function () {
    if (raf) return;
    raf = requestAnimationFrame(function () { onScroll(); raf = null; });
  }, { passive: true });
  onScroll();
})();
</script>
</body>
</html>
`;

fs.writeFileSync(out, '\uFEFF' + page, 'utf8');
console.log('OK ->', out, (page.length / 1024).toFixed(1) + ' KB,', toc.filter((t) => t.level === 2).length, 'h2 sections,', toc.filter((t) => t.level === 3).length, 'h3 entries');
