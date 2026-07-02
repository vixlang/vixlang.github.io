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
    var all = window.getVixCompletions();

    var lineBefore = editor.getLine(cursor.line).slice(0, start);
    var typeContext = /:\s*$/.test(lineBefore);

    if (typeContext) {
        all = all.filter(function(c) { return c.isType; });
        if (!word) word = '';
    } else if (!word) {
        return null;
    }

    var list = [];
    for (var i = 0; i < all.length; i++) {
        if (all[i].label.indexOf(word) === 0) {
            list.push({ text: all[i].insertText, displayText: all[i].label, detail: all[i].detail });
        }
    }
    if (list.length === 0) return null;
    return { list: list, from: { line: cursor.line, ch: typeContext ? lineBefore.length : start }, to: { line: cursor.line, ch: cursor.ch } };
}

function makeTooltip(className) {
    var el = document.createElement('div');
    el.className = className;
    document.body.appendChild(el);
    return el;
}

function setupVixHover(editor) {
    var el = makeTooltip('vix-hover-tooltip');
    var timer = null;

    function show(e) {
        var pos = editor.coordsChar({ left: e.pageX, top: e.pageY });
        var token = editor.getTokenAt(pos);
        if (!token || !token.string) { el.style.display = 'none'; return; }
        var info = window.getVixHover(token.string);
        if (!info) { el.style.display = 'none'; return; }
        el.textContent = info;
        el.style.left = (e.pageX + 14) + 'px';
        el.style.top = (e.pageY + 14) + 'px';
        el.style.display = 'block';
    }

    editor.getWrapperElement().addEventListener('mousemove', function(e) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function() { show(e); }, 80);
    });
    editor.getWrapperElement().addEventListener('mouseleave', function() { el.style.display = 'none'; });
}

function setupVixSignature(editor) {
    var el = makeTooltip('vix-signature-tooltip');
    var active = false;

    function hide() { el.style.display = 'none'; active = false; }

    function show(name) {
        var sig = window.getVixSignature(name);
        if (!sig) { hide(); return; }
        var cursor = editor.getCursor();
        var coords = editor.cursorCoords(true);
        el.innerHTML = '<span class="sig-name">' + sig.summary + '</span>';
        el.style.left = coords.left + 'px';
        el.style.top = (coords.bottom + 4) + 'px';
        el.style.display = 'block';
        active = true;
    }

    editor.on('inputRead', function(cm, change) {
        if (change.text[0] === '(') {
            var cursor = cm.getCursor();
            var line = cm.getLine(cursor.line);
            var before = line.slice(0, cursor.ch - 1).match(/(\w+)\s*$/);
            if (before) show(before[1]);
        } else {
            hide();
        }
    });

    editor.on('cursorActivity', function() {
        if (active) {
            var cursor = editor.getCursor();
            var line = editor.getLine(cursor.line);
            var before = line.slice(0, cursor.ch);
            var depth = 0;
            for (var i = before.length - 1; i >= 0; i--) {
                if (before[i] === ')') depth++;
                else if (before[i] === '(') { if (depth === 0) { hide(); break; } else depth--; }
            }
        }
    });

    editor.on('keydown', function(cm, e) {
        if (e.key === 'Escape') hide();
    });
}

window.setupVixLSP = function(editor) {
    editor.setOption('lint', { getAnnotations: VixLint, async: true });
    editor.setOption('hintOptions', {
        hint: VixHint,
        completeSingle: false,
        customKeys: {
            Tab: function(cm, handle) { handle.pick(); },
            Enter: function(cm, handle) { handle.close(); return CodeMirror.Pass; },
            Up: function(cm, handle) { handle.moveFocus(-1); },
            Down: function(cm, handle) { handle.moveFocus(1); },
            Esc: function(cm, handle) { handle.close(); }
        }
    });
    editor.on('inputRead', function(cm, change) {
        if (change.text.length) {
            var ch = change.text[change.text.length - 1];
            if (/[\w.:]/.test(ch)) {
                cm.showHint();
            }
        }
    });
    var extra = editor.getOption('extraKeys') || {};
    extra['Ctrl-Space'] = function(cm) { cm.showHint(); };
    editor.setOption('extraKeys', extra);
    setupVixHover(editor);
    setupVixSignature(editor);
};
})();
