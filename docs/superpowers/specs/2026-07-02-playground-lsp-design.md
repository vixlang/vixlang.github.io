# Playground LSP 功能设计

## 目标

为 Vix 官网 Playground 添加实时诊断（红线错误提示）和自动补全功能，提取 VS Code 扩展 `ext-VixLangAnalyzer` 中的分析逻辑，以纯 JS 形式嵌入浏览器。

## 架构

```
playground/
├── vix-lang.js          # (新) 分析引擎: 纯函数, 零依赖
├── vix-cm.js            # (新) CodeMirror 适配层: lint source + hint provider
├── playground.js        # (改) 删除冗余, 引入 vix-cm 初始化
├── playground.css       # (改) 加 lint/hint 样式
└── index.html           # (改) 加 CDN CSS/JS + vix-lang.js, vix-cm.js
```

数据流:
```
用户输入 → editor.on("change")
              ↓
      vix-lang.js
       analyzeVix()          getVixCompletions()
          ↓                        ↓
   CM lint addon            CM hint addon
   (红色波浪线 + gutter)     (关键字弹窗)
```

## 文件职责

### vix-lang.js (~150 行)

从 `ext-VixLangAnalyzer/src/server.ts` 提取的纯分析逻辑:

- `maskLineForCode(line, state)` — 屏蔽注释和字符串内容, 避免误报
- `analyzeVix(text)` → `{line, col, message, severity}[]`
  - 未闭合小括号/中括号/大括号
  - 未闭合双引号/单引号字符串
  - 基础关键字拼写提示
- `getVixCompletions(line, pos)` → `{label, detail, insertText, kind}[]`
  - 关键字: fn, if, elif, else, for, while, let, const, return, match, type, struct, mut, import, break, continue
  - Vix 内置函数: print, read, wait, parse, toint, tofloat, tostring, length, add, remove
  - 触发字符: 字母开头输入 (不依赖 `.`, 全自动弹出)

### vix-cm.js (~60 行)

CodeMirror 5 胶水层:

- `VixLint(text, cb)` — lint source 函数, 调用 `analyzeVix`, 转为 CM 格式 `{message, severity, from, to}`
- `VixHint(editor)` — hint provider, 调用 `getVixCompletions`, 返回 `{list, from, to}` 给 CM
- `setupVixLSP(editor)` — 一次性挂载函数:
  - 设置 `lint` 选项
  - 监听 `inputRead` 事件 → 自动调用 `editor.showHint()`
  - 注册 `Ctrl-Space` → `autocomplete`
- 导出: `{ VixLint, VixHint, setupVixLSP }`

### playground.js (改动 ~10 行)

- 去掉 `mode: 'text/x-rustsrc'` → 改为 `mode: 'text/x-vixsrc'` (保留同色高亮, 后续可自定义)
- 删除 `extraKeys` 中手动注册的 `Ctrl-Enter`
- 创建编辑器后调用 `setupVixLSP(editor)`

### playground.css (新增 ~30 行)

- `.cm-s-vix-dark .CodeMirror-lint-markers` 样式
- `.cm-s-vix-dark .CodeMirror-lint-mark-error` (红色圆圈)
- `.cm-s-vix-dark .CodeMirror-lint-mark-warning` (黄色圆圈)
- `.cm-s-vix-dark .cm-lint-error` 波浪线
- `.CodeMirror-hints` 弹窗暗色主题

### index.html (改动 ~5 行)

CDN 新增:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5.65.18/addon/lint/lint.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5.65.18/addon/hint/show-hint.min.css">
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.18/addon/lint/lint.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.18/addon/hint/show-hint.min.js"></script>
```

Script 加载顺序:
```
...codemirror.min.js
...simple.min.js
...rust.min.js
...lint.min.js
...show-hint.min.js
vixc-wasm.js
vix-lang.js       ← 新
vix-cm.js         ← 新
playground.js     ← 最后
```

## 边界情况处理

- **编译器加载前**: LSP 分析不依赖 WASM 编译器, 页面加载即可工作
- **大文件**: `analyzeVix` 每次全量扫描, 但 playground 场景代码量小 (<500 行), 无性能问题
- **异步 lint**: 使用 CM lint 的 async 模式, 不阻塞 UI

## 不做的功能

- Hover 提示 (info 弹窗) — 后续可加, 当前 scope 不包含
- 真正的 Vix 语法模式 (当前复用 Rust 高亮颜色) — 后续可自定义
- 后端 LSP Server — 纯前端方案, 零运维
