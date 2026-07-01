(function() {
    const DEFAULT_CODE = 'fn main(): i32 {\n'
        + '    print("Hello, Vix Playground!")\n'
        + '    return 0\n'
        + '}';

    var editor = CodeMirror(document.getElementById('editor-container'), {
        value: DEFAULT_CODE,
        mode: 'text/x-vix',
        theme: 'default',
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        autofocus: true,
        extraKeys: {
            'Ctrl-Enter': runCode,
            'Cmd-Enter': runCode
        }
    });

    var statusText = document.getElementById('status-text');
    var runBtn = document.getElementById('btn-run');

    var wasmModule = null;
    var outputText = '';

    function flushOutput() {
        var el = document.getElementById('output-content');
        el.textContent = outputText;
        el.scrollTop = el.scrollHeight;
    }

    function createWasmImports(wasmMemory) {
        var env = {
            vix_putchar: function(c) {
                outputText += String.fromCharCode(c);
                if (c === 10) flushOutput();
            },
            vix_puts: function(ptr) {
                var mem = new Uint8Array(wasmMemory.buffer);
                var s = '';
                while (mem[ptr] !== 0) {
                    s += String.fromCharCode(mem[ptr]);
                    ptr++;
                }
                outputText += s + '\n';
                flushOutput();
            },
            vix_exit: function(code) {
                console.log('Program exited with code', code);
            }
        };
        return { env: env };
    }

    async function runCode() {
        var source = editor.getValue();
        var outputEl = document.getElementById('output-content');
        outputText = '';
        outputEl.textContent = '编译中...\n';

        try {
            var resultPtr = Module.ccall('compile_vix',
                'number', ['string', 'number', 'number', 'number'],
                [source, null, null, null]);

            if (!resultPtr) {
                outputEl.textContent = '编译错误';
                return;
            }

            var ptr = Module.getValue(resultPtr, 'i32');
            var len = Module.getValue(resultPtr + 4, 'i32');
            var wasmBytes = Module.HEAPU8.slice(ptr, ptr + len);

            var importObj = createWasmImports(wasmModule ? wasmModule.instance.exports.memory : null);
            wasmModule = await WebAssembly.instantiate(wasmBytes, importObj);
            outputText = '';
            wasmModule.instance.exports.main();

            Module.ccall('free_wasm_result', null, ['number', 'number'], [ptr, null]);
        } catch (err) {
            outputEl.textContent += '运行时错误: ' + err.message + '\n';
        }
    }

    runBtn.disabled = true;
    statusText.textContent = '正在加载编译器 (5-10 MB)...';

    window.onVixcWasmReady = function() {
        statusText.textContent = '编译器就绪';
        runBtn.disabled = false;
    };

    document.querySelectorAll('[data-tab]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('[data-tab]').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            var tab = this.dataset.tab;
            document.getElementById('output-content').style.display = tab === 'output' ? 'block' : 'none';
            document.getElementById('wasm-content').style.display = tab === 'wasm' ? 'block' : 'none';
        });
    });

    runBtn.addEventListener('click', runCode);
})();
