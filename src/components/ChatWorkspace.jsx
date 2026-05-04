import { useEffect, useMemo, useRef, useState } from "react";
import ChatPanel from "./ChatPanel";
import WorkspaceDetails from "./WorkspaceDetails";
import WorkspaceRail from "./WorkspaceRail";
import WorkspaceSidebar from "./WorkspaceSidebar";
import { spaces, threads as staticThreads } from "../utils/workspaceData";
import { getAccessToken } from "../utils/useAuthSession";
import { encodeWireBody, getChats, getWebSocketUrl, sendChatMessage } from "../utils/apiClient";

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
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef(null);

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

    const token = getAccessToken();
    if (!token) return () => { ignore = true; };

    const ws = new WebSocket(getWebSocketUrl("/api/chats/ws", token));
    socketRef.current = ws;

    ws.addEventListener("open", () => setLiveStatus("realtime"));
    ws.addEventListener("close", () => setLiveStatus("fallback"));
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "message" && payload.message) {
        setLiveThreads((current) => current.map((thread) => {
          if (thread.liveChatId !== payload.message.chat_id) return thread;
          const exists = thread.messages.some((message) => message.id === `live-message-${payload.message.id}`);
          if (exists) return thread;
          return {
            ...thread,
            badge: thread.badge + 1,
            messages: [
              ...thread.messages,
              {
                id: `live-message-${payload.message.id}`,
                author: payload.message.sender?.name || payload.message.sender?.handle || "User",
                own: Boolean(payload.message.own),
                role: payload.message.sender?.role || "user",
                time: formatMessageTime(payload.message.created_at),
                text: payload.message.body,
              },
            ],
          };
        }));
        setTypingUsers((current) => ({ ...current, [payload.message.chat_id]: null }));
      }

      if (payload.type === "typing") {
        setTypingUsers((current) => ({
          ...current,
          [payload.chat_id]: payload.typing ? payload.user?.name : null,
        }));
      }
    });

    return () => {
      ignore = true;
      ws.close();
      socketRef.current = null;
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

  const emitTyping = (typing) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !activeThread?.liveChatId) return;
    socket.send(JSON.stringify({ type: "typing", chat_id: activeThread.liveChatId, typing }));
  };

  const handleDraftChange = (value) => {
    setDraft(value);
    emitTyping(Boolean(value.trim()));
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
        const activeSocket = socketRef.current;
        if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
          activeSocket.send(JSON.stringify({
            type: "message",
            chat_id: activeThread.liveChatId,
            encoded_body: encodeWireBody(text),
          }));
          emitTyping(false);
          setLocalMessages((current) => ({ ...current, [activeThread.id]: [] }));
        } else {
          const { response } = await sendChatMessage(activeThread.liveChatId, text, getAccessToken());
          if (response.ok) {
            setLocalMessages((current) => ({ ...current, [activeThread.id]: [] }));
          }
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
        onDraftChange={handleDraftChange}
        typingUser={activeThread?.liveChatId ? typingUsers[activeThread.liveChatId] : null}
        onSend={handleSend}
      />
      {featureFlags.workspace_details_panel && <WorkspaceDetails thread={activeThread} />}
    </section>
  );
}
