import { useEffect, useMemo, useRef, useState } from "react";
import ChatPanel from "./ChatPanel";
import WorkspaceDetails from "./WorkspaceDetails";
import WorkspaceRail from "./WorkspaceRail";
import WorkspaceSidebar from "./WorkspaceSidebar";
import { spaces, threads as staticThreads } from "../utils/workspaceData";
import { getAccessToken } from "../utils/useAuthSession";
import {
  deleteChatMessage,
  editChatMessage,
  encodeWireBody,
  getChats,
  getContacts,
  getWebSocketUrl,
  markChatRead,
  pinChat,
  renameChat,
  sendChatMessage,
} from "../utils/apiClient";

function formatMessageTime(value) {
  if (!value) return "сейчас";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function mapMessage(message) {
  return {
    id: `live-message-${message.id}`,
    rawId: message.id,
    author: message.sender?.name || message.sender?.handle || "User",
    own: Boolean(message.own),
    role: message.sender?.role || "user",
    time: formatMessageTime(message.created_at),
    text: message.body,
    status: message.status || "sent",
    edited: Boolean(message.edited_at),
  };
}

function getPeer(chat) {
  const members = chat.members || [];
  return members.find((member) => !chat.messages?.some((message) => message.own && message.sender.id === member.id)) || members[0];
}

function getLastMessage(chat) {
  const last = [...(chat.messages || [])].pop();
  if (!last) return "Начните переписку";
  return last.body || "Сообщение";
}

function mapLiveChatToThread(chat) {
  const fallbackMember = getPeer(chat);
  const title = chat.title || fallbackMember?.name || "DEV чат";
  return {
    id: `live-${chat.id}`,
    liveChatId: chat.id,
    space: "direct",
    type: "direct",
    name: title,
    topic: "Живой DEV-чат через backend + SQLite/PostgreSQL",
    status: "online",
    isPinned: Boolean(chat.is_pinned),
    pinOrder: chat.pin_order || 100,
    unread: 0,
    members: chat.members?.map((member) => member.name) || [],
    memberItems: chat.members || [],
    lastMessage: getLastMessage(chat),
    lastAt: chat.messages?.length ? formatMessageTime(chat.messages[chat.messages.length - 1].created_at) : "",
    messages: (chat.messages || []).map(mapMessage),
  };
}

function upsertMessage(threads, payloadMessage) {
  return threads.map((thread) => {
    if (thread.liveChatId !== payloadMessage.chat_id) return thread;
    const nextMessage = mapMessage(payloadMessage);
    const exists = thread.messages.some((message) => message.rawId === payloadMessage.id);
    return {
      ...thread,
      messages: exists
        ? thread.messages.map((message) => (message.rawId === payloadMessage.id ? nextMessage : message))
        : [...thread.messages, nextMessage],
    };
  });
}

function removeMessageForSelf(threads, payloadMessage) {
  return threads.map((thread) => {
    if (thread.liveChatId !== payloadMessage.chat_id) return thread;
    return { ...thread, messages: thread.messages.filter((message) => message.rawId !== payloadMessage.id) };
  });
}

export default function ChatWorkspace({ profile, projectName, featureFlags = {}, environment = "dev", integrations = {} }) {
  const [space, setSpace] = useState("direct");
  const [activeThreadId, setActiveThreadId] = useState("general");
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState({});
  const [liveThreads, setLiveThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactsQuery, setContactsQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const socketRef = useRef(null);

  const liveChatEnabled = String(environment || "").toLowerCase().includes("dev");
  const websocketEnabled = integrations?.realtime?.enabled !== false;

  useEffect(() => {
    if (!liveChatEnabled || !profile) return undefined;
    let ignore = false;
    async function loadLiveChats() {
      try {
        const { response, payload } = await getChats(getAccessToken());
        if (!ignore && response.ok) {
          const nextThreads = (payload.chats || []).map(mapLiveChatToThread);
          setLiveThreads(nextThreads);
          if (nextThreads.length > 0) {
            setSpace("direct");
            setActiveThreadId((current) => (nextThreads.some((thread) => thread.id === current) ? current : nextThreads[0].id));
          }
        }
      } catch {
        // HTTP fallback remains available for sending messages.
      }
    }
    loadLiveChats();
    return () => { ignore = true; };
  }, [liveChatEnabled, profile]);

  useEffect(() => {
    if (!liveChatEnabled || !profile) return undefined;
    let ignore = false;
    const timer = window.setTimeout(async () => {
      try {
        const { response, payload } = await getContacts(getAccessToken(), contactsQuery);
        if (!ignore && response.ok) setContacts(payload.contacts || []);
      } catch {
        if (!ignore) setContacts([]);
      }
    }, 180);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [contactsQuery, liveChatEnabled, profile]);

  useEffect(() => {
    if (!liveChatEnabled || !profile || !websocketEnabled) return undefined;
    const token = getAccessToken();
    if (!token) return undefined;
    const ws = new WebSocket(getWebSocketUrl("/api/chats/ws", token));
    socketRef.current = ws;
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (["message", "message_edited", "message_read", "message_deleted_all"].includes(payload.type) && payload.message) {
        setLiveThreads((current) => upsertMessage(current, payload.message));
        setTypingUsers((current) => ({ ...current, [payload.message.chat_id]: null }));
      }
      if (payload.type === "message_deleted_self" && payload.message) {
        setLiveThreads((current) => removeMessageForSelf(current, payload.message));
      }
      if (payload.type === "typing") {
        setTypingUsers((current) => ({ ...current, [payload.chat_id]: payload.typing ? payload.user?.name : null }));
      }
    });
    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [liveChatEnabled, profile, websocketEnabled]);

  const threads = useMemo(() => (liveThreads.length > 0 ? [...liveThreads, ...staticThreads] : staticThreads), [liveThreads]);
  const enabledSpaces = spaces.filter((item) => {
    if (item.id === "direct") return Boolean(featureFlags.workspace_direct_messages);
    if (item.id === "team") return Boolean(featureFlags.workspace_team_channels);
    if (item.id === "voice") return Boolean(featureFlags.workspace_voice_rooms);
    return true;
  });
  const safeSpace = enabledSpaces.some((item) => item.id === space) ? space : enabledSpaces[0]?.id || "direct";
  const visibleThreads = threads.filter((thread) => thread.space === safeSpace);
  const activeThread = visibleThreads.find((thread) => thread.id === activeThreadId) || visibleThreads[0] || threads[0];
  const currentMessages = [...(activeThread.messages || []), ...(localMessages[activeThread.id] || [])];

  useEffect(() => {
    if (!activeThread?.liveChatId) return;
    markChatRead(activeThread.liveChatId, getAccessToken()).catch(() => undefined);
  }, [activeThread?.liveChatId]);

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
        [activeThread.id]: [...(current[activeThread.id] || []), { id: optimisticId, author: "You", own: true, role: profile?.role || "user", time: "сейчас", text, status: "sent" }],
      }));
      try {
        const activeSocket = socketRef.current;
        if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
          activeSocket.send(JSON.stringify({ type: "message", chat_id: activeThread.liveChatId, encoded_body: encodeWireBody(text) }));
          emitTyping(false);
        } else {
          await sendChatMessage(activeThread.liveChatId, text, getAccessToken());
        }
        setLocalMessages((current) => ({ ...current, [activeThread.id]: [] }));
      } catch {
        // Keep optimistic message visible.
      }
      return;
    }
    setLocalMessages((current) => ({
      ...current,
      [activeThread.id]: [...(current[activeThread.id] || []), { id: `${activeThread.id}-${Date.now()}`, author: "You", own: true, role: profile?.role || "user", time: "сейчас", text, status: "sent" }],
    }));
  };

  const handlePinThread = async (thread) => {
    const nextPinned = !thread.isPinned;
    setLiveThreads((current) => current.map((item) => (item.id === thread.id ? { ...item, isPinned: nextPinned, pinOrder: nextPinned ? 1 : 100 } : item)));
    if (thread.liveChatId) await pinChat(thread.liveChatId, nextPinned, nextPinned ? 1 : 100, getAccessToken()).catch(() => undefined);
  };

  const handleMovePinned = async (thread, direction) => {
    const pinned = liveThreads.filter((item) => item.isPinned).sort((a, b) => (a.pinOrder || 0) - (b.pinOrder || 0));
    const index = pinned.findIndex((item) => item.id === thread.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= pinned.length) return;
    const reordered = [...pinned];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const orderMap = new Map(reordered.map((item, itemIndex) => [item.id, itemIndex + 1]));
    setLiveThreads((current) => current.map((item) => (orderMap.has(item.id) ? { ...item, pinOrder: orderMap.get(item.id) } : item)));
    await Promise.all(reordered.map((item, itemIndex) => item.liveChatId ? pinChat(item.liveChatId, true, itemIndex + 1, getAccessToken()).catch(() => undefined) : undefined));
  };

  const handleHeaderClick = () => {
    setTitleDraft(activeThread.name);
    setDetailsOpen(true);
  };

  const handleSaveTitle = async () => {
    const value = titleDraft.trim();
    if (!value || !activeThread.liveChatId) return;
    setLiveThreads((current) => current.map((item) => (item.id === activeThread.id ? { ...item, name: value } : item)));
    await renameChat(activeThread.liveChatId, value, getAccessToken()).catch(() => undefined);
  };

  const handleEditMessage = async (messageId, text) => {
    const rawId = String(messageId).replace("live-message-", "");
    setLiveThreads((current) => current.map((thread) => ({
      ...thread,
      messages: thread.messages.map((message) => (message.id === messageId ? { ...message, text, edited: true } : message)),
    })));
    await editChatMessage(rawId, text, getAccessToken()).catch(() => undefined);
  };

  const handleDeleteMessage = async (messageId, scope) => {
    const rawId = String(messageId).replace("live-message-", "");
    if (scope === "self") {
      setLiveThreads((current) => current.map((thread) => ({ ...thread, messages: thread.messages.filter((message) => message.id !== messageId) })));
    } else {
      setLiveThreads((current) => current.map((thread) => ({
        ...thread,
        messages: thread.messages.map((message) => (message.id === messageId ? { ...message, text: "Сообщение удалено" } : message)),
      })));
    }
    await deleteChatMessage(rawId, scope, getAccessToken()).catch(() => undefined);
  };

  return (
    <section className={detailsOpen ? "chat-workspace details-open" : "chat-workspace"} aria-label="Messenger workspace">
      <WorkspaceRail projectName={projectName} spaces={enabledSpaces} activeSpace={safeSpace} onSpaceChange={handleSpaceChange} onOpenSettings={() => setSettingsOpen(true)} />
      <WorkspaceSidebar
        profile={profile}
        threads={visibleThreads}
        contacts={contacts}
        contactsQuery={contactsQuery}
        activeThreadId={activeThread.id}
        collapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed((value) => !value)}
        onContactsQueryChange={setContactsQuery}
        onThreadChange={setActiveThreadId}
        onOpenSettings={() => setSettingsOpen(true)}
        onPinThread={handlePinThread}
        onMovePinned={handleMovePinned}
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
        onHeaderClick={handleHeaderClick}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
      />
      <WorkspaceDetails
        thread={activeThread}
        open={detailsOpen}
        titleDraft={titleDraft}
        onTitleDraftChange={setTitleDraft}
        onSaveTitle={handleSaveTitle}
        onClose={() => setDetailsOpen(false)}
      />
      {settingsOpen && (
        <div className="workspace-modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <section className="workspace-settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="details-headline">
              <div>
                <p className="workspace-kicker">Настройки</p>
                <h2>Оформление</h2>
              </div>
              <button className="workspace-icon-button" type="button" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            <div className="settings-grid">
              <button type="button" onClick={() => document.documentElement.dataset.theme = "light"}>Светлая тема</button>
              <button type="button" onClick={() => document.documentElement.dataset.theme = "dark"}>Тёмная тема</button>
              <button type="button">Русский</button>
              <button type="button">English</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
