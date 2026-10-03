import { mockEmailMessages, mockThreads } from "@/lib/mock-data";

export default function MailInboxPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Inbox</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Architecture validation slice — mock data. Not a real email implementation.
      </p>
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">From</th>
              <th className="px-4 py-3 text-left font-medium">Subject</th>
              <th className="px-4 py-3 text-left font-medium">Received</th>
              <th className="px-4 py-3 text-left font-medium">Importance</th>
              <th className="px-4 py-3 text-left font-medium">Action Required</th>
            </tr>
          </thead>
          <tbody>
            {mockEmailMessages.map((msg) => (
              <tr key={msg.id} className="border-b hover:bg-muted/30">
                <td className="px-4 py-3">{msg.from_address}</td>
                <td className="px-4 py-3">{msg.subject}</td>
                <td className="px-4 py-3 text-muted-foreground">{msg.received_at}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      msg.importance_score >= 0.7
                        ? "rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                        : msg.importance_score >= 0.4
                          ? "rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
                          : "rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800"
                    }
                  >
                    {(msg.importance_score * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  {msg.action_required ? (
                    <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                      Yes
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Threads ({mockThreads.length})</h2>
        <div className="space-y-2">
          {mockThreads.map((thread) => (
            <div key={thread.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{thread.subject}</span>
                <span className="text-xs text-muted-foreground">{thread.message_count} messages</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{thread.snippet}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
