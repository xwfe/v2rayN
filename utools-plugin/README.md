# v2rayN uTools 插件（Node 版多核心调度）

该插件通过 uTools/Electron 的渲染层 + Node.js 预加载脚本，实现了 v2rayN Wiki 中介绍的多核心并行管理能力。无需依赖 C# 主程序，直接在插件面板中即可：

- 配置各类核心（Xray、sing-box、Clash.Meta、Hysteria2、TUIC 等）的执行文件与参数
- 一键启动 / 停止 / 重启任意核心，或批量处理
- 监听每个核心的标准输出 / 错误输出，实时查看聚合日志
- 指定需要自动启动的核心，插件进入时自动拉起

## 使用步骤

1. 将对应核心的可执行文件与配置放入 `utools-plugin/cores` 目录下（结构在 `backend/cores.config.json` 中有示例）
2. 打开插件面板，在「核心列表」中为每个核心设置实际路径与参数
3. 点击“保存配置”后即可启动核心；日志面板会实时显示最新的多核心输出
4. 若需要遵循 v2rayN 的官方模板，可参考 [Wiki](https://github.com/2dust/v2rayN/wiki) 中关于多核心的章节，再将生成的配置复制到 `configs/*.json` 文件中

> **Tip**：输入框留空即可恢复到 `cores.config.json` 中的默认路径/参数；勾选“随插件启动”即可在进入 uTools 时立即启动该核心。

## 前端开发（Vue3 + Vite）

1. 在 `utools-plugin` 目录执行 `npm install`
2. `npm run dev`：本地调试界面（支持 HMR），构建产物输出在 `renderer/dist`
3. `npm run build`：为 uTools 插件生成静态资源，`plugin.json` 的 `main` 指向 `renderer/dist/index.html`
4. 可选：`npm run type-check` 触发 `vue-tsc` 进行静态类型检查
