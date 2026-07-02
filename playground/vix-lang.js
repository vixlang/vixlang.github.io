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
    var bracketStack = [];
    var match = { '(': ')', '[': ']', '{': '}' };
    var names = { '(': 'parentheses', '[': 'bracket', '{': 'brace' };
    for (var i = 0; i < lines.length; i++) {
        var masked = maskLineForCode(lines[i], st);

        // import not supported in WASM
        var trimmed = lines[i].trim();
        if (/^import\s/.test(trimmed)) {
            diagnostics.push({ line: i, col: lines[i].indexOf('import'), message: 'Wasm 版本的 Vix 暂不支持 import 语法', severity: 'warning' });
        }

        for (var k = 0; k < masked.length; k++) {
            var ch = masked[k];
            if (ch === '(' || ch === '[' || ch === '{') {
                bracketStack.push({ char: ch, line: i, col: k });
            } else if (ch === ')' || ch === ']' || ch === '}') {
                if (bracketStack.length === 0) {
                    diagnostics.push({ line: i, col: k, message: 'Unexpected closing ' + (names[ch] || 'bracket'), severity: 'warning' });
                } else {
                    var last = bracketStack.pop();
                    if (match[last.char] !== ch) {
                        diagnostics.push({ line: i, col: k, message: 'Mismatched ' + names[ch] + ', expected ' + names[last.char], severity: 'warning' });
                    }
                }
            }
        }
        if (st.inDoubleQuote && dqStart === null) dqStart = { line: i, col: 0 };
        if (st.inSingleQuote && sqStart === null) sqStart = { line: i, col: 0 };
        if (!st.inDoubleQuote) dqStart = null;
        if (!st.inSingleQuote) sqStart = null;
    }
    for (var j = bracketStack.length - 1; j >= 0; j--) {
        var b = bracketStack[j];
        diagnostics.push({ line: b.line, col: b.col, message: 'Unmatched ' + names[b.char], severity: 'warning' });
    }
    if (st.inDoubleQuote && dqStart) diagnostics.push({ line: dqStart.line, col: dqStart.col, message: 'Unterminated double-quoted string', severity: 'error' });
    if (st.inSingleQuote && sqStart) diagnostics.push({ line: sqStart.line, col: sqStart.col, message: 'Unterminated single-quoted string', severity: 'error' });
    return diagnostics;
}

function getVixCompletions() {
    return [
        { label: 'fn', detail: 'Define a function', insertText: 'fn ' },
        { label: 'if', detail: 'If statement', insertText: 'if (' },
        { label: 'elif', detail: 'Else if', insertText: 'elif (' },
        { label: 'else', detail: 'Else', insertText: 'else {\n    \n}' },
        { label: 'for', detail: 'For loop', insertText: 'for (' },
        { label: 'while', detail: 'While loop', insertText: 'while (' },
        { label: 'let', detail: 'Variable declaration', insertText: 'let ' },
        { label: 'let_mut', detail: 'Mutable variable', insertText: 'let mut ' },
        { label: 'return', detail: 'Return statement', insertText: 'return ' },
        { label: 'match', detail: 'Pattern matching', insertText: 'match ' },
        { label: 'type', detail: 'Type alias / ADT', insertText: 'type ' },
        { label: 'type_struct', detail: 'Struct definition', insertText: 'type  = struct {\n    \n}' },
        { label: 'impl', detail: 'Implementation block', insertText: 'impl  {\n    \n}' },
        { label: 'import', detail: 'Import module', insertText: 'import "' },
        { label: 'mut', detail: 'Mutable modifier', insertText: 'mut ' },
        { label: 'pub', detail: 'Public visibility', insertText: 'pub ' },
        { label: 'extern', detail: 'External FFI block', insertText: 'extern "C" {\n    \n}' },
        { label: 'ref', detail: 'Address-of operator', insertText: 'ref ' },
        { label: 'in', detail: 'Range keyword (for loops)', insertText: ' in ' },
        { label: 'and', detail: 'Logical AND', insertText: ' and ' },
        { label: 'or', detail: 'Logical OR', insertText: ' or ' },
        { label: 'break', detail: 'Break loop', insertText: 'break' },
        { label: 'continue', detail: 'Continue loop', insertText: 'continue' },
        { label: 'nil', detail: 'Null value', insertText: 'nil' },
        { label: 'true', detail: 'Boolean true', insertText: 'true' },
        { label: 'false', detail: 'Boolean false', insertText: 'false' },
        { label: 'print', detail: 'Print values to output', insertText: 'print(' },
        { label: 'input', detail: 'Read input', insertText: 'input()' },
        { label: 'i32', detail: '32-bit signed integer', insertText: 'i32' },
        { label: 'i64', detail: '64-bit signed integer', insertText: 'i64' },
        { label: 'f32', detail: '32-bit float', insertText: 'f32' },
        { label: 'f64', detail: '64-bit float', insertText: 'f64' },
        { label: 'i8', detail: '8-bit signed integer', insertText: 'i8' },
        { label: 'u8', detail: '8-bit unsigned integer', insertText: 'u8' },
        { label: 'void', detail: 'Void type', insertText: 'void' },
        { label: 'string', detail: 'String type', insertText: 'string' },
        { label: 'usize', detail: 'Pointer-sized unsigned integer', insertText: 'usize' },
    ];
}

window.analyzeVix = analyzeVix;
window.getVixCompletions = getVixCompletions;
})();
