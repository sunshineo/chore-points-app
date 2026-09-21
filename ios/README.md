# GemSteps iOS

SwiftUI 单设备本地应用，最低 iOS / iPadOS 17。使用 SwiftData / SQLite
保存逐笔积分，不连接 Web 后台，不使用 CloudKit。32 项任务、9 项奖励；
保留临时加减分、当天同项撤销与跨日累计余额，无 PIN、编辑、AI 或统计页面。

## 原生界面（2026-09-20）

- 手机两列大方块；iPad 按可用窗口宽度增加列数。任务与奖励使用同一 LazyVGrid。
- 紧凑头部：积分在左、日期与今日变化在右；手机按钮另排一行，宽屏同排。
  头部下方是等宽的“任务／奖励”原生按钮，再下方才是卡片；不使用 TabView。
  使用系统按钮与字体，紫色页头、多彩卡片和靛紫色选中态；背景跟随深浅色，文字支持动态字号。
- 临时加减分使用系统 sheet；选择 ＋／−，用数字键盘输入最多三位数字，再点 ✓ 确认。
  顶部为 ＋、带符号数字、−，与键盘共用三列，加减按钮与数字键等大对齐；加分绿色、减分红色，未选中使用灰调对应色。
  iOS 18+ 使用系统 fitted presentation 按内容确定弹层尺寸，宽度设上限；高度不足时自动改为滚动。
  iOS 17 保留系统默认 sheet 尺寸，不使用固定高度档位。
  键盘最后一排为 0、退格、✓，三键等大；✓ 跟随加减颜色，无清空键。
  每次可加减 1–999，0 或空值不能确认；超额扣分归零，记录及反馈使用实际扣除值。
  成功后播放庆祝并自动关闭；右上角 × 可直接关闭，保存失败时保留输入并显示错误。
- 成功后全屏遮住应用内容，以大图和分数庆祝约 2 秒，期间阻止重复操作。
  临时加减分在 sheet 内播放庆祝，其余操作全屏播放；系统减弱动态效果下使用淡入。撤销不庆祝、不播放音效。
- 新音效采用 Kenney Interface Sounds（CC0），用 AVAudioPlayer 播放；
  旧 Web 合成 WAV 已删除。来源、映射及许可见 [音效说明](GemSteps/Resources/Audio/README.md)。

旧 Web 逐像素比对不再是验收标准。详细执行与限制见
[原生风格改造记录](IMPLEMENTATION_PLAN.md#9-原生风格改造2026-09-20)。

## 运行与验证

打开 `ios/GemSteps.xcodeproj`，选择 `GemSteps` scheme 和 iPhone / iPad 模拟器，
⌘R 运行、⌘U 测试。模拟器不需要 Apple 登录。真机需自行选择 Signing Team。

```sh
xcodebuild -project ios/GemSteps.xcodeproj -scheme GemSteps -showdestinations
xcodebuild -project ios/GemSteps.xcodeproj -scheme GemSteps \
  -destination 'platform=iOS Simulator,id=<模拟器 UUID>' \
  -derivedDataPath ios/DerivedData test CODE_SIGNING_ALLOWED=NO
```

从仓库根目录运行以上命令。已在 Xcode 27 / iOS 27 模拟器通过构建和 16 项 XCTest，
包括积分规则、跨日、数据库重开、保存失败回滚、损坏库不覆盖、庆祝锁定与延后呈现、
新音效打包及解码。没有新增第三方代码依赖，没有更改持久化模型。

iOS 17 实际运行和真机音效／静音／蓝牙仍待验证；模拟器不代表真机听感与触觉。
应用图标仍是原有低分辨率素材放大的内部开发图标。

## 界面语言

`GemSteps/Localizable.xcstrings` 管理英文和简体中文界面文案，包括按钮、错误提示和辅助朗读。
页头右上角的地球图标提供简体中文、English 两个选项，不单独占一行。
首次启动按系统首选语言初始化并保存：任何中文变体使用简体中文，其他语言使用英文。
后续启动使用已保存的语言，不随系统语言改变；用户可随时手动切换。
切换立即更新界面、日期和辅助朗读，重新打开应用保留选择，不重建积分状态。
日期和星期使用应用语言格式化，积分归属日期继续采用原有洛杉矶时区。
任务和奖励名称属于内容数据，不参与界面翻译，也不会因语言变化而改写。
英文计数使用 “Points: …” 和 “Count: …” 等格式，避免单复数歧义。

## 固定业务时间

Debug 启动参数 `-gemsteps-date 2026-09-20T19:00:00Z` 固定业务时间，
不影响动画；加 `-gemsteps-date-advances` 可随真实时间前进。Release 不读取这些参数。
不要删除真实设备上的数据来重放测试；测试数据库位于独立临时目录。
