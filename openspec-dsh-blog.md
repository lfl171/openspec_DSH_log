# OpenSpec 入门与实践:让 AI 编程从「许愿」变成「按规格交付」

> 副标题:一份面向 DeepSeek Harness(DSH)用户的 spec-driven development 指南
>
> 环境:OpenSpec 1.14.0 + DeepSeek Harness + Windows / Node.js 20.19+
> 文中所有命令输出均在真实终端中执行并核对过。

---

## 1. 先说痛点:为什么 AI 写代码需要「规格」

用 AI 写代码最让人抓狂的不是它写得慢,而是它**每次写得都不一样**。

同一个需求,早上让它加个「深色模式」,它给你加了 CSS 变量;下午让它再加一次,它给你装了 UI 库主题插件。三次对话下来,代码库里躺着三套互不相容的主题方案。问题不在于模型不够聪明,而在于**需求只存在于聊天记录里**:

- 聊天记录会滚动、会被清空、会超上下文窗口;
- 新来的同事、新开的会话、换一个 AI 工具,都读不到昨天的决策;
- 「我以为你懂我的意思」——人类和 AI 对同一个词的理解并不一致;
- 代码评审时你只能看 diff,看不到「当初为什么这么改」。

OpenSpec 的解法朴素但有效:**在写代码之前,先让人类和 AI 就一份 Markdown 规格达成一致,并且这份规格和代码一起放进 Git。**

> OpenSpec 官方定位:AI-native system for spec-driven development(spec 驱动的 AI 原生开发系统)。
> 哲学是「fluid not rigid, iterative not waterfall」——有规格,但不搞瀑布式阶段门禁。

---

## 2. OpenSpec 是什么

一句话:**它是一套文件夹约定 + 一个 CLI + 一组给 AI 用的技能/命令。**

它不接管你的构建、不生成代码框架、不绑定任何模型或编辑器。它只做三件事:

1. **规定目录结构**——规格放哪、变更提案放哪;
2. **提供 CLI 校验**——规格和提案格式是否合法、任务是否完成、变更能否归档;
3. **给 AI 发指令**——`openspec instructions` 把「该写什么、写到哪、遵守什么规则」以结构化 JSON/Markdown 交给 AI,AI 不再靠猜。

### 2.1 核心概念

| 概念 | 目录 | 说明 |
| --- | --- | --- |
| **Spec(规格)** | `openspec/specs/<capability>/spec.md` | 系统**当前**已承诺的能力,长期存在,是唯一事实来源 |
| **Change(变更)** | `openspec/changes/<change-name>/` | 一次改动的完整方案,包含提案、规格增量、设计、任务 |
| **Delta(增量规格)** | `changes/<name>/specs/<capability>/spec.md` | 只描述「本次新增/修改/删除哪些需求」,归档时才合并进正式规格 |
| **Archive(归档)** | `changes/archive/YYYY-MM-DD-<name>/` | 完成后的变更归档,同时把增量合并进 specs |
| **Store(独立仓库,beta)** | 由 `openspec store` 管理 | 跨仓库共享规格:多个代码仓库共用一个 OpenSpec 仓库 |
| **Schema(工作流模板)** | `openspec/config.yaml` 中 `schema:` | 默认 `spec-driven`:proposal → specs → design → tasks |

关键设计是 **Delta 机制**:并发开发三个功能时,每个功能改的是自己 `changes/` 目录下的增量文件,不会互相覆盖;只有归档那一刻,增量才被应用进 `specs/`。

### 2.2 一次变更(Bundle)长什么样

以本文的示例 `add-theme-toggle` 为例,创建后是这样:

```text
openspec/
├── config.yaml                      # 项目约束、每个 artifact 的规则、apply/archive 指引
├── specs/                           # 当前系统能力(唯一事实来源)
│   └── theme-system/spec.md         # 归档时由增量合并生成
└── changes/
    ├── archive/
    │   └── 2026-10-03-add-theme-toggle/
    └── add-theme-toggle/
        ├── .openspec.yaml           # schema: spec-driven;可加 skip_specs: true
        ├── proposal.md              # 为什么做、改什么、影响什么
        ├── specs/theme-system/spec.md  # 增量:## ADDED Requirements + 场景
        ├── design.md                # 技术方案、权衡、风险、迁移
        └── tasks.md                 # 可勾选的实现清单(带验证方式)
```

四份产物各司其职:

- **proposal.md**:`Why` / `What Changes` / `Capabilities` / `Impact`。只讲「为什么」和「改什么」,不讲实现。
- **specs/<capability>/spec.md**:验收标准。每条 `### Requirement:` 用「SHALL + 可观察行为」描述,并至少挂一个 `#### Scenario:`(WHEN/THEN)。
- **design.md**:实现路径、备选方案、风险。**条件产物**,简单改动可以跳过。
- **tasks.md**:可执行清单。**注意任务要写「验证方式」**,这是让 AI 自证完成的关键。

一份真实可用的增量规格(节选自本示例):

```markdown
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
```

没有任何私有语法:就是 Markdown、四级标题和 WHEN/THEN 列表。人读得懂,`openspec validate` 也解析得了。

---

## 3. 安装与初始化

### 3.1 安装 CLI

```bash
# 要求 Node.js >= 20.19.0
npm install -g @fission-ai/openspec@latest

# macOS / Linux 也可以用 Homebrew
brew install openspec

openspec version
# OpenSpec 1.14.0 (npm, global)
```

### 3.2 在项目里初始化 —— 关键是选对 `--tools`

```bash
cd your-project
openspec init
```

交互式会问你用哪些 AI 工具。**用 DSH 的话选 `DeepSeek Harness`**,或者非交互式直接:

```bash
openspec init --tools dsh
```

真实输出(节选,`dsh` 的关键信息都在这里):

```text
√ Setup complete for DeepSeek Harness

OpenSpec Setup Complete

Created: DeepSeek Harness
6 skills in .dsh/
Commands skipped for: dsh (no adapter)
Config: openspec/config.yaml (schema: spec-driven)

Getting started:
  Start your first change: /openspec-propose "your idea"
```

其他常用参数:

```bash
openspec init --tools dsh --language Chinese   # 新产物默认用中文书写
openspec update                                # 升级后刷新已生成的技能/命令文件
openspec config profile                        # 切换工作流配置档(core / 扩展档)
```

### 3.3 DSH 用户会被写入什么

`openspec init --tools dsh` 在项目里创建 `.dsh/skills/`,默认写入 **6 个技能**:

```text
.dsh/skills/
├── openspec-propose/SKILL.md          # 提出变更并一次性生成全部规划产物
├── openspec-explore/SKILL.md          # 动手前的思考搭子
├── openspec-apply-change/SKILL.md     # 按 tasks 实现
├── openspec-update-change/SKILL.md    # 修改已存在的变更方案并保持产物一致
├── openspec-sync-specs/SKILL.md       # 把增量规格同步进主规格(不归档)
└── openspec-archive-change/SKILL.md   # 归档并合并规格
```

每个 `SKILL.md` 都是标准 SKILL 格式,DSH 能直接发现并加载:

```markdown
---
name: openspec-propose
description: Propose a new OpenSpec change with all artifacts generated in one step.
  ...Also use when the user says "openspec propose" or "opsx propose".
allowed-tools: Bash(openspec:*)
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  generatedBy: "1.14.0"
---
```

注意输出里的 **`Commands skipped for: dsh (no adapter)`**:OpenSpec 官方目前只给 DSH 发**技能(skill)**,不发命令文件(命令)。所以有两种可能的用法:

- **技能通道(官方,开箱即用)**:你用自然语言或 `/技能名` 触发,DSH 自动加载对应技能——因为技能的 `description` 里显式写了触发短语(`openspec propose`、`opsx propose`、`openspec apply`、`opsx archive` 等)。你也可以直接点名,例如「用 openspec-propose 这条技能来做」。
- **命令通道(第三方插件)**:社区的 `@codigoconelmer/dsh-openspec` 把同一批官方工作流注册成 DSH 的原生斜杠命令 `/opsx-explore`、`/opsx-propose`、`/opsx-apply`、`/opsx-sync`、`/opsx-archive`、`/opsx-update`。详见 [5.2 DSH 侧的入口细节](#5-2-dsh-侧的入口细节)。

而在 Cursor / GitHub Copilot 这类工具里,OpenSpec 直接写命令文件,你敲的是 `/opsx:propose`。

> 升级 OpenSpec 后,记得在**每个项目**里跑一次 `openspec update`,重新生成 `.dsh/skills/`,否则技能内容和 CLI 版本会漂移。

### 3.4 DSH 到底从哪里发现这些技能

这一节来自 DSH 自带的技能插件文档(`dsh-skill-filesystem`,可在应用包 `resources\app.asar` 内检索到)。DSH 的技能发现是**多根目录 + 优先级**的:

| 优先级 | 来源 | 路径 |
| --- | --- | --- |
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 300 | `custom` | 配置项 `customSkillDirs` |
| 400 | `user-dsh` | `~/.dsh/skills` |
| 500 | `user-agents` | `~/.agents/skills` |
| 600 | `bundled` | 内置技能目录 |

- **`projectRoot` 是最近的、含 `.git` 的祖先目录**;没有 `.git` 时退化为当前工作目录。这条规则对 OpenSpec 用户很关键:`openspec init` 写在项目根的 `.dsh/skills/`,而 DSH 会话只要在这个仓库内,就一定能发现它。
- 一个技能要么是目录包 `<name>/SKILL.md`,要么是根目录下的平铺文件 `<name>.md`;**嵌套的 `**/SKILL.md` 刻意不被发现**——所以别把 OpenSpec 技能挪到子目录里。
- 文件头部是 YAML frontmatter:`name` 与 `description` 必填,可选 `whenToUse`、`metadata`,以及两个权限开关:
  - `disable-model-invocation: true`:不进模型目录,只能由人触发;
  - `user-invocable: false`:不出现在人可用的命令里,只能由模型调用;
  - 两者都省略表示**两种入口都开放**。OpenSpec 生成的 6 个技能都没有写这两个键,所以它们既能被模型按 `description` 自动选中,也会出现在会话的人可调用技能列表里。
- 技能根目录是**被监视**的:新增、改名、删除技能会在下一步自动进入目录(不用重启 DSH);模型自己的 `write` / `edit` 也会立刻让技能目录失效并刷新。

另外两个容易和技能混淆的概念:

1. **技能正文按需加载**:发现阶段只解析 frontmatter 进目录,正文每次加载都重新读文件——所以改技能正文不需要任何版本管理或缓存清理。
2. **`AGENTS.md` 是另一条通道**:DSH 还会注入工作区指令(用户全局 `~/.dsh/AGENTS.md`,加项目里从仓库根到当前工作目录的每一级 `AGENTS.md` / `CLAUDE.md`,`.local.md` 作为本地覆盖)。如果你希望 DSH 在**这个项目里总是主动走 OpenSpec 流程**,在 `AGENTS.md` 里写一句,比每次口头交代更可靠:

   ```markdown
   ## 规格驱动开发

   - 本仓库使用 OpenSpec。任何行为变更必须先有 `openspec/changes/<name>/` 变更方案。
   - 提需求时默认使用 `openspec-propose` 技能;实现前必须先跑 `openspec validate`。
   - 归档前确认 `tasks.md` 全部勾选。
   ```

---

## 4. 完整实战:从一句需求到归档

下面这条链路全部可复制执行。示例需求:给应用加主题切换。

### 第 0 步(可选):先想清楚 —— `explore`

需求还模糊时不要急着开变更。在 DSH 里说:

```text
我想加深色模式,但不确定怎么接才干净。
```

DSH 加载 `openspec-explore` 技能,读你的样式代码、权衡方案、收敛范围;**此阶段不写任何代码**,只产出思路。想清楚了再进入下一步。

### 第 1 步:创建变更骨架

CLI 直接创建:

```bash
openspec new change add-theme-toggle
```

```text
Created change 'add-theme-toggle' at openspec\changes\add-theme-toggle/
Schema: spec-driven
Next: openspec status --change add-theme-toggle
```

在 DSH 里,等价的说法是「用 openspec-propose 帮我加一个主题切换能力,变更名叫 add-theme-toggle」。技能会依次读取 `openspec context --json`、`openspec status --json`、`openspec instructions <artifact> --json`,再逐个生成产物。

### 第 2 步:看进度 —— `status`

```bash
openspec status --change add-theme-toggle
```

```text
Change: add-theme-toggle
Schema: spec-driven
Change root: ...\openspec\changes\add-theme-toggle
Progress: 0/4 artifacts complete

[ ] proposal
[-] specs (blocked by: proposal)
[-] design (blocked by: proposal)
[-] tasks (blocked by: specs, design)
```

`status --json` 会额外给出 `artifactPaths`、`applyRequires`、每个产物的 `requires` 依赖边。**AI 靠这个 JSON 知道「下一个该写哪个文件、写到哪里」**,而不是靠猜路径——这正是 OpenSpec 能稳定驱动各种 AI 工具的原因。

### 第 3 步:让 AI 按指令写产物

```bash
openspec instructions proposal --change add-theme-toggle
```

输出是一段结构化的 `<artifact>` 指令,包含 `task` / `output` / `instruction` / `template` / `unlocks`(完整内容较长,这里摘录关键部分):

```text
<artifact id="proposal" change="add-theme-toggle" schema="spec-driven">
<task>Create the proposal artifact for change "add-theme-toggle".</task>
<output>Write to: ...\add-theme-toggle\proposal.md</output>
<instruction>
Sections:
- **Why**: 1-2 sentences on the problem or opportunity.
- **What Changes**: Bullet list of changes... Mark breaking changes with **BREAKING**.
- **Capabilities**: New Capabilities / Modified Capabilities ...
- **Impact**: Affected code, APIs, dependencies, or systems.
</instruction>
<template>...可直接套用的 Markdown 骨架...</template>
<unlocks>Completing this artifact enables: specs, design</unlocks>
</artifact>
```

AI 照 `template` 填内容、写到 `output` 指定的路径。产物齐了之后:

```bash
openspec status --change add-theme-toggle
```

```text
Progress: 4/4 artifacts complete

[x] proposal
[x] specs
[x] design
[x] tasks

All planning artifacts complete!
Next: openspec instructions apply --change "add-theme-toggle" --json
```

### 第 4 步:校验 —— `validate`

写完了不代表写对了。校验是 OpenSpec 最有价值的一环,它把「规格是否可验收」变成机器判断:

```bash
openspec validate add-theme-toggle
# Change 'add-theme-toggle' is valid
```

漏写增量规格时会明确报错(这是新手最常踩的坑):

```text
✗ [ERROR] file: Change must have at least one delta. No deltas found. Ensure your
change has a specs/ directory with capability folders (e.g. specs/http-server/spec.md)
... If this change intentionally modifies no specs (pure refactor, tooling, docs),
set "skip_specs: true" in the change's .openspec.yaml instead.
Totals: 0 passed, 1 failed (1 items)
```

这里有个很好的设计取向:**没有行为变化的纯重构/文档/工具类变更,不许硬造需求来骗过校验**,而是在 `.openspec.yaml` 里显式声明 `skip_specs: true`。

### 第 5 步:实现 —— `apply`

在 DSH 里说「开始实现这个变更」,或点名 `openspec-apply-change` 技能。技能会:

1. 读取 `tasks.md`,用待办列表逐条推进;
2. **每完成一条就把 `- [ ]` 勾成 `- [x]`**,并给出验证证据(测试命令与结果);
3. 发现规格与实现冲突时**停下来问你**,而不是默默改规格。

```bash
openspec list
# Changes:
#   add-theme-toggle     0/7 tasks     just now
```

### 第 6 步:归档 —— `archive`

```bash
openspec archive add-theme-toggle --yes
```

```text
Task status: 0/7 tasks
Warning: 7 incomplete task(s) found. Continuing due to --yes flag.

Specs to update:
  theme-system: create
Applying changes to openspec/specs/theme-system/spec.md:
  + 2 added
Totals: + 2, ~ 0, - 0, → 0
Specs updated successfully.
Change 'add-theme-toggle' archived as '2026-10-03-add-theme-toggle'.
```

归档做了两件事:**把增量合并进主规格**,并把变更目录挪到 `changes/archive/2026-10-03-add-theme-toggle/`。此后 `openspec list --specs` 就能看到新能力:

```text
Specs:
  theme-system     requirements 2
```

> 小技巧:只是想让主规格先行更新、暂不归档,用 `openspec-sync-specs` 技能或 `openspec archive --skip-specs` 的反向操作即可;纯文档/工具类变更加 `--skip-specs` 归档。

---

## 5. 在 DSH 里用好 OpenSpec

### 5.1 三种使用姿势

**姿势 A:纯 CLI(推荐给脚本和 CI)**

```bash
openspec list --json            # 变更列表(给程序读)
openspec list --specs           # 已有能力清单
openspec status --all           # 所有在途变更的产物进度
openspec validate --all         # 一次性校验全部
openspec validate --archived    # 归档前 lint:归档的变更必须任务全勾
openspec view                   # 终端交互式看板
openspec context                # 打印当前根目录的上下文简报
openspec doctor                 # 目录关系健康检查
```

**姿势 B:让 DSH 按技能干活(推荐给日常开发)**

直接用自然语言表达意图,由 DSH 选择技能。对应关系:

| 你想做的事 | 说法示例 | 背后技能 |
| --- | --- | --- |
| 需求还没想清楚 | 「先跟我理一下 X 该怎么做」 | `openspec-explore` |
| 提一个完整方案 | 「用 openspec 提一个变更:…」 | `openspec-propose` |
| 开始写代码 | 「开始实现这个变更」 | `openspec-apply-change` |
| 方案要改 | 「把变更里的 X 改成 Y,保持产物一致」 | `openspec-update-change` |
| 只更新主规格 | 「把增量同步进主规格」 | `openspec-sync-specs` |
| 收尾 | 「归档这个变更」 | `openspec-archive-change` |

**姿势 C:混合**——你自己在终端跑 CLI 检查,让 DSH 负责写产物。这也是调试技能行为时最实用的方式:`openspec status` 卡在哪一步,就问 DSH「为什么 `design` 还没生成」。

### 5.2 DSH 侧的入口细节

**(1) 技能入口:命令行里写 `/技能名`**

DSH 的技能有两种触发方式,都来自技能插件(`dsh-skill-filesystem` / `dsh-tool-skill`)的实测行为:

- **模型自动选中**:会话开始时 DSH 会把可被模型调用的技能以 `<available_skills>` 目录消息注入(只含 `name` + 截断的 `description`,默认上限 500 字符),模型再按需调用 `skill` 工具加载正文。OpenSpec 在 `description` 里塞了 `openspec propose`、`opsx propose` 这类关键词,就是为了被自然语言命中。
- **人工直接触发**:在输入框里输入**以空白为边界的 `/技能名`**,DSH 直接把该技能的正文注入当前会话——`/openspec-propose`、`/openspec-apply-change`、`/openspec-archive-change` 等 6 个都可用。这也是 `disable-model-invocation` 类技能唯一的入口。

也就是说,`/opsx:propose`(带冒号)是别的工具写法,DSH 里请写 `/openspec-propose "变更名或需求描述"`,或者干脆用一句中文说清楚。

**(2) 命令入口:第三方插件 `dsh-openspec`**

社区插件 **`@codigoconelmer/dsh-openspec`**(作者 Elmer Jacobo,MIT)把同一批官方工作流注册成 DSH 的原生斜杠命令——它不复制工作流,而是从 `@fission-ai/openspec` 包里读官方模板并转成 DSH 的扁平命名:

```bash
# 安装到某个 profile(重启 DSH 后生效)
dsh plugin --profile desktop add @codigoconelmer/dsh-openspec
# 或从本地 checkout 安装
dsh plugin --profile desktop add /path/to/dsh-openspec
```

| 命令 | 作用 |
| --- | --- |
| `/opsx-explore` | 提出变更前先探索问题与仓库 |
| `/opsx-propose` | 创建变更提案并生成规划产物 |
| `/opsx-apply` | 实现变更里的任务 |
| `/opsx-sync` | 把变更的增量规格同步进主规格 |
| `/opsx-archive` | 收尾并归档(官方 sync 流程会一并执行) |
| `/opsx-update` | 修订既有变更并保持产物一致 |

它的实现方式是「转向」(steer):命令被触发后把官方工作流文本作为一条消息交给当前会话的 agent,而不是开一个独立进程。**两个版本前沿要注意**:

- 插件 0.1.0 依赖的是 `@fission-ai/openspec@1.11.0`,而你全局装的是 1.14.0——命令走的是插件自带那一份工作流模板,`npm i -g` 升级全局 CLI **不会**同步更新它;等插件发新版本才跟上。
- 它的 README 还写着「DSH 没有被 OpenSpec 列为目标工具」,这句话在你本地已经过时:OpenSpec 1.14 的 `openspec init --tools dsh` 已原生支持 DSH。两套入口可以并存——技能(`/openspec-*`)和命令(`/opsx-*`)指向的是同一批官方工作流。

**(3) 其他斜杠命令不是 OpenSpec 的**

DSH 自带的 `/` 命令是会话级操作,和 OpenSpec 无关:`/compact`(压缩上下文)、`/plan`(计划模式)、`/goal`(长任务目标)、`/feedback`、`/permission`(沙箱 + 审批预设)、`/export`(Web 端导出会话日志 ZIP),Web 端另有 `/file`、`/model`。中文输入法下也能敲别名:`/压缩`、`/计划`、`/反馈`、`/目标`、`/权限`、`/导出`。它们和 `/openspec-*`、`/opsx-*` 共存,互不冲突。

**(4) `AGENTS.md` 是第三条通道**

如果你希望 DSH 在**这个项目里总是主动走 OpenSpec 流程**,别靠每次口头交代,把它写进工作区指令文件。DSH 会把用户全局 `~/.dsh/AGENTS.md` 加上从仓库根到会话工作目录的每一级 `AGENTS.md` / `CLAUDE.md`(`.local.md` 作为本地覆盖)注入首轮请求,总预算 64 KiB:

```markdown
## 规格驱动开发

- 本仓库使用 OpenSpec。任何行为变更必须先有 `openspec/changes/<name>/` 变更方案。
- 提需求时默认走 `openspec-propose`;实现前先跑 `openspec validate`。
- 归档前确认 `tasks.md` 全部勾选。
```

一个实践上的坑:**这个注入没有文件监听**。你改完 `AGENTS.md` 后,要等 DSH 成功执行一次 `read`/`write`/`edit`(或会话恢复)才会刷新;在 shell 里 `cd` 换目录**不会**触发发现。所以改完规则,最好让 DSH 立刻读一个文件。

**(5) 关于 `allowed-tools` 的提醒**

OpenSpec 生成的技能头部有 `allowed-tools: Bash(openspec:*)`。这**不是 DSH 的字段**——DSH 的技能 frontmatter 只认 `name`、`description`、`whenToUse`、`metadata`、`disable-model-invocation`、`user-invocable`,未知键会被忽略。它既不会报错,也**不会**真的把 DSH 限制在 `openspec` 命令上;DSH 的工具权限由会话的权限预设(`/permission`,决定沙箱模式与审批策略)统一管理。

**(6) 内置技能不会被覆盖**

DSH 打包内置了 `office-docx`、`office-pptx`、`office-xlsx`、`agent-experience`、`cordis-plugin-development` 等技能(优先级 600,即最后一档)。项目里的 `.dsh/skills/`(优先级 100)优先于它们,但两者共存、互不覆盖。同名时高优先级胜出——所以别把 OpenSpec 技能改名为 `office-docx`。

### 5.3 让 DSH 不跑偏的三个抓手

1. **`openspec/config.yaml` 写项目约束**,而不是写笔记。这个文件会被注入每次产物生成:

   ```yaml
   schema: spec-driven

   context: |
     所有产物用中文书写
     设计与任务必须覆盖 Windows / macOS / Linux

   rules:
     proposal:
       - 提案不超过 500 字
       - 必须写明不做什么(out of scope)
     tasks:
       - 每个任务必须附带可执行的验证方式
   ```

   注意:CLI 的 `instruction` 里明确要求 AI **不要把 `context` / `rules` 抄进产物**,它们是约束,不是内容。

2. **计划与实现分离**。`openspec-propose` 技能里有硬性边界:本次请求只授权「规划」,即使你说「顺便把它实现了」,它也必须停下等你的下一条指令。这是防 AI 一次跑太远的护栏。

3. **`tasks.md` 里写验证方式**。任务写成「实现 X,验证 Y」,apply 阶段 AI 就有明确的完成判据,而不是「我觉得写完了」。

### 5.4 每条技能在干什么(速查)

| 技能 | 边界 | 会不会改代码 |
| --- | --- | --- |
| `openspec-explore` | 只探讨、只读代码 | ❌ |
| `openspec-propose` | 只写规划产物 | ❌ |
| `openspec-update-change` | 只改既有变更的规划产物 | ❌ |
| `openspec-apply-change` | 按 tasks 实现、勾选任务 | ✅ |
| `openspec-sync-specs` | 增量 → 主规格 | ❌ |
| `openspec-archive-change` | 归档 + 合并规格 | ❌ |

---

## 6. 团队与多仓库:Stores(beta)

单仓库场景,上面就够了。团队真正的痛点在**跨仓库**:

- 一个功能横跨 `api-server`、`web-app`、`shared-lib` 三个仓库;
- 平台团队维护需求,业务团队只读引用;
- 计划必须先于代码存在。

**Store** 就是答案:一个独立的 OpenSpec 仓库,和代码仓库一样 `git push` 共享。

```bash
openspec store setup my-platform-specs   # 创建并注册本地 store
openspec store register E:\path\to\specs # 注册已有仓库
openspec store list                      # 列出已注册

openspec list --store my-platform-specs  # 把 store 当根目录使用
openspec archive add-theme-toggle --store my-platform-specs
```

选了 store 之后,`--store <id>` 在整条工作流里是**粘性**的:DSH 的技能会把它带到后续每条读/写规格的命令上(技能文档里写得很清楚:上面所有不带 `--store` 的示例都是简写,执行前要补上)。

另一个实用功能是 **workset**——把多个文件夹组合成一个个人工作视图:

```bash
openspec workset create my-view
openspec workset list
openspec workset open my-view
```

---

## 7. 常见坑与排查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `openspec list --json` 返回 `"root": null` 且退出码非 0 | 当前目录没有 `openspec/` 根,不是 CLI 坏了 | 在项目根执行 `openspec init`;或确认是否该用 `--store` |
| 校验报 `Change must have at least one delta` | 没写增量规格 | 补 `changes/<name>/specs/<capability>/spec.md`;纯重构类变更在 `.openspec.yaml` 里加 `skip_specs: true` |
| `openspec show add-theme-toggle` 报 `Unknown item` | 变更已归档,不在活动列表里 | 用 `openspec list --archived` 查归档名,再 `openspec show <归档名>` |
| 归档时提示 `N incomplete task(s) found` | `tasks.md` 还有未勾选项 | 让 DSH 继续 apply;确属误报可加 `--yes`,但会留下不一致 |
| 技能内容像是旧版本 | 升级了 npm 包但没刷新技能文件 | 在每个项目里跑 `openspec update` |
| `store:` 指向未注册的 store | `config.yaml` 声明了这台机器解析不到的 store | `openspec store register` 注册,或修正 `store:` 行 |
| 中文产物被写成英文 | 未设置语言 | `openspec init --language Chinese`,或在 `config.yaml` 的 `context` 里写明 |

排障三件套:`openspec doctor`(目录关系)、`openspec validate --all`(格式与完整性)、`openspec status --all`(进度)。

---

## 8. 最佳实践清单

**建模**

- **Capability 按「系统行为」命名,不要按「本次任务」命名**:`user-auth`、`book-catalog` 是对的;`add-login-endpoint` 是错的。
- **一个能力一个边界**,不要建 `common`、`utils` 这种大杂烩规格。
- 需求写可观察行为(「系统 SHALL …」),场景写 WHEN/THEN;不要写「使用 Redis 缓存」这种实现细节——那属于 `design.md`。
- 修改已有能力时,`Modified Capabilities` 里必须用 `openspec/specs/` 下的**精确路径**。

**流程**

- 变更名用 kebab-case,动宾结构:`add-book-search`、`fix-login-timeout`。
- 一次变更保持可独立评审、可独立归档的粒度;太大就拆。
- `proposal` 只写「为什么/改什么」,实现细节一律进 `design.md`。
- 复杂变更才写 `design.md`;简单改动跳过它,别为流程而流程。
- 实现完成后立刻归档,不要堆积在途变更。

**与 AI 协作**

- 先 `explore` 再 `propose`;先 `validate` 再 `apply`;先勾完任务再 `archive`。
- 任务条目自带验证方式,让 AI 有据可依。
- 用 `--json` 系命令把 OpenSpec 接进 CI(例如 pre-commit 里跑 `openspec validate --archived`)。
- 定期 `openspec update` 保持技能与 CLI 版本一致。

---

## 9. 结语:规格不是负担,是给 AI 的接口

OpenSpec 最聪明的地方,是它把自己做成了**AI 与人类之间的一份机器可读接口**:

- 人类靠 Markdown 读得懂 `proposal.md` 和 `spec.md`;
- AI 靠 `status --json` / `instructions --json` 知道下一步写什么、写到哪、遵守什么规则;
- CI 靠 exit code 判断规格是否完整、归档是否干净;
- Git 帮你把「当初为什么这么改」永久留存。

它没有发明新格式,也没有要求你改变技术栈——只是在 AI 和代码之间,补上了那块一直缺失的**共识层**。

下一步动手(五分钟):

```bash
npm install -g @fission-ai/openspec@latest
cd your-project
openspec init --tools dsh
```

然后对 DSH 说一句:

```text
用 openspec 提一个变更:给应用加上主题切换能力。
```

从这一句开始,你的 AI 就不再是「许愿池」,而是按规格交付的工程协作者。

---

## 参考

- OpenSpec 仓库:<https://github.com/Fission-AI/OpenSpec>
- 快速上手:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md>
- 核心概念:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/overview.md>
- 新工作流 `/opsx`:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/opsx.md>
- 命令与技能:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md>
- CLI 参考:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md>
- 支持的 AI 工具:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md>
- 团队工作流与 Stores:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/team-workflow.md>
- 编写规格:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/writing-specs.md>
- npm 包:<https://www.npmjs.com/package/@fission-ai/openspec>

> 验证环境:OpenSpec 1.14.0(npm 全局)+ DeepSeek Harness,Windows。示例中的日期、路径为本地执行结果。
> 本文可与同目录下的 `openspec-dsh-blog.html` 对照阅读(HTML 版含目录导航、深浅色主题与代码复制按钮)。
