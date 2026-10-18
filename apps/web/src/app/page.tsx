import ChatPage from "./chat/page";

// Segment configuration must be defined locally for Next.js static analysis.
export const dynamic = "force-dynamic";

// Chat is the primary authenticated workspace. /chat remains a compatible
// deep link; the previous dashboard has its own /overview route.
export default ChatPage;
