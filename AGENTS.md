# Project Workflow (Required)

## 1) 开发前
- 对现有 `main` 进行只读检查，不在 `main` 分支直接开发。
- 为每个任务创建一个独立 worktree 和一个 feature 分支（`codex/<task-name>`）。

## 2) 在新 worktree 上开发
- 在新 worktree 的 feature 分支完成全部代码改动、资源更新和本地校验（如有需要）。
- 确认功能逻辑正确、提交后仅包含必要改动。

## 3) 合并回主工作区
- 将 feature 分支合并回本地 `main` 所在的主 worktree 的 `main` 分支。
- 合并后在主 worktree 进行一次最终检查（与主线状态一致）。

## 4) 收尾并清理
- 将已完成的 feature worktree 删除。
- 将 `main` 分支 push 到远端（`origin main`）。
- 生产部署由远端 `main` 推送触发；如需临时验收，才使用非主分支预览。

## 3-step Git order
```bash
# 1. 创建新 worktree + 分支
# 2. 在 worktree 上完成开发并提交
# 3. 合并回 main 并推送
```

## 禁止项
- 避免在非主分支远端进行生产发布（避免生产与开发环境混用）。
- 避免在主 worktree 直接长期开发，保持“feature worktree -> merge back -> cleanup”的闭环。
