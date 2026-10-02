## ADDED Requirements

### Requirement: Theme selection

系统 SHALL 允许用户在 `light`、`dark`、`system` 三种主题偏好之间切换,
默认值为 `system`,并 SHALL 在用户未显式选择时跟随操作系统的外观设置。

#### Scenario: 用户手动切换到深色主题

- **WHEN** 用户在设置页选择 `dark`
- **THEN** 界面立即切换为深色,且偏好写入 `localStorage` 的 `theme` 键

#### Scenario: 跟随系统偏好

- **WHEN** 偏好为 `system` 且操作系统切换为深色
- **THEN** 界面自动切换为深色,无需刷新页面

### Requirement: Theme persistence without flash

主题偏好 SHALL 在首屏渲染前应用,不得出现亮色到深色的可见闪烁。

#### Scenario: 深色用户刷新页面

- **WHEN** 已保存 `dark` 偏好的用户刷新页面
- **THEN** 首帧即为深色,不出现亮色闪屏
