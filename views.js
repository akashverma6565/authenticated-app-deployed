const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const css = `
:root{--bg:#f6f7f9;--card:#fff;--text:#1c1f24;--muted:#6b7280;--accent:#2f5bea;--line:#e5e7eb}
@media(prefers-color-scheme:dark){:root{--bg:#14161a;--card:#1d2026;--text:#e8eaed;--muted:#9aa0a6;--accent:#6d8cff;--line:#2c3038}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:var(--bg);color:var(--text)}
main{max-width:520px;margin:48px auto;padding:0 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:24px}
h1{margin:0 0 16px;font-size:1.4rem}
input[type=email],input[type=password],input[type=text]{width:100%;padding:10px 12px;margin:6px 0 14px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text);font-size:1rem}
button{padding:10px 16px;border:0;border-radius:8px;background:var(--accent);color:#fff;font-size:.95rem;cursor:pointer}
button.link{background:none;color:var(--muted);padding:4px 8px}
.flash{background:#fde8e8;color:#9b1c1c;padding:10px 12px;border-radius:8px;margin-bottom:14px}
nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;color:var(--muted);font-size:.9rem}
ul{list-style:none;padding:0;margin:16px 0 0}
li{display:flex;align-items:center;gap:8px;padding:10px 0;border-top:1px solid var(--line)}
li .t{flex:1}li.done .t{text-decoration:line-through;color:var(--muted)}
form.inline{display:inline;margin:0}.row{display:flex;gap:8px}.row input{margin:0}a{color:var(--accent)}`;

const layout = (body, error) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TaskVault</title><style>${css}</style></head>
<body><main>${error ? `<div class="flash">${esc(error)}</div>` : ""}${body}</main></body></html>`;

const csrfField = (t) => `<input type="hidden" name="csrf" value="${esc(t)}">`;

exports.loginPage = (csrf, error) =>
  layout(`<div class="card"><h1>Sign in</h1>
<form method="post" action="/login">${csrfField(csrf)}
<label>Email<input type="email" name="email" required autofocus></label>
<label>Password<input type="password" name="password" required></label>
<button type="submit">Sign in</button></form>
<p>No account? <a href="/register">Create one</a></p></div>`, error);

exports.registerPage = (csrf, error) =>
  layout(`<div class="card"><h1>Create account</h1>
<form method="post" action="/register">${csrfField(csrf)}
<label>Email<input type="email" name="email" required autofocus></label>
<label>Password (min 8 characters)<input type="password" name="password" minlength="8" required></label>
<button type="submit">Sign up</button></form>
<p>Already registered? <a href="/login">Sign in</a></p></div>`, error);

exports.tasksPage = (csrf, email, tasks) =>
  layout(`<div class="card">
<nav><span>${esc(email)}</span>
<form class="inline" method="post" action="/logout">${csrfField(csrf)}<button class="link" type="submit">Sign out</button></form></nav>
<h1>My tasks</h1>
<form method="post" action="/tasks" class="row">${csrfField(csrf)}
<input type="text" name="title" placeholder="What needs doing?" maxlength="200" required>
<button type="submit">Add</button></form>
<ul>${
    tasks.length
      ? tasks
          .map(
            (t) => `<li class="${t.done ? "done" : ""}"><span class="t">${esc(t.title)}</span>
<form class="inline" method="post" action="/tasks/${t.id}/toggle">${csrfField(csrf)}<button class="link" type="submit">${t.done ? "Undo" : "Done"}</button></form>
<form class="inline" method="post" action="/tasks/${t.id}/delete">${csrfField(csrf)}<button class="link" type="submit">Delete</button></form></li>`
          )
          .join("")
      : `<li><span class="t" style="color:var(--muted)">Nothing yet. Add your first task above.</span></li>`
  }</ul></div>`);
