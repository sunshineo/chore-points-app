# Repository layout

- `web/` contains the existing Next.js application, including its database,
  tests, assets, and operational documentation. Run npm commands from `web/`.
- `ios/` and `android/` contain the native SwiftUI and Kotlin/Compose applications.
- `.github/` and `.husky/` remain at the repository root.
- Follow the platform-specific instructions in each application's directory.

# Product scope

The initial native applications use the same task list every day, without
morning/evening groups or weekday/weekend schedules. Manual editing remains
available; device AI may assist with the same edits when supported.

# Working conventions

Use the primary checkout on `main` unless explicitly instructed otherwise.
Preserve unrelated changes. Implement first, then verify; do not use TDD.
Keep environment files and generated build artifacts out of Git.
