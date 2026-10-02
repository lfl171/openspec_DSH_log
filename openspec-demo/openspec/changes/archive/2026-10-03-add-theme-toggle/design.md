# Design

## Context

前端为 React + Vite 单页应用,样式基于全局 CSS。

## Goals / Non-Goals

- Goals: 零依赖主题切换、无闪烁首屏、可扩展到更多主题
- Non-Goals: 主题编辑器、按组件级别的主题覆盖

## Decisions

### 用 CSS 变量而非主题包

在 `:root` 与 `[data-theme="dark"]` 上定义同一组变量,组件只引用变量。
理由:不引入运行时依赖,切换只改一个 `data-theme` 属性。

### 首屏内联脚本

在 `index.html` 的 `<head>` 中内联 ~10 行脚本,先于 React 读取 `localStorage` 并设置 `data-theme`,消除闪烁。

## Risks

- 内联脚本与 CSP 冲突:若启用严格 CSP,需为其加 nonce。

## Migration

删除 `src/styles/tokens.css` 中的硬编码颜色常量,替换为变量引用。
