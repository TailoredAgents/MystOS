import React from "react";
import { TeamChatClient } from "./TeamChatClient";

export async function ChatSection(): Promise<React.ReactElement> {
  return (
    <section className="space-y-6">
      <TeamChatClient />
    </section>
  );
}

