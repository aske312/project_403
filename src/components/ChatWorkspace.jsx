import { useEffect, useMemo, useRef, useState } from "react";
import ChatPanel from "./ChatPanel";
import WorkspaceSidebar from "./WorkspaceSidebar";
import { threads as staticThreads } from "../utils/workspaceData";
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
  const fallbackMember = (chat.members || [])[0];
  return {
    id: `live-${chat.id}`,
    liveChatId: chat.id,
    space: "direct",
    type: "direct",
    name: chat.title || fallbackMember?.name || "DEV чат",
    topic: "Живой DEV-чат. Сообщения хранятся в зашифрованном виде.",
    status: "online",
    unread: 0,
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

export default function ChatWorkspace({
  profile,
  featureFlags = {},
  environment = "dev",
  integrations = {},
  theme = "light",
  lang = "RU",
  t = {},
  adminLinkVisible = false,
  adminLinkLabel = "Admin",
  onToggleLang,
  onToggleTheme,
  onLogout,
}) {
  const [activeThreadId, setActiveThreadId] = useState("general");
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState({});
  const [liveThreads, setLiveThreads] = useState([]);
  const [liveStatus, setLiveStatus] = useState("idle");
  const [typingUsers, setTypingUsers] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createChatOpen, setCreateChatOpen] = useState(false);
  const socketRef = useRef(null);

  const liveChatEnabled = String(environment || "").toLowerCase().includes("dev");
  const websocketEnabled = integrations?.realtime?.enabled !== false;

  useEffect(() => {
    if (!liveChatEnabled || !profile) return undefined;

    let ignore = false;
    let reconnectTimer = null;

    async function loadLiveChats() {
      setLiveStatus("loading");
      try {
        const { response, payload } = await getChats(getAccessToken());
        if (!ignore && response.ok) {
          const nextThreads = (payload.chats || []).map(mapLiveChatToThread);
          setLiveThreads(nextThreads);
          if (nextThreads.length > 0) {
            setActiveThreadId((current) => (
              nextThreads.some((thread) => thread.id === current) ? current : nextThreads[0].id
            ));
          }
          setLiveStatus(websocketEnabled ? "ready" : "http");
        } else if (!ignore) {
          setLiveStatus("fallback");
        }
      } catch {
        if (!ignore) setLiveStatus("fallback");
      }
    }

    function connectWebSocket() {
      const token = getAccessToken();
      if (!token || !websocketEnabled || ignore) return;

      const ws = new WebSocket(getWebSocketUrl("/api/chats/ws", token));
      socketRef.current = ws;

      ws.addEventListener("open", () => setLiveStatus("realtime"));
      ws.addEventListener("close", () => {
        if (ignore) return;
        setLiveStatus("fallback");
        reconnectTimer = window.setTimeout(connectWebSocket, 1800);
      });
      ws.addEventListener("error", () => {
        if (!ignore) setLiveStatus("fallback");
      });
      ws.addEventListener("message", (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        if (payload.type === "message" && payload.message) {
          setLiveThreads((current) => current.map((thread) => {
            if (thread.liveChatId !== payload.message.chat_id) return thread;
            const exists = thread.messages.some((message) => message.id === `live-message-${payload.message.id}`);
            if (exists) return thread;
            return {
              ...thread,
              unread: payload.message.own ? thread.unread : thread.unread + 1,
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
    }

    loadLiveChats();
    if (websocketEnabled) connectWebSocket();

    return () => {
      ignore = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socketRef.current) socketRef.current.close(1000, "workspace unmount");
      socketRef.current = null;
    };
  }, [liveChatEnabled, profile, websocketEnabled]);

  const threads = useMemo(() => {
    const directStatic = staticThreads.filter((thread) => thread.space === "direct");
    return liveThreads.length > 0 ? [...liveThreads, ...directStatic] : directStatic;
  }, [liveThreads]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0] || staticThreads[0];
  const currentMessages = [...(activeThread.messages || []), ...(localMessages[activeThread.id] || [])];

  const handleThreadChange = (threadId) => {
    setActiveThreadId(threadId);
    setLiveThreads((current) => current.map((thread) => (
      thread.id === threadId ? { ...thread, unread: 0 } : thread
    )));
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
            author: profile?.name || "You",
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
          if (response.ok) setLocalMessages((current) => ({ ...current, [activeThread.id]: [] }));
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
          author: profile?.name || "You",
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
      <WorkspaceSidebar
        profile={profile}
        threads={threads}
        activeThreadId={activeThread.id}
        liveStatus={liveStatus}
        onThreadChange={handleThreadChange}
        onOpenSettings={() => setSettingsOpen(true)}
        onCreateChat={() => setCreateChatOpen(true)}
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

      {settingsOpen && (
        <div className="workspace-modal-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className="workspace-modal" role="dialog" aria-modal="true" aria-label="Настройки" onMouseDown={(event) => event.stopPropagation()}>
            <button className="details-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="Закрыть настройки">×</button>
            <p className="workspace-kicker">Настройки</p>
            <h2>Внешний вид и профиль</h2>
            <div className="settings-grid settings-grid-actions">
              <button type="button" onClick={onToggleTheme}>
                <span>Тема</span>
                <strong>{theme === "light" ? "Светлая" : "Тёмная"}</strong>
              </button>
              <button type="button" onClick={onToggleLang}>
                <span>Язык</span>
                <strong>{lang}</strong>
              </button>
              {adminLinkVisible && <a href="/admin"><span>Панель</span><strong>{adminLinkLabel}</strong></a>}
              {onLogout && <button type="button" onClick={onLogout}><span>Сессия</span><strong>{t.logout || "Выйти"}</strong></button>}
            </div>
            <div className="settings-grid">
              <div><span>Realtime</span><strong>{liveStatus === "realtime" ? "WebSocket" : "HTTP fallback"}</strong></div>
              <div><span>Сообщения</span><strong>Encrypted at rest</strong></div>
              <div><span>Окружение</span><strong>{environment}</strong></div>
            </div>
          </section>
        </div>
      )}

      {createChatOpen && (
        <div className="workspace-modal-backdrop" role="presentation" onMouseDown={() => setCreateChatOpen(false)}>
          <section className="workspace-modal" role="dialog" aria-modal="true" aria-label="Новый чат" onMouseDown={(event) => event.stopPropagation()}>
            <button className="details-close" type="button" onClick={() => setCreateChatOpen(false)} aria-label="Закрыть создание чата">×</button>
            <p className="workspace-kicker">Новый чат</p>
            <h2>Создание диалога</h2>
            <p className="workspace-modal-copy">На DEV-этапе активен direct-чат между пользователями проекта. Следующим шагом можно добавить поиск пользователя и создание приватных комнат.</p>
          </section>
        </div>
      )}
    </section>
  );
}
