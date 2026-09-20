# 飞牛 .fpk 包结构详解

基于 `archive/original-fpk/`（dzk3d.fpk 解包）和 [飞牛开发者文档](https://developer.fnnas.com/docs/guide/) 整理。

## .fpk 文件格式

`.fpk` 本质是 **gzip 压缩的 tar 包**（`.tar.gz`），可用 `tar xzf xxx.fpk` 直接解开。

## 顶层结构

```
xxx.fpk
├── manifest              # 应用元信息（INI 风格文本）
├── ICON.PNG              # 应用图标（小，64px）
├── ICON_256.PNG          # 应用图标（大，256px）
├── cmd/                  # 生命周期钩子脚本（bash）
│   ├── main              # start/stop/status 入口
│   ├── install_init      # 安装前调用
│   ├── install_callback  # 安装后调用
│   ├── uninstall_init    # 卸载前调用
│   ├── uninstall_callback# 卸载后调用
│   ├── upgrade_init      # 升级前调用
│   ├── upgrade_callback  # 升级后调用
│   ├── config_init       # 修改环境变量前调用
│   └── config_callback   # 修改环境变量后调用
├── config/
│   ├── privilege         # JSON: 运行身份 (run-as / username / groupname)
│   └── resource          # JSON: 资源声明（通常 {}）
└── app.tgz               # 内层 tar.gz，包含实际应用文件
```

## manifest 字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `appname` | 应用唯一标识，决定安装路径 `/var/apps/<appname>/` | `breakout3d` |
| `version` | 版本号，X.Y.Z 格式 | `1.0.0` |
| `display_name` | 桌面显示名称 | `打砖块3D版` |
| `desc` | HTML 描述，三引号包裹 | `"""<div>...</div>"""` |
| `arch` | 架构：`all` / `x86_64` / `aarch64` | `all` |
| `source` | 来源：`thirdparty` / `official` | `thirdparty` |
| `maintainer` | 维护者名称 | `Merci-Michel` |
| `maintainer_url` | 维护者主页 | `https://...` |
| `distributor` | 分发者（可空） | |
| `distributor_url` | 分发者主页（可空） | |
| `desktop_uidir` | 桌面 UI 目录名（相对 app.tgz 内） | `ui` |
| `desktop_applaunchname` | 桌面启动项标识，与 `app/ui/config` 中的 key 对应 | `breakout3d.Application` |
| `platform` | 平台约束（通常留空） | |
| `checksum` | **`app.tgz` 的 MD5**，打包时计算 | `0674ffe7704daf8e8d721cd4525bb7e9` |

## app.tgz 内层结构

解压后落到 `/var/apps/<appname>/target/`：

```
app.tgz
├── config/
│   ├── privilege         # 同顶层 config/privilege（飞牛要求两处都有）
│   └── resource
├── ui/                   # 桌面集成
│   ├── index.cgi         # CGI 脚本，把 www/ 通过 HTTP 暴露给桌面 iframe
│   ├── config            # JSON: 注册桌面入口（type=iframe, url=/cgi/ThirdParty/<appname>/index.cgi/）
│   └── images/
│       ├── icon_64.png
│       └── icon_256.png
└── www/                  # 实际 Web 应用内容
    ├── index.html
    └── assets/...
```

## Web 应用运行机制

1. 安装后，`app.tgz` 解压到 `/var/apps/<appname>/target/`
2. 飞牛桌面读取 `ui/config`，注册一个 iframe 类型的桌面入口
3. 用户点击图标 → 桌面加载 iframe，URL 为 `/cgi/ThirdParty/<appname>/index.cgi/`
4. 飞牛内置 CGI 服务器执行 `ui/index.cgi`
5. `index.cgi` 根据 `REQUEST_URI` 拼出 `/var/apps/<appname>/target/www/<path>`，读取文件并返回（带正确 Content-Type）

### index.cgi 关键约定

- `BASE_PATH` 必须指向 `/var/apps/<appname>/target/www`
- 默认路径 `/` → `/index.html`
- 禁止 `..` 越级访问
- 根据扩展名设置 MIME type

## cmd/main 约定

```bash
case $1 in
  start)   exit 0 ;;   # 启动成功返回 0
  stop)    exit 0 ;;   # 停止成功返回 0
  status)  exit 0 ;;   # 运行中返回 0，未运行返回 3
  *)       exit 1 ;;
esac
```

纯 Web 应用（无后台进程）三个分支都 `exit 0` 即可。

## config/privilege

```json
{
  "defaults": { "run-as": "package" },
  "username": "<appname>",
  "groupname": "<appname>"
}
```

`run-as: package` 表示以应用专属用户身份运行（飞牛自动创建）。

## 打包流程

1. 准备 staging 目录，放入 `manifest` / `ICON*.PNG` / `cmd/` / `config/` / `app/`
2. 把前端资源复制到 `app/www/`
3. `tar czf app.tgz -C app/ .`
4. `checksum = md5sum(app.tgz)`
5. 把 checksum 写入 manifest
6. `tar czf <appname>.fpk manifest ICON.PNG ICON_256.PNG cmd/ config/ app.tgz`

官方 `fnpack build -d <staging>` 会自动完成 3-6 步。

## 参考

- [飞牛开发者文档](https://developer.fnnas.com/docs/guide/)
- [fnpack CLI 文档](https://developer.fnnas.com/docs/cli/fnpack/)
- [fnpackup (fnpack 可视化包装)](https://github.com/snltty/fnpackup)
- [nowen-note fpk 打包脚本](https://github.com/cropflre/nowen-note/tree/main/scripts/fpk)
