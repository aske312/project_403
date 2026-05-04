import { useEffect, useMemo, useState } from "react";
import ChatPanel from "./ChatPanel";
import WorkspaceDetails from "./WorkspaceDetails";
import WorkspaceRail from "./WorkspaceRail";
import WorkspaceSidebar from "./WorkspaceSidebar";
import { spaces, threads as staticThreads } from "../utils/workspaceData";
import { getAccessToken } from "../utils/useAuthSession";
import { getChats, sendChatMessage } from "../utils/apiClient";

function formatMessageTime(value) {
  if (!value) return "сейчас";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function mapLiveChatToThread(chat) {
  const otherMembers = (chat.members || []).filter((member) => !chat.messages?.some((message) => message.own && message.sender.id === member.id));
  const fallbackMember = otherMembers[0] || chat.members?.[0];
  return {
    id: `live-${chat.id}`,
    liveChatId: chat.id,
    space: "direct",
    type: "direct",
    name: chat.title || fallbackMember?.name || "DEV чат",
    topic: "Живой DEV-чат через backend + SQLite/PostgreSQL",
    status: "online",
    badge: chat.messages?.length || 0,
    members: chat.members?.map((member) => member.name) || [],
    messages: (chat.messages || []).map((message) => ({
      id: `live-message-${message.id}`,
      author: message.sender?.name || message.sender?.handle || "User",
      own: Boolean(message.own),
      role: message.sender?.role || "user",
      time: formatMessageTime(message.created_at),
      text: message.body,
    })),
  };
}

export default function ChatWorkspace({ profile, projectName, featureFlags = {}, environment = "dev" }) {
  const [space, setSpace] = useState("team");
  const [activeThreadId, setActiveThreadId] = useState("general");
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState({});
  const [liveThreads, setLiveThreads] = useState([]);
  const [liveStatus, setLiveStatus] = useState("idle");

  const liveChatEnabled = String(environment || "").toLowerCase().includes("dev");

  useEffect(() => {
    if (!liveChatEnabled || !profile) return undefined;

    let ignore = false;
    async function loadLiveChats() {
      setLiveStatus("loading");
      try {
        const { response, payload } = await getChats(getAccessToken());
        if (!ignore && response.ok) {
          const nextThreads = (payload.chats || []).map(mapLiveChatToThread);
          setLiveThreads(nextThreads);
          if (nextThreads.length > 0) {
            setSpace("direct");
            setActiveThreadId((current) => (
              nextThreads.some((thread) => thread.id === current) ? current : nextThreads[0].id
            ));
          }
          setLiveStatus("ready");
        } else if (!ignore) {
          setLiveStatus("fallback");
        }
      } catch {
        if (!ignore) setLiveStatus("fallback");
      }
    }

    loadLiveChats();
    const intervalId = window.setInterval(loadLiveChats, 5000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [liveChatEnabled, profile]);

  const threads = useMemo(() => (
    liveThreads.length > 0 ? [...liveThreads, ...staticThreads] : staticThreads
  ), [liveThreads]);

  const enabledSpaces = spaces.filter((item) => {
    if (item.id === "direct") return Boolean(featureFlags.workspace_direct_messages);
    if (item.id === "team") return Boolean(featureFlags.workspace_team_channels);
    if (item.id === "voice") return Boolean(featureFlags.workspace_voice_rooms);
    return true;
  });
  const safeSpace = enabledSpaces.some((item) => item.id === space) ? space : enabledSpaces[0]?.id || "team";
  const visibleThreads = threads.filter((thread) => thread.space === safeSpace);
  const activeThread = visibleThreads.find((thread) => thread.id === activeThreadId) || visibleThreads[0] || threads[0];
  const currentMessages = [...(activeThread.messages || []), ...(localMessages[activeThread.id] || [])];

  const handleSpaceChange = (nextSpace) => {
    setSpace(nextSpace);
    const firstThread = threads.find((thread) => thread.space === nextSpace);
    if (firstThread) setActiveThreadId(firstThread.id);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setDraft("");

    if (activeThread.liveChatId) {
      const optimisticId = `${activeThread.id}-${Date.now()}`;
      setLocalMessages((current) => ({
        ...current,
        [activeThread.id]: [
          ...(current[activeThread.id] || []),
          {
            id: optimisticId,
            author: "You",
            own: true,
            role: profile?.role || "user",
            time: "сейчас",
            text,
          },
        ],
      }));

      try {
        const { response } = await sendChatMessage(activeThread.liveChatId, text, getAccessToken());
        if (response.ok) {
          setLocalMessages((current) => ({ ...current, [activeThread.id]: [] }));
          const { payload } = await getChats(getAccessToken());
          setLiveThreads((payload.chats || []).map(mapLiveChatToThread));
        }
      } catch {
        setLiveStatus("fallback");
      }
      return;
    }

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
        liveStatus={liveStatus}
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
