export type Message = {
  id: string;
  sender: string;
  initials: string;
  address: string;
  subject: string;
  preview: string;
  time: string;
  channel: "Email" | "WhatsApp";
  priority: "High" | "Normal" | "Low";
  needsAction: boolean;
  unread: boolean;
  summary: string;
  body: string;
  draft?: string;
};

export const messages: Message[] = [
  {
    id: "roadmap",
    sender: "Alice Morgan",
    initials: "AM",
    address: "alice@example.com",
    subject: "Project update — Q4 roadmap",
    preview: "Hi, just wanted to update you on the Q4 roadmap...",
    time: "10:00 AM",
    channel: "Email",
    priority: "High",
    needsAction: true,
    unread: true,
    summary:
      "Alice shared the updated Q4 roadmap and needs confirmation on the launch timeline before Friday.",
    body: "Hi, just wanted to update you on the Q4 roadmap. We have aligned the key milestones and would love your confirmation on the proposed launch timeline before Friday. Let me know if you would like to walk through the changes together.\n\nThanks,\nAlice",
    draft:
      "Hi Alice, thanks for sharing the updated roadmap. The proposed timeline looks good from my side. Let’s walk through the final milestones together before Friday.",
  },
  {
    id: "notes",
    sender: "Bob Chen",
    initials: "BC",
    address: "bob@example.com",
    subject: "Meeting notes — Oct 3",
    preview: "Here are the notes from today’s meeting...",
    time: "9:30 AM",
    channel: "Email",
    priority: "Normal",
    needsAction: false,
    unread: false,
    summary: "Bob sent notes from the team meeting. No immediate response is required.",
    body: "Here are the notes from today’s meeting. We covered delivery milestones, the handoff process, and the upcoming review. I’ve attached the action items for everyone to reference.\n\nBest,\nBob",
  },
  {
    id: "digest",
    sender: "Tech Weekly",
    initials: "TW",
    address: "newsletter@tech.com",
    subject: "Weekly tech digest",
    preview: "This week in tech: the stories worth your time...",
    time: "8:00 AM",
    channel: "Email",
    priority: "Low",
    needsAction: false,
    unread: false,
    summary: "A weekly newsletter with industry headlines. No action needed.",
    body: "This week in tech: the stories worth your time. Explore the latest product launches, industry perspectives, and ideas shaping the week ahead.",
  },
];

export const activity = [
  {
    id: "a1",
    title: "Draft prepared for Alice Morgan",
    detail: "Waiting for your approval",
    time: "10:02",
    type: "approval",
  },
  {
    id: "a2",
    title: "Q4 roadmap marked important",
    detail: "Email · Priority detected",
    time: "10:01",
    type: "insight",
  },
  {
    id: "a3",
    title: "Inbox review completed",
    detail: "3 messages analyzed",
    time: "09:58",
    type: "complete",
  },
];
