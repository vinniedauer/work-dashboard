import Foundation
import EventKit

let store = EKEventStore()
let semaphore = DispatchSemaphore(value: 0)
var accessGranted = false

if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { success, _ in
        accessGranted = success
        semaphore.signal()
    }
} else {
    store.requestAccess(to: .event) { success, _ in
        accessGranted = success
        semaphore.signal()
    }
}
semaphore.wait()

guard accessGranted else {
    fputs("Calendar access denied\n", stderr)
    exit(1)
}

let args = CommandLine.arguments
let offsetDays = args.count > 1 ? (Int(args[1]) ?? 0) : 0
let allowedNames: [String] = args.count > 2 && !args[2].isEmpty
    ? args[2].split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
    : []

let cal = Calendar.current
let now = Date()
var startComps = cal.dateComponents([.year, .month, .day], from: now)
startComps.day! += offsetDays
startComps.hour = 0
startComps.minute = 0
startComps.second = 0

guard let startOfDay = cal.date(from: startComps),
      let endOfDay = cal.date(byAdding: .day, value: 1, to: startOfDay) else {
    fputs("Failed to compute date range\n", stderr)
    exit(1)
}

let allCalendars = store.calendars(for: .event)
let calendarsToSearch = allowedNames.isEmpty
    ? allCalendars
    : allCalendars.filter { allowedNames.contains($0.title) }

let predicate = store.predicateForEvents(withStart: startOfDay, end: endOfDay, calendars: calendarsToSearch)
let events = store.events(matching: predicate)

let iso = ISO8601DateFormatter()
iso.formatOptions = [.withInternetDateTime]

for (idx, event) in events.enumerated() {
    let title = (event.title ?? "").replacingOccurrences(of: "|||", with: " ")
    let start = iso.string(from: event.startDate)
    let end = iso.string(from: event.endDate)
    let allDay = event.isAllDay ? "true" : "false"
    let location = (event.location ?? "").replacingOccurrences(of: "|||", with: " ")
    let syntheticId = "\(event.calendar.title)-\(idx + 1)-\(start)"
    print("\(syntheticId)|||\(title)|||\(start)|||\(end)|||\(allDay)|||\(location)")
}
