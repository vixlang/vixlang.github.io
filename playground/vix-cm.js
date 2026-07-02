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
        if (change.text.length && /[\w.]/.test(change.text[change.text.length - 1])) {
            cm.showHint();
        }
    });
    var extra = editor.getOption('extraKeys') || {};
    extra['Ctrl-Space'] = function(cm) { cm.showHint(); };
    editor.setOption('extraKeys', extra);
};
})();
