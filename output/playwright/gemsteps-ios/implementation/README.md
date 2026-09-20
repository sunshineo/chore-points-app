# 2026-09-20 实施检查证据

本目录是首轮实现期间重新运行的 **Web 参照与核心检查**，不是 iOS 截图或原生验收结果。
尚无成对 iOS 图，原因是本机没有完整 Xcode / iOS SDK / Simulator runtime。
完整状态见 [实施记录](../../../../ios/IMPLEMENTATION_PLAN.md#8-本次实施与验收记录)。

## 隔离 Web 重放

PostgreSQL 17 临时容器 `gemsteps-ios-implementation-db`，仅映射
`127.0.0.1:55439`，库 `gemsteps_ios_implementation_test`。使用仓库测试数据库
保护脚本显式覆盖 DATABASE_URL；PIN 和会话密钥均为临时测试值。
Next dev `localhost:3107`；独立 Playwright Chromium 会话；390×844，截图 1×。
这是桌面浏览器 viewport 模拟，不是 iOS Safari 或 iPhone 截图。
日期 D=`2026-09-20T19:00:00Z`，D+1=`2026-09-21T07:00:01Z`。
仅隐藏 Next 开发工具，Web 产品源码及 CSS 未修改；截图保留不移植的锁按钮。

| 截图 | 数据／检查 |
|---|---|
| [S0](web-S0-390.png) | 空库 0／0，普通任务页 |
| [S1](web-S1-390.png) | 洗脸×2、刷牙×1 → 5／+5，次数2／1 |
| [S2](web-S2-undo-390.png) | 兑换棒棒糖 → 0／0，奖励撤销模式 |
| [S3 稳定态](web-S3-invalid-stable-390.png) | 退款并撤销一次洗脸 → 4；临时减5显示最多可减4 |
| [S4](web-S4-next-day-390.png) | 临时−2、+10，次日12／0，任务次数归零 |
| [S5](web-S5-negative-390.png) | 次日兑换棒棒糖 → 7／−5 |
| [S6 动态](web-S6-celebration-390.png) | 次日洗脸+1，约0.7秒庆祝过程 |
| [S6 刷新](web-S6-reload-390.png) | 刷新后8／−4，默认任务页，洗脸1次 |

`web-S3-invalid-390.png` 是第一次即时截图，检查发现捕获了按钮颜色过渡帧，
**不用于稳定态视觉参照**。已局部重拍 `web-S3-invalid-stable-390.png`：回到 D，
补拍先在 D 临时−8，然后在 D+1 临时+4抵消该日净支出，回 D 时可见余额4、
当日+4、任务次数1／1，与 S3 相同，截图等待0.8秒。此后没有再改回 S6。
补拍数据只用于当前页面稳定态核对，含额外逐笔记录，不等于 S3 的完整跨日账本。
第一次 S0→S6 是原索引中的同一操作序列，不将补拍调整误称为原始逐笔数据。

## 实际通过的检查

- Web Vitest：94/94；隔离数据库集成测试：19/19。
- Foundation 核心：157项检查，默认时区通过；`TZ=Asia/Shanghai` 再次通过。
  包括41项卡片重复完成与撤销、禁止无次数撤销、无余额扣分、临时边界、未知ID、
  PT夏／冬午夜与DST当天日期。见 [core-check.swift](core-check.swift)。
- 41项目录的 ID／标题／emoji／分值／顺序与Web逐项比较通过；12 PNG字节相同。
- Xcode工程 `plutil` 解析、所有Swift源码语法解析通过；PointCard在macOS SDK
  单独typecheck通过。**这些都不是iOS构建通过。**

从仓库根目录重跑核心检查（无第三方依赖）：

```sh
swiftc ios/GemSteps/Models/Catalog.swift ios/GemSteps/Models/PointsState.swift \
  output/playwright/gemsteps-ios/implementation/core-check.swift -o /tmp/gemsteps-core-check
/tmp/gemsteps-core-check
TZ=Asia/Shanghai /tmp/gemsteps-core-check
```

XCTest 7 个方法已添加但未运行。SwiftData 的尝试编译报缺少 SwiftDataMacros；
数据库保存／重开／故障、原生UI、内容安全区、辅助字号、音频听感、动画时序、
真实启动性能（包括约18,250条记录）均未验证。

## CSS 颜色核对与修复

从运行中Web读取 `--color-*` 计算值（当前编译结果为Lab），用Canvas转换为sRGB。
卡片两端色值按Web索引顺序：

| 粉 | 紫 | 靛 | 蓝 | 青 |
|---|---|---|---|---|
| FB64B6/F6339A | C27AFF/AD46FF | 7C86FF/615FFF | 50A2FF/2B7FFF | 00D3F2/00B8DB |

| 蓝绿 | 绿 | 黄 | 橙 | 红 |
|---|---|---|---|---|
| 00D5BE/00BBA7 | 05DF72/00C950 | FDC700/F0B100 | FF8904/FF6900 | FF6467/FB2C36 |

页头 `9810FA → 4F39F6 → 155DFC`；emerald-500=`00BC7D`；rose-500=`FF2056`。
发现首稿蓝／黄／靛／玫红的部分值有差异，已修正并复验源码。Lab／sRGB／SwiftUI
渐变插值仍可能存在差异，必须等原生截图后判断，尚未标为视觉通过。

清理记录：本次独立 Playwright 会话已关闭，临时 Next 服务已停止，测试容器已停止并移除。
