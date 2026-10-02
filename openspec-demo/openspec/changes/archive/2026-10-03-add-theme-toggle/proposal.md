# Proposal

## Why

用户在夜间阅读时被亮色界面刺眼,当前应用只有一套亮色主题,无法满足低光环境使用。

## What Changes

- 新增主题能力:`light` / `dark` / `system` 三种偏好
- 主题偏好持久化到 `localStorage`,刷新后保持
- 首屏渲染前应用主题,避免闪烁(FOUC)
- **BREAKING**:移除硬编码的亮色颜色常量,统一改为 CSS 变量

## Capabilities

### New Capabilities

- `theme-system`: 主题选择、系统偏好联动与持久化

### Modified Capabilities

(无)

## Impact

- 新增 `src/theme/` 模块与 `ThemeProvider`
- `src/styles/tokens.css` 由常量改为 CSS 变量
- 影响所有已存在的页面组件
