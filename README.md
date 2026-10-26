# BoardmixCLI

Boardmix 桌面画板的元命令能力包。提供文件新建、命名、打开和关闭，PNG/JPEG/WebP 导入、Frame 与文字创建、图元读取、精确尺寸与位置调整，返回 JSON 结果。当前 Agent 负责材料选择、顺序、布局与业务验收。

> 安装 @petercjl/boardmixcli，并验证当前 Agent 的配套 Skill 可用。

> 更新 @petercjl/boardmixcli，并验证当前 Agent 的配套 Skill 已同步。

> 使用 boardmixcli 新建一个画板，命名为“图片整理”，将我提供的 PNG 图片按指定顺序纵向无间隙排列，保存后退出画板。

安装与更新的完整 Agent 交接见 [INSTALL.md](INSTALL.md)、[UPDATE.md](UPDATE.md)。npm 安装后还需同步当前 Agent 的配套 Skill；包管理入口提供物理隔离的资源与运行时，并由当前 Agent 确认宿主发现状态。适用于具备 Node.js、文件访问、本地 HTTP 和授权桌面控制能力的 Agent。

## 开发者参考

需要 Node.js >=22、已登录的 Boardmix，以及每个打开画板的 Console 连接。连接使用随机 loopback 端口和临时令牌；安装不授予服务访问权限。此包为独立开发的实验性工具，使用官方插件图元能力和版本锁定的内部桌面适配器。macOS Boardmix 1.7.2 / 前端 `index-DjSD2oPg.js` 已验证；其他桌面平台尚未验证，前端更新可能需要适配。

运行 `boardmixcli capabilities --json`、`boardmixcli doctor --json` 发现合同；`boardmixcli skill source --json` 定位配套手册。参数、坐标、错误与恢复详见 [CONTRACT.md](CONTRACT.md)。业务状态保留在 Boardmix，会话和本地材料留在调用者本机。

```sh
boardmixcli serve --session /absolute/new-session.json
boardmixcli board.info --session /absolute/new-session.json --file-key EXPLICIT_BOARD_KEY
```

`serve` 创建新的私有会话文件与 `.bootstrap.js`。在目标编辑器 Console 中执行启动脚本，然后关闭开发者工具；每个新打开的画板需要单独连接。会话文件包含临时令牌，勿公开。CLI 使用 App 现有登录态，不读取或导出登录凭证。

可用操作：`board.info/create/rename/open/close`、`image.list/inspect/download/import`、`frame.create`、`text.create`、`object.selection/get/move/resize`、`view.fit`。图元移动使用绝对左上角画板坐标；尺寸调整保留宽高比锁定状态。创建和导入超时后先核查结果再决定后续动作。

运行 `npm test` 与 `npm run check` 检查包、命令与安装生命周期。真实画板证据、私人会话和备份均不进入公开包。

Batch contract v1 supports up to 20 images per native import, durable import receipts, bulk object reads and explicit bulk placement. See CONTRACT.md for JSON inputs and recovery behavior.

Existing logged-in Chrome sessions can connect through `browser.targets/open/connect/close` using an explicit loopback CDP endpoint. This route keeps DevTools closed; no desktop restart or additional profile is required. See CONTRACT.md.

## Managed browser and login

`browser.ensure --json` starts/reuses macOS Google Chrome at http://127.0.0.1:9223 using the persistent `~/.dianshang-chrome-profile`, opens Boardmix home if absent, and returns `state:ready` only after workspace login markers are visible. No pre-opened Boardmix tab is required. The packaged launcher has no ecommerce CLI dependency.

`auth.status --json` is read-only. `auth.wait --wait-ms 60000 --json` resumes preparation and polls login for up to 60 seconds; `browser.ensure` defaults to 15 seconds and returns immediately on an identified login page. AUTH_REQUIRED includes a human login prompt and resume command. Unknown/load states remain AUTH_STATE_UNKNOWN. CLI exits nonzero until ready. Human login/verification stays in Chrome; the CLI does not read or print credentials. Repeat calls reuse the profile and home tab.

Startup verifies the listening process, Chrome executable, debugging port and exact profile. PORT_CONFLICT refuses to change other processes. Missing Chrome and unsupported launch platforms are explicit errors. Windows/Linux launch is not implemented. Existing explicit-endpoint browser commands remain compatible. Browser readiness does not grant file write authorization; continue with the caller-selected file and bridge session.
