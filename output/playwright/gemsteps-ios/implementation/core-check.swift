import Foundation

@main struct CoreCheck {
 static func main() throws {
  var checks = 0
  func check(_ ok: Bool) { precondition(ok); checks += 1 }
  func rejects(_ f: () throws -> Void) { do { try f(); fatalError("Expected rejection") } catch { checks += 1 } }
  let d = "2026-09-20"
  var s = PointsState(dateKey: d)
  func act(_ id: String, _ undo: Bool = false) throws { try s.include(s.change(itemID: id, undo: undo), on: s.dateKey) }
  try act("seed-task-face"); try act("seed-task-face"); try act("seed-task-brush")
  check(s.balance == 5 && s.dailyNet == 5 && s.counts["seed-task-face"] == 2)
  try act("reward-ice-stick"); check(s.balance == 0)
  rejects { _ = try s.change(itemID: "seed-task-brush", undo: true) }
  rejects { _ = try s.change(itemID: "reward-ice-stick", undo: false) }
  check(s.counts["seed-task-brush"] == 1)
  try act("reward-ice-stick", true); try act("seed-task-face", true)
  check(s.balance == 4 && s.counts["seed-task-face"] == 1)
  for n in [-2,10] { try s.include(s.adjustment(n), on: d) }
  check(s.balance == 12 && s.dailyNet == 12)
  var next = PointsState(dateKey: "2026-09-21", balance: s.balance)
  rejects { _ = try next.change(itemID: "seed-task-face", undo: true) }
  try next.include(next.change(itemID: "reward-ice-stick", undo: false), on: next.dateKey)
  check(next.balance == 7 && next.dailyNet == -5)
  let funded = PointsState(dateKey: d, balance: 100)
  for n in [1,2,3,5,10,100,-1,-100] { check(try funded.adjustment(n).points == n) }
  for n in [0,101,-101,Int.min,Int.max] { rejects { _ = try funded.adjustment(n) } }
  rejects { _ = try PointsState(dateKey: d, balance: Int.max).adjustment(1) }
  rejects { _ = try s.change(itemID: "forged", undo: false) }
  var all = PointsState(dateKey: d, balance: 1000)
  check(Catalog.tasks.count == 32 && Catalog.rewards.count == 9)
  for item in Catalog.tasks + Catalog.rewards {
   for _ in 0..<3 { try all.include(all.change(itemID: item.id, undo: false), on: d) }
   check(all.counts[item.id] == 3)
   for _ in 0..<3 { try all.include(all.change(itemID: item.id, undo: true), on: d) }
   check(all.counts[item.id] == 0)
   rejects { _ = try all.change(itemID: item.id, undo: true) }
  }
  check(all.balance == 1000 && all.dailyNet == 0)
  let iso = ISO8601DateFormatter()
  for (time, expected) in [("2026-09-21T06:59:59Z", d), ("2026-09-21T07:00:00Z", "2026-09-21"), ("2026-12-15T07:59:59Z", "2026-12-14"), ("2026-12-15T08:00:00Z", "2026-12-15"), ("2026-03-08T09:59:59Z", "2026-03-08"), ("2026-03-08T10:00:00Z", "2026-03-08"), ("2026-11-01T08:59:59Z", "2026-11-01"), ("2026-11-01T09:00:00Z", "2026-11-01")] { check(PacificDate.key(iso.date(from: time)!) == expected) }
  print("PASS: \(checks) Foundation-only checks; no SwiftData, SwiftUI, or iOS execution.")
 }
}
