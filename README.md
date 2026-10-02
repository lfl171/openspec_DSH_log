# OpenSpec × DeepSeek Harness 实践笔记

记录 OpenSpec(spec-driven development)的使用与介绍,以及如何在 **DeepSeek Harness(DSH)** 里把它跑起来。
文中所有命令输出都是在 OpenSpec **1.14.0**(npm 全局)+ DSH + Windows 上真实执行并核对过的。

## 仓库内容

| 文件 / 目录 | 说明 |
| --- | --- |
| [`openspec-dsh-blog.md`](openspec-dsh-blog.md) | 博客正文(Markdown,适合直接当文章发布) |
| [`openspec-dsh-blog.html`](openspec-dsh-blog.html) | 同一篇内容的独立 HTML 单文件(零外部依赖,双击即可看) |
| [`build-html.mjs`](build-html.mjs) | md → html 构建脚本,见下方用法 |
| [`openspec-demo/`](openspec-demo) | 文中示例的可运行产物,含 `.dsh/skills/`、`openspec/` 与一个已归档的变更 |

`openspec-demo/` 是执行下面这套命令后留下的真实结果:

```bash
openspec init --tools dsh
openspec new change add-theme-toggle
openspec status --change add-theme-toggle
openspec validate add-theme-toggle
openspec archive add-theme-toggle --yes
```

## 快速开始(把 OpenSpec 接到自己的项目里)

```bash
# 1. 安装 CLI(要求 Node.js >= 20.19.0)
npm install -g @fission-ai/openspec@latest

# 2. 在项目里初始化,并让 OpenSpec 写入 DSH 技能
cd your-project
openspec init --tools dsh

# 3. 之后在 DSH 里用自然语言或 /技能名 触发即可
#    /openspec-explore  /openspec-propose  /openspec-apply-change
#    /openspec-update-change  /openspec-sync-specs  /openspec-archive-change
```

可选:安装社区插件,把同一批官方工作流暴露成 DSH 原生斜杠命令 `/opsx-*`。

```bash
dsh plugin --profile desktop add @codigoconelmer/dsh-openspec
```

## 博客要点

- **为什么需要规格**:AI 写代码不可预测的根因是需求只活在聊天记录里。
- **核心模型**:Spec / Change / Delta / Archive / Store / Schema,以及 Delta 机制为什么能扛并发开发。
- **完整链路**:explore → propose → status → validate → apply → archive,含真实终端输出。
- **DSH 集成**:技能发现的多根目录与优先级、SKILL.md frontmatter 的实际字段、技能与斜杠命令的区别、
  `allowed-tools` 在 DSH 中不生效、以及 `AGENTS.md` 这条常驻指令通道。
- **团队与多仓库**:Stores 与 workset 的用法。
- **排查与最佳实践**:常见报错对照表 + 建模/流程/协作三类清单。

## 重新生成 HTML

改完 Markdown 后执行(需要 Node.js):

```bash
node build-html.mjs openspec-dsh-blog.md openspec-dsh-blog.html
```

脚本自带一个够用的 Markdown 渲染器(标题 / 列表 / 表格 / 引用 / 代码块 / 行内格式),
并在页面里加入侧栏目录、滚动高亮、阅读进度条、代码复制按钮,配色跟随系统深浅色。

## 环境

- OpenSpec `1.14.0`(npm 全局安装)
- DeepSeek Harness(桌面版)
- Node.js `>= 20.19.0`,Windows

## 参考

- OpenSpec 仓库:<https://github.com/Fission-AI/OpenSpec>
- 快速上手:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md>
- 命令与技能:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md>
- CLI 参考:<https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md>

## License

文章与示例代码可自由取用;OpenSpec 本体为 MIT,`@codigoconelmer/dsh-openspec` 插件为 MIT(作者 Elmer Jacobo)。
