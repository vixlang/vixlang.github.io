# Vix 官网动画效果设计

## 概述

为 Vix 官网 (index.html) 和 Very 子页 (very.html) 添加动画效果，提升视觉体验，同时保持编程语言官网应有的专业克制风格。不使用第三方库，纯 CSS + 原生 JS。

## 动画类型

### 1. 入场动画 (Page Load)

所有入场使用统一的 `fadeInUp` 关键帧，Hero 区域元素错开延迟：

| 元素 | 延迟 | 说明 |
|------|------|------|
| Nav / Brand | 0ms | 导航栏淡入 |
| Hero 标题 (h1) | 100ms | 大标题从下浮入 |
| Hero 副标题 / 描述 | 250ms | 描述文字 |
| Hero 按钮 | 400ms | CTA 按钮组 |
| Hero 代码块 | 550ms | 右侧代码示例 |

持续时间统一为 0.7s，缓动函数 `cubic-bezier(.2,1,.3,1)`，动画结束后 `forwards` 保持终态。

### 2. Scroll Reveal (滚动渐入)

使用 Intersection Observer 检测 section 进入视口：

- 每个 `<section>` 和 `<footer>` 在进入视口时触发 `fadeInUp`
- Card 网格内各卡片依次错开 100ms delay
- 代码区和文字描述统一 fadeInUp，不区分方向（保持统一观感）
- 阈值 0.15，触发一次后解除观察

### 3. Hover 动画

| 元素 | 效果 |
|------|------|
| `.btn` | `translateY(-2px)` + `box-shadow` 橙色发光 |
| `.btn-primary` | 背景变深 + 发光 |
| `.btn-secondary` | 边框和文字变橙色 + 发光 |
| `.why-card`, `.build-card`, `.overview-card` 等卡片 | `translateY(-4px)` + `border-color` 变橙色 |
| `.nav-links a` | 下划线从左到右展开 (伪元素 `::after` width 0→100%) |
| `.brand` | 鼠标悬停时轻微上浮 |

所有 hover 过渡持续时间 0.25s，缓动 `ease`。

### 4. 装饰动画

- `.highlight-bar`： shimmer 流光效果，background-position 循环移动（4s linear infinite）
- Brand logo： 微妙 float 浮动 (translateY ±4px, 3s ease-in-out infinite)

### 5. 可访问性

- 所有动画包裹在 `@media (prefers-reduced-motion: no-preference)` 内
- 用户开启「减少动效」时完全禁用所有动画

## 两页统一

`index.html` 和 `very.html` 共用完全相同的 CSS keyframes 和 JS Intersection Observer 逻辑。CSS 以 `/* Animations */` 注释块集中放置，JS 以 `/* Animation System */` 注释块集中放置。

## 不改变风格

- 不修改现有颜色、字体、间距、布局
- 不添加任何新 DOM 元素或装饰元素
- 不改变背景、边框、阴影等现有视觉样式
- 仅添加运动效果

## 技术实现

**CSS：**
```css
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
}

@keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-4px); }
}
```

**JS：**
```javascript
// Intersection Observer for scroll reveal
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.section, footer').forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
});
```

**HTML 类名：**
- `.reveal` — 需要滚动触发的元素
- `.reveal .visible` — 触发后添加
- `.hero-line` — Hero 区内需要级联入场的子元素
- `.card-delay-1/2/3` — 卡片错开 delay 辅助类
