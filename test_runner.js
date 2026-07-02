const fs = require('fs');
const path = require('path');

// Read source
const source = fs.readFileSync(path.join(__dirname, 'test_source.vix'), 'utf8');

global.window = { __vixcWasmReady: function() {
    setTimeout(() => {
        const M = require.cache[require.resolve('./playground/vixc-wasm.js')].exports;
        
        const ptrOut = M._malloc(4);
        const lenOut = M._malloc(4);
        const errOut = M._malloc(4);
        M.setValue(ptrOut, 0, 'i32');
        M.setValue(lenOut, 0, 'i32');
        M.setValue(errOut, 0, 'i32');
        
        const success = M.ccall('compile_vix', 'number', ['string', 'number', 'number', 'number'],
            [source, ptrOut, lenOut, errOut]);
        
        if (success) {
            const ptr = M.getValue(ptrOut, 'i32');
            const len = M.getValue(lenOut, 'i32');
            console.log('wasm size:', len);
            
            // We can't access HEAPU8 directly, but we can try to read memory
            // through a custom EM_ASM approach by calling a helper
            // For now, just log success
            console.log('COMPILE SUCCESS');
            
            // Try to read memory via exported functions
            // The playground uses global HEAPU8 - let's check if it was made global
            if (typeof global.HEAPU8 !== 'undefined') {
                const wasmBytes = Buffer.from(global.HEAPU8.slice(ptr, ptr + len));
                fs.writeFileSync(path.join(__dirname, 'pointer_test_output.wasm'), wasmBytes);
                console.log('Saved to pointer_test_output.wasm');
            } else {
                console.log('HEAPU8 not global, saving raw info');
                // Write raw info for debugging
                const info = JSON.stringify({ptr, len});
                fs.writeFileSync(path.join(__dirname, 'wasm_info.json'), info);
            }
            
            M.ccall('free_wasm_result', null, ['number', 'number'], [ptr, 0]);
            M._free(ptrOut); M._free(lenOut); M._free(errOut);
        } else {
            const errPtr = M.getValue(errOut, 'i32');
            console.log('ERROR:', errPtr ? M.UTF8ToString(errPtr) : 'unknown');
        }
        process.exit(0);
    }, 200);
}};

const Module = {
    wasmBinary: fs.readFileSync(path.join(__dirname, 'playground', 'vixc-wasm.wasm')),
    print: function() {},
    printErr: function() {},
    noInitialRun: true,
};
global.Module = Module;
require('./playground/vixc-wasm.js');
