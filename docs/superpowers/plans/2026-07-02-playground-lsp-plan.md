# Playground LSP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time diagnostics and autocomplete to Vix Playground

**Architecture:** Extract analysis logic from VS Code extension as pure JS functions, integrate with CodeMirror 5 via lint + show-hint addons. Files split by responsibility: vix-lang.js (analysis engine), vix-cm.js (CM glue), playground.js (app logic, minimal changes).

**Tech Stack:** CodeMirror 5 (existing), codemirror/addon/lint, codemirror/addon/hint/show-hint

## Global Constraints

- No new dependencies beyond CodeMirror 5 CDN addons
- Analysis must not depend on WASM compiler
- Files kept short: vix-lang.js ~160 lines, vix-cm.js ~70 lines, playground.js +10 lines
- Match existing dark theme colors

---

### Task 1: vix-lang.js — Analysis Engine

**Files:**
- Create: `E:\Desktop\code\vix\WebSite\playground\vix-lang.js`

**Interfaces:**
- Produces: `analyzeVix(text) → {line, col, message, severity}[]`, `getVixCompletions() → {label, detail, insertText}[]`

- [ ] **Create vix-lang.js**

```js
(function() {
function maskLineForCode(line, state) {
    var out = line.split('');
    for (var i = 0; i < line.length; i++) {
        var ch = line[i], nx = line[i + 1];
        if (state.inBlockComment) {
            out[i] = ' ';
            if (ch === '*' && nx === '/') { out[i + 1] = ' '; state.inBlockComment = false; i++; }
            continue;
        }
        if (state.inDoubleQuote || state.inSingleQuote) {
            out[i] = ' ';
            if (state.escaped) { state.escaped = false; continue; }
            if (ch === '\\') { state.escaped = true; continue; }
            if (state.inDoubleQuote && ch === '"') state.inDoubleQuote = false;
            else if (state.inSingleQuote && ch === "'") state.inSingleQuote = false;
            continue;
        }
        if (ch === '/' && nx === '/') {
            for (var j = i; j < line.length; j++) out[j] = ' ';
            break;
        }
        if (ch === '/' && nx === '*') {
            out[i] = ' '; out[i + 1] = ' '; state.inBlockComment = true; i++;
            continue;
        }
        if (ch === '"') { out[i] = ' '; state.inDoubleQuote = true; continue; }
        if (ch === "'") { out[i] = ' '; state.inSingleQuote = true; continue; }
    }
    return out.join('');
}

function analyzeVix(text) {
    var diagnostics = [];
    var lines = text.split(/\r?\n/);
    var st = { inBlockComment: false, inDoubleQuote: false, inSingleQuote: false, escaped: false };
    var dqStart = null, sqStart = null;
    for (var i = 0; i < lines.length; i++) {
        var masked = maskLineForCode(lines[i], st);
        var pairs = [['(', ')', 'parentheses'], ['[', ']', 'bracket'], ['{', '}', 'brace']];
        for (var p = 0; p < pairs.length; p++) {
            var open = pairs[p][0], close = pairs[p][1], name = pairs[p][2];
            var o = 0, c = 0;
            for (var k = 0; k < masked.length; k++) {
                if (masked[k] === open) o++;
                if (masked[k] === close) c++;
            }
            if (o > c) {
                diagnostics.push({ line: i, col: 0, message: 'Unmatched ' + name, severity: 'warning' });
                break;
            }
        }
        if (st.inDoubleQuote && dqStart === null) dqStart = { line: i, col: 0 };
        if (st.inSingleQuote && sqStart === null) sqStart = { line: i, col: 0 };
        if (!st.inDoubleQuote) dqStart = null;
        if (!st.inSingleQuote) sqStart = null;
    }
    if (st.inDoubleQuote && dqStart) diagnostics.push({ line: dqStart.line, col: dqStart.col, message: 'Unterminated double-quoted string', severity: 'error' });
    if (st.inSingleQuote && sqStart) diagnostics.push({ line: sqStart.line, col: sqStart.col, message: 'Unterminated single-quoted string', severity: 'error' });
    return diagnostics;
}

function getVixCompletions() {
    return [
        { label: 'fn', detail: 'Define a function', insertText: 'fn ${1:name}(${2:params}): ${3:type} {\n\t${0}\n}' },
        { label: 'if', detail: 'If statement', insertText: 'if (${1:condition}) {\n\t${0}\n}' },
        { label: 'elif', detail: 'Else if', insertText: 'elif (${1:condition}) {\n\t${0}\n}' },
        { label: 'else', detail: 'Else', insertText: 'else {\n\t${0}\n}' },
        { label: 'for', detail: 'For loop', insertText: 'for (${1:i} in ${2:range}) {\n\t${0}\n}' },
        { label: 'while', detail: 'While loop', insertText: 'while (${1:condition}) {\n\t${0}\n}' },
        { label: 'let', detail: 'Variable declaration', insertText: 'let ${1:name} = ${0}' },
        { label: 'const', detail: 'Constant declaration', insertText: 'const ${1:name} = ${0}' },
        { label: 'return', detail: 'Return statement', insertText: 'return ${0}' },
        { label: 'match', detail: 'Pattern matching', insertText: 'match ${1:expr} {\n\t${0}\n}' },
        { label: 'type', detail: 'Type alias', insertText: 'type ${1:Name} = ${0}' },
        { label: 'struct', detail: 'Struct definition', insertText: 'type ${1:Name} = struct {\n\t${0}\n}' },
        { label: 'mut', detail: 'Mutable modifier', insertText: 'mut ' },
        { label: 'import', detail: 'Import module', insertText: 'import ${0}' },
        { label: 'break', detail: 'Break loop', insertText: 'break' },
        { label: 'continue', detail: 'Continue loop', insertText: 'continue' },
        { label: 'print', detail: 'Print to output', insertText: 'print(${0})' },
        { label: 'read', detail: 'Read input', insertText: 'read(${0})' },
        { label: 'wait', detail: 'Wait for delay', insertText: 'wait(${0})' },
        { label: 'parse', detail: 'Parse expression', insertText: 'parse(${0})' },
        { label: 'toint', detail: 'Convert to integer', insertText: 'toint(${0})' },
        { label: 'tofloat', detail: 'Convert to float', insertText: 'tofloat(${0})' },
        { label: 'tostring', detail: 'Convert to string', insertText: 'tostring(${0})' },
        { label: 'length', detail: 'Get length of collection', insertText: 'length(${0})' },
        { label: 'add', detail: 'Append to collection', insertText: 'add(${0}, ${1})' },
        { label: 'remove', detail: 'Remove from collection', insertText: 'remove(${0}, ${1})' },
    ];
}

window.analyzeVix = analyzeVix;
window.getVixCompletions = getVixCompletions;
})();
```

- [ ] **Verify file is valid JS** — open in browser dev tools, check no syntax errors

- [ ] **Commit**

```bash
git add playground/vix-lang.js
git commit -m "feat: add vix-lang.js analysis engine"
```

---

### Task 2: vix-cm.js — CodeMirror Adapter

**Files:**
- Create: `E:\Desktop\code\vix\WebSite\playground\vix-cm.js`

**Interfaces:**
- Consumes: `window.analyzeVix`, `window.getVixCompletions` (from Task 1)
- Produces: `window.setupVixLSP(editor)` — called from playground.js

- [ ] **Create vix-cm.js**

```js
(function() {
function VixLint(text, updateLinting, options, cm) {
    var diagnostics = window.analyzeVix(text);
    var found = [];
    for (var i = 0; i < diagnostics.length; i++) {
        var d = diagnostics[i];
        var lineText = cm ? cm.getLine(d.line) : (text.split('\n')[d.line] || '');
        found.push({
            message: d.message,
            severity: d.severity,
            from: { line: d.line, ch: d.col },
            to: { line: d.line, ch: lineText.length }
        });
    }
    updateLinting(found);
}

function VixHint(editor) {
    var cursor = editor.getCursor();
    var token = editor.getTokenAt(cursor);
    var start = token.start;
    var word = token.string;
    if (!word) return null;
    var all = window.getVixCompletions();
    var list = [];
    for (var i = 0; i < all.length; i++) {
        if (all[i].label.indexOf(word) === 0) {
            list.push({ text: all[i].insertText, displayText: all[i].label, detail: all[i].detail });
        }
    }
    if (list.length === 0) return null;
    return { list: list, from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: cursor.ch } };
}

window.setupVixLSP = function(editor) {
    editor.setOption('lint', { getAnnotations: VixLint, async: true });
    editor.setOption('hintOptions', { hint: VixHint });
    editor.on('inputRead', function(cm, change) {
        if (change.text.length && /[\w.]/.test(change.text[change.text.length - 1])) {
            cm.showHint();
        }
    });
    var extra = editor.getOption('extraKeys') || {};
    extra['Ctrl-Space'] = function(cm) { cm.showHint(); };
    editor.setOption('extraKeys', extra);
};
})();
```

- [ ] **Verify file loads correctly in browser context** — open dev tools console, check `setupVixLSP` is defined

- [ ] **Commit**

```bash
git add playground/vix-cm.js
git commit -m "feat: add vix-cm.js CodeMirror adapter"
```

---

### Task 3: playground.css — Lint/Hint Dark Theme Styles

**Files:**
- Modify: `E:\Desktop\code\vix\WebSite\playground\playground.css` (append at end)

- [ ] **Append lint/hint styles to playground.css**

```css
/* Lint annotations */
.cm-s-vix-dark .CodeMirror-lint-markers {
    width: 16px;
}
.cm-s-vix-dark .CodeMirror-lint-mark-error {
    background: var(--red);
}
.cm-s-vix-dark .CodeMirror-lint-mark-warning {
    background: #e5c07b;
}
.cm-s-vix-dark .cm-lint-error {
    background: rgba(243, 139, 168, 0.15);
}
.cm-s-vix-dark .cm-lint-warning {
    background: rgba(229, 192, 123, 0.15);
}
.cm-s-vix-dark .CodeMirror-lint-tooltip {
    background: var(--mantle);
    border: 1px solid var(--surface1);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 12px;
    padding: 4px 8px;
}

/* Hint popup */
.CodeMirror-hints {
    background: var(--mantle);
    border: 1px solid var(--surface1);
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    font-family: "Iosevka", "Fira Code", monospace;
    font-size: 13px;
    padding: 4px;
}
.CodeMirror-hint {
    color: var(--text);
    border-radius: 4px;
    padding: 2px 8px;
}
.CodeMirror-hint-active {
    background: var(--orange);
    color: #fff;
}
.CodeMirror-hint .hint-detail {
    color: var(--overlay0);
    font-size: 11px;
    margin-left: 8px;
}
```

- [ ] **Verify CSS loads without breaking existing styles** — visually inspect playground

- [ ] **Commit**

```bash
git add playground/playground.css
git commit -m "style: add lint/hint dark theme styles"
```

---

### Task 4: index.html — Add CDN and Scripts

**Files:**
- Modify: `E:\Desktop\code\vix\WebSite\playground\index.html`

- [ ] **Add CDN stylesheets before existing CSS**

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5.65.18/addon/lint/lint.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5.65.18/addon/hint/show-hint.min.css">
```

After the existing `<link rel="stylesheet" href="playground.css">` line.

- [ ] **Add CDN scripts before vixc-wasm.js**

```html
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.18/addon/lint/lint.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.18/addon/hint/show-hint.min.js"></script>
```

- [ ] **Add vix-lang.js and vix-cm.js after vixc-wasm.js**

```html
<script src="vixc-wasm.js"></script>
<script src="vix-lang.js"></script>
<script src="vix-cm.js"></script>
<script src="playground.js"></script>
```

Final script order should be:
```html
<script src="codemirror.min.js"></script>
<script src="simple.min.js"></script>
<script src="rust.min.js"></script>
<script src="lint.min.js"></script>
<script src="show-hint.min.js"></script>
<script src="vixc-wasm.js"></script>
<script src="vix-lang.js"></script>
<script src="vix-cm.js"></script>
<script src="playground.js"></script>
```

- [ ] **Verify no 404s on CDN resources** — open browser network tab

- [ ] **Commit**

```bash
git add playground/index.html
git commit -m "feat: add CDN and script tags for LSP"
```

---

### Task 5: playground.js — Integrate LSP

**Files:**
- Modify: `E:\Desktop\code\vix\WebSite\playground\playground.js`

- [ ] **Add `setupVixLSP(editor)` call after editor creation**

After line 72 (editor creation), add:
```js
setupVixLSP(editor);
```

That's the only change needed — the editor variable is already available, all LSP logic is in vix-lang.js and vix-cm.js.

- [ ] **Open playground in browser** — type `fn m` and verify:
  - Autocomplete popup shows `fn`, `match`, `mut`
  - Typing `"hello` shows unterminated string warning on gutter
  - Typing `(` without `)` shows unmatched parentheses warning

- [ ] **Commit**

```bash
git add playground/playground.js
git commit -m "feat: integrate LSP into playground editor"
```
