import { useState } from "react";
import ChatPanel from "./ChatPanel";
import WorkspaceDetails from "./WorkspaceDetails";
import WorkspaceRail from "./WorkspaceRail";
import WorkspaceSidebar from "./WorkspaceSidebar";
import { spaces, threads } from "../utils/workspaceData";

export default function ChatWorkspace({ profile, projectName, featureFlags = {} }) {
  const [space, setSpace] = useState("team");
  const [activeThreadId, setActiveThreadId] = useState("general");
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState({});

  const enabledSpaces = spaces.filter((item) => {
    if (item.id === "direct") return Boolean(featureFlags.workspace_direct_messages);
    if (item.id === "team") return Boolean(featureFlags.workspace_team_channels);
    if (item.id === "voice") return Boolean(featureFlags.workspace_voice_rooms);
    return true;
  });
  const safeSpace = enabledSpaces.some((item) => item.id === space) ? space : enabledSpaces[0]?.id || "team";
  const visibleThreads = threads.filter((thread) => thread.space === safeSpace);
  const activeThread = visibleThreads.find((thread) => thread.id === activeThreadId) || visibleThreads[0] || threads[0];
  const currentMessages = [...activeThread.messages, ...(localMessages[activeThread.id] || [])];

  const handleSpaceChange = (nextSpace) => {
    setSpace(nextSpace);
    const firstThread = threads.find((thread) => thread.space === nextSpace);
    if (firstThread) setActiveThreadId(firstThread.id);
  };

  const handleSend = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setLocalMessages((current) => ({
      ...current,
      [activeThread.id]: [
        ...(current[activeThread.id] || []),
        {
          id: `${activeThread.id}-${Date.now()}`,
          author: "You",
          own: true,
          role: profile?.role || "user",
          time: "сейчас",
          text,
        },
      ],
    }));
    setDraft("");
  };

  return (
    <section className="chat-workspace" aria-label="Messenger workspace">
      <WorkspaceRail
        projectName={projectName}
        spaces={enabledSpaces}
        activeSpace={safeSpace}
        onSpaceChange={handleSpaceChange}
      />
      <WorkspaceSidebar
        projectName={projectName}
        threads={visibleThreads}
        activeThreadId={activeThread.id}
        quickActionsEnabled={Boolean(featureFlags.workspace_quick_actions)}
        onThreadChange={setActiveThreadId}
      />
      <ChatPanel
        activeThread={activeThread}
        messages={currentMessages}
        profile={profile}
        composerEnabled={Boolean(featureFlags.workspace_local_composer)}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
      />
      {featureFlags.workspace_details_panel && <WorkspaceDetails thread={activeThread} />}
    </section>
  );
}
