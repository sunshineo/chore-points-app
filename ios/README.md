# GemSteps iOS

SwiftUI 单设备本地应用，最低构建目标 iOS / iPadOS 17。采用 SwiftData
默认 SQLite 持久化逐笔积分，不连接 Web 后台，不使用 CloudKit。
32 项任务、9 项奖励沿用 Web；无 PIN、认证、编辑、AI 或统计页面。

**主体实现与主要模拟器验收通过；仍有必验项未验证，不能标记整体完成。**
现已安装 Xcode 27 与 iOS 27 runtime，应用构建和10项原生 XCTest 已通过；
已操作iPhone13、iPhoneSE、iPad11，完成主要业务、跨日、尺寸和动画对照。详见 [执行记录](IMPLEMENTATION_PLAN.md#8-本次实施与验收记录)。

## 运行

1. 从 App Store 安装完整 Xcode，首次启动完成许可和组件安装。在
   Xcode → Settings → Components 安装 iOS Simulator runtime。
2. 打开 `ios/GemSteps.xcodeproj`，选择共享 scheme `GemSteps`。
3. 选择已安装的 iPhone 或 iPad 模拟器，⌘R；⌘U 执行测试。
   模拟器不需要 Apple 登录。真机需在 Signing & Capabilities 选择自己的 Team，
   连接设备并启用 Developer Mode。本轮不发布或分发应用。
4. 如果命令行仍选中 Command Line Tools，可对单条命令指定完整 Xcode：

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project ios/GemSteps.xcodeproj -scheme GemSteps -showdestinations
```

从返回列表选取模拟器 UUID，再运行：

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project ios/GemSteps.xcodeproj -scheme GemSteps \
  -destination 'platform=iOS Simulator,id=<上一步的 UUID>' \
  -derivedDataPath ios/DerivedData test CODE_SIGNING_ALLOWED=NO
```

已在本机 iPhone 13 / iOS 27 模拟器构建运行并通过10项 XCTest。无第三方依赖，无需服务端。
只使用本地 App 沙盒的默认持久化文件。打开失败不会自动删除数据库或重置分数。

## 有限对照

Debug scheme → Run → Arguments 可加两个参数：
`-gemsteps-date` 和 `2026-09-20T19:00:00Z`。
它固定业务时间，动画计时保持正常；额外加 `-gemsteps-date-advances` 可从该时间随真实时间前进，用于实际10秒跨日检查。Release 不读取这些参数。
按[截图索引](../output/playwright/gemsteps-ios/README.md)从全新模拟器安装依次操作
S0–S6。改为 `2026-09-21T07:00:01Z` 并重启可检查 S4；前台计时跨午夜与后台恢复已另行实测，固定启动时间不代替这两项。不要删除真实使用设备的数据来重放。

[本次 Web 重放截图与验证证据](../output/playwright/gemsteps-ios/implementation/README.md)
[原生成对截图与逐项验收记录](../output/playwright/gemsteps-ios/native/README.md)；完整验收仍在进行。

`GemStepsTests` 包含实现后添加的业务、临时数据库重开、只读保存失败回滚、
损坏库不覆盖测试；10项原生 XCTest 已通过。Foundation 核心的独立检查可在 CLT 上运行：

```sh
swiftc ios/GemSteps/Models/Catalog.swift ios/GemSteps/Models/PointsState.swift \
  output/playwright/gemsteps-ios/implementation/core-check.swift -o /tmp/gemsteps-core-check
/tmp/gemsteps-core-check
TZ=Asia/Shanghai /tmp/gemsteps-core-check
```

资源：12 张卡片 PNG 为 Web 原文件；AppIcon 由现有 180×180 图等比放大至
1024×1024，仅作内部开发图标，不是高清源图或已验收的发布素材。
[音效参数](GemSteps/Resources/Audio/README.md)与 Web 相同；实际听感待验证。


## 剩余验收

真机音效／音频路由和飞行模式、iOS17实际运行、Escape、最后弹层调整后的窄屏软键盘、
减弱动态效果与极端字号仍未全部验证。未安装到个人真机。字体、emoji、渐变和粒子轨迹
存在少量原生差异；详情和修复前后截图见[验收索引](../output/playwright/gemsteps-ios/native/README.md)。
额外不足撤销提示未获批准，保持关闭；没有新增依赖或产品功能。
