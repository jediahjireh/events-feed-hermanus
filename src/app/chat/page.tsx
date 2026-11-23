"use client";

import AskAPIChat from "@/components/admin/ask-api-chat";

export default function ChatPage() {
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 flex flex-col">
      <AskAPIChat />
    </div>
  );
}
