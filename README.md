# PhotoGo

给 Mac 用的挑片工具：直接读 SD 卡，看 RAW/JPG，打星、删除，把精选送进 Lightroom。

## 目录

- `src/`：应用源码。`main.js` 是很小的启动器，负责选版本和检查更新；`app.js` 是应用本体（窗口、开启动画、菜单）；`index.html` 是界面。
- `update/`：自动更新频道。应用每次启动会读 `update/manifest.json`，版本号比自己新就在后台下载这里的文件（逐个校验 sha256），下次启动生效。新版本打不开时会自动退回上一个能用的版本。

## 发布新版本

```
cd src
node make-update.js 2.3.1 ../update "这次改了什么"
git add -A && git commit -m "PhotoGo 2.3.1" && git push
```

只改界面、开启动画或 `app.js` 都可以这样发。改 `main.js`（启动器本身）需要重新打包安装一次，并把 `make-update.js` 里的 `minLoader` 调高。
