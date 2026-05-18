import { useEffect, useMemo, useRef, useState } from "react";
import { spaces, threads as staticThreads } from "../utils/workspaceData";
import { getInitials, getProfileName } from "../utils/workspaceUtils";
import { getAccessToken } from "../utils/useAuthSession";
import {
  createChat,
  deleteChat,
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

const CHAT_TYPES = [
  { id: "direct", label: "Диалог", icon: "DM" },
  { id: "group", label: "Группа", icon: "GR" },
  { id: "channel", label: "Канал", icon: "CH" },
];

function formatMessageTime(value) {
  if (!value) return "сейчас";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getOwnIds(profile) {
  return [profile?.id, profile?.user_id].filter(Boolean).map(String);
}

function getPeer(chat, profile) {
  const ownIds = getOwnIds(profile);
  return (chat.members || []).find((member) => !ownIds.includes(String(member.id))) || null;
}

function mapMessage(message) {
  return {
    id: `message-${message.id}`,
    rawId: message.id,
    chatId: message.chat_id,
    author: message.sender?.name || message.sender?.handle || "User",
    own: Boolean(message.own),
    role: message.sender?.role || "user",
    text: message.body,
    time: formatMessageTime(message.created_at),
    status: message.status || "sent",
    edited: Boolean(message.edited_at),
  };
}

function getTypeTitle(type) {
  if (type === "group") return "Группа";
  if (type === "channel") return "Канал";
  if (type === "self") return "Заметки";
  return "Диалог";
}

function getEmptyPreview(type) {
  if (type === "group") return "В группе пока нет сообщений";
  if (type === "channel") return "В канале пока нет публикаций";
  if (type === "self") return "Личные заметки";
  return "Начните переписку";
}

function deriveThreadPreview(thread, messages) {
  const last = messages[messages.length - 1];
  return {
    ...thread,
    messages,
    lastMessage: last?.text || getEmptyPreview(thread.type),
    lastAt: last?.time || "",
  };
}

function mapChat(chat, profile) {
  const peer = getPeer(chat, profile);
  const type = chat.type || "direct";
  const messages = (chat.messages || []).map(mapMessage);
  const baseThread = {
    id: `chat-${chat.id}`,
    liveChatId: chat.id,
    publicId: chat.public_id,
    type,
    name: chat.title || peer?.name || (type === "group" ? "Новая группа" : type === "channel" ? "Новый канал" : "Диалог"),
    status: peer?.is_online ? "online" : "offline",
    isPinned: Boolean(chat.is_pinned),
    pinOrder: chat.pin_order || 100,
    members: chat.members?.length || 1,
    memberItems: chat.members || [],
    topic: type === "channel" ? "Канал для объявлений." : type === "group" ? "Групповой чат." : "Личный диалог.",
    unread: 0,
  };
  return deriveThreadPreview(baseThread, messages);
}

function sortThreads(threads) {
  return [...threads].sort((a, b) => {
    if (a.id === "notes") return -1;
    if (b.id === "notes") return 1;
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isPinned && b.isPinned) return (a.pinOrder || 0) - (b.pinOrder || 0);
    return String(a.name).localeCompare(String(b.name), "ru");
  });
}

function upsertMessage(threads, payloadMessage) {
  return threads.map((thread) => {
    if (thread.liveChatId !== payloadMessage.chat_id) return thread;
    const next = mapMessage(payloadMessage);
    const exists = thread.messages.some((message) => message.rawId === payloadMessage.id);
    const messages = exists
      ? thread.messages.map((message) => (message.rawId === payloadMessage.id ? next : message))
      : [...thread.messages, next];
    return deriveThreadPreview(thread, messages);
  });
}

function removeMessage(threads, payloadMessage) {
  return threads.map((thread) => {
    if (thread.liveChatId !== payloadMessage.chat_id) return thread;
    return deriveThreadPreview(thread, thread.messages.filter((message) => message.rawId !== payloadMessage.id));
  });
}

function applyPresence(threads, payload, profile) {
  const ownIds = getOwnIds(profile);
  return threads.map((thread) => {
    const memberItems = (thread.memberItems || []).map((member) => (
      String(member.id) === String(payload.user_id) ? { ...member, is_online: Boolean(payload.is_online) } : member
    ));
    const peer = memberItems.find((member) => !ownIds.includes(String(member.id)));
    return { ...thread, memberItems, status: peer?.is_online ? "online" : "offline" };
  });
}

function EmptySection({ activeSpace }) {
  const item = spaces.find((space) => space.id === activeSpace);
  return (
    <main className="messenger-zero-empty-section">
      <span>{item?.icon}</span>
      <strong>{item?.title}</strong>
      <p>Раздел отделен от чатов и не сбрасывает состояние мессенджера.</p>
    </main>
  );
}

function ThreadAvatar({ thread }) {
  return (
    <span className={["mz-avatar", thread.type === "self" ? "notes" : "", thread.status === "online" ? "online" : ""].filter(Boolean).join(" ")}>
      {getInitials(thread.name)}
    </span>
  );
}

function MessageMenu({ message, onEdit, onDeleteSelf, onDeleteAll }) {
  return (
    <div className="mz-menu" onPointerDown={(event) => event.stopPropagation()}>
      {message.own && <button type="button" onClick={onEdit}>Редактировать</button>}
      <button type="button" onClick={onDeleteSelf}>Удалить у себя</button>
      {message.own && <button type="button" className="danger" onClick={onDeleteAll}>Удалить у всех</button>}
    </div>
  );
}

function NewChatDialog({ contacts, onClose, onCreate }) {
  const [type, setType] = useState("direct");
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const toggleContact = (id) => {
    setSelectedIds((current) => {
      const exists = current.includes(id);
      if (type === "direct") return exists ? [] : [id];
      return exists ? current.filter((item) => item !== id) : [...current, id];
    });
  };

  const submit = (event) => {
    event.preventDefault();
    onCreate({ type, title: title.trim() || null, member_ids: selectedIds });
    onClose();
  };

  return (
    <div className="mz-backdrop" onClick={onClose}>
      <form className="mz-dialog" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Новый чат</span>
            <strong>{CHAT_TYPES.find((item) => item.id === type)?.label}</strong>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="mz-type-tabs">
          {CHAT_TYPES.map((item) => (
            <button key={item.id} className={type === item.id ? "active" : ""} type="button" onClick={() => { setType(item.id); setSelectedIds([]); }}>
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        {type !== "direct" && (
          <input className="mz-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === "group" ? "Название группы" : "Название канала"} />
        )}
        <div className="mz-contact-picker">
          {contacts.length > 0 ? contacts.map((contact) => (
            <button key={contact.id} type="button" className={selectedIds.includes(contact.id) ? "active" : ""} onClick={() => toggleContact(contact.id)}>
              <span className={["mz-avatar", contact.is_online ? "online" : ""].filter(Boolean).join(" ")}>{getInitials(contact.name)}</span>
              <span>
                <strong>{contact.name}</strong>
                <small>{contact.tag}</small>
              </span>
            </button>
          )) : <p>Контактов пока нет.</p>}
        </div>
        <button className="mz-primary" type="submit" disabled={type === "direct" && selectedIds.length !== 1}>Создать</button>
      </form>
    </div>
  );
}

export default function ChatWorkspace({
  profile,
  projectName = "Project 403",
  featureFlags = {},
  environment = "dev",
  integrations = {},
  theme = "light",
  lang = "RU",
  onToggleTheme,
  onToggleLang,
  onLogout,
}) {
  const [activeSpace, setActiveSpace] = useState("direct");
  const [activeThreadId, setActiveThreadId] = useState("notes");
  const [liveThreads, setLiveThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [threadMenu, setThreadMenu] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");
  const profileRef = useRef(null);
  const socketRef = useRef(null);
  const feedRef = useRef(null);

  const liveChatEnabled = String(environment || "").toLowerCase().includes("dev");
  const websocketEnabled = integrations?.realtime?.enabled !== false;
  const token = getAccessToken();

  const localThreads = useMemo(() => staticThreads, []);
  const allThreads = useMemo(() => sortThreads([...localThreads, ...liveThreads]), [liveThreads, localThreads]);
  const filteredThreads = useMemo(() => allThreads.filter((thread) => (
    `${thread.name} ${thread.lastMessage} ${thread.publicId || ""}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [allThreads, query]);
  const activeThread = allThreads.find((thread) => thread.id === activeThreadId) || allThreads[0];
  const activeMessages = activeThread ? [...(activeThread.messages || []), ...(localMessages[activeThread.id] || [])] : [];
  const typingUser = activeThread?.liveChatId ? typingUsers[activeThread.liveChatId] : null;
  const profileName = getProfileName(profile);
  const ownIds = getOwnIds(profile);
  const safeContacts = contacts.filter((contact) => !ownIds.includes(String(contact.id)));

  useEffect(() => {
    if (!liveChatEnabled || !profile) return undefined;
    let ignore = false;
    async function loadChats() {
      try {
        const { response, payload } = await getChats(token);
        if (!ignore && response.ok) {
          const threads = (payload.chats || []).map((chat) => mapChat(chat, payload.user || profile));
          setLiveThreads(threads);
          setActiveThreadId((current) => threads.some((thread) => thread.id === current) || current === "notes" ? current : threads[0]?.id || "notes");
        }
      } catch {
        if (!ignore) setLiveThreads([]);
      }
    }
    loadChats();
    return () => { ignore = true; };
  }, [liveChatEnabled, profile, token]);

  useEffect(() => {
    if (!liveChatEnabled || !profile) return undefined;
    let ignore = false;
    async function loadContacts() {
      try {
        const { response, payload } = await getContacts(token, "");
        if (!ignore && response.ok) setContacts(payload.contacts || []);
      } catch {
        if (!ignore) setContacts([]);
      }
    }
    loadContacts();
    return () => { ignore = true; };
  }, [liveChatEnabled, profile, token]);

  useEffect(() => {
    if (!liveChatEnabled || !profile || !websocketEnabled || !token) return undefined;
    const ws = new WebSocket(getWebSocketUrl("/api/chats/ws", token));
    socketRef.current = ws;
    ws.addEventListener("message", (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (["message", "message_edited", "message_read"].includes(payload.type) && payload.message) {
        setLiveThreads((current) => upsertMessage(current, payload.message));
        setLocalMessages((current) => ({ ...current, [`chat-${payload.message.chat_id}`]: [] }));
        setTypingUsers((current) => ({ ...current, [payload.message.chat_id]: null }));
      }
      if (["message_deleted_self", "message_deleted_all"].includes(payload.type) && payload.message) {
        setLiveThreads((current) => removeMessage(current, payload.message));
      }
      if (payload.type === "presence") {
        setLiveThreads((current) => applyPresence(current, payload, profile));
      }
      if (payload.type === "typing") {
        setTypingUsers((current) => ({ ...current, [payload.chat_id]: payload.typing ? payload.user?.name : null }));
      }
      if (payload.type === "chat_created" && payload.chat) {
        const nextThread = mapChat(payload.chat, profile);
        setLiveThreads((current) => current.some((thread) => thread.liveChatId === nextThread.liveChatId)
          ? current.map((thread) => (thread.liveChatId === nextThread.liveChatId ? nextThread : thread))
          : [nextThread, ...current]);
      }
      if (payload.type === "chat_deleted") {
        setLiveThreads((current) => current.filter((thread) => thread.liveChatId !== payload.chat_id));
      }
    });
    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [liveChatEnabled, profile, token, websocketEnabled]);

  useEffect(() => {
    if (!feedRef.current) return;
    feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [activeThreadId, activeMessages.length]);

  useEffect(() => {
    if (!activeThread?.liveChatId) return;
    markChatRead(activeThread.liveChatId, token).catch(() => undefined);
  }, [activeThread?.liveChatId, token]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const onPointerDown = (event) => {
      if (profileRef.current?.contains(event.target)) return;
      setProfileOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [profileOpen]);

  useEffect(() => {
    if (!threadMenu && !messageMenuId) return undefined;
    const closeMenus = () => {
      setThreadMenu(null);
      setMessageMenuId(null);
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, [threadMenu, messageMenuId]);

  const emitTyping = (typing) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeThread?.liveChatId) return;
    ws.send(JSON.stringify({ type: "typing", chat_id: activeThread.liveChatId, typing }));
  };

  const updateDraft = (value) => {
    setDraft(value);
    emitTyping(Boolean(value.trim()));
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeThread) return;
    setDraft("");

    const optimistic = {
      id: `local-${Date.now()}`,
      author: "You",
      own: true,
      text,
      role: profile?.role || "user",
      time: "сейчас",
      status: activeThread.liveChatId ? "sent" : "read",
    };
    setLocalMessages((current) => ({
      ...current,
      [activeThread.id]: [...(current[activeThread.id] || []), optimistic],
    }));

    if (!activeThread.liveChatId) return;

    try {
      const ws = socketRef.current;
      let sentOverSocket = false;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "message", chat_id: activeThread.liveChatId, encoded_body: encodeWireBody(text) }));
        sentOverSocket = true;
      } else {
        const { response, payload } = await sendChatMessage(activeThread.liveChatId, text, token);
        if (response.ok && payload.message) setLiveThreads((current) => upsertMessage(current, payload.message));
      }
      emitTyping(false);
      if (!sentOverSocket) {
        setLocalMessages((current) => ({ ...current, [activeThread.id]: [] }));
      }
    } catch {
      setLocalMessages((current) => ({
        ...current,
        [activeThread.id]: (current[activeThread.id] || []).map((message) => (
          message.id === optimistic.id ? { ...message, status: "failed" } : message
        )),
      }));
    }
  };

  const createThread = async (payload) => {
    const { response, payload: result } = await createChat(payload, token);
    if (!response.ok || !result.chat) return;
    const thread = mapChat(result.chat, profile);
    setLiveThreads((current) => current.some((item) => item.liveChatId === thread.liveChatId)
      ? current.map((item) => (item.liveChatId === thread.liveChatId ? thread : item))
      : [thread, ...current]);
    setActiveSpace("direct");
    setActiveThreadId(thread.id);
  };

  const deleteThread = async (thread) => {
    if (!thread.liveChatId) return;
    setLiveThreads((current) => current.filter((item) => item.id !== thread.id));
    if (activeThreadId === thread.id) setActiveThreadId("notes");
    await deleteChat(thread.liveChatId, token).catch(() => undefined);
  };

  const togglePin = async (thread) => {
    if (!thread.liveChatId) return;
    const nextPinned = !thread.isPinned;
    setLiveThreads((current) => current.map((item) => (item.id === thread.id ? { ...item, isPinned: nextPinned, pinOrder: nextPinned ? 1 : 100 } : item)));
    await pinChat(thread.liveChatId, nextPinned, nextPinned ? 1 : 100, token).catch(() => undefined);
  };

  const renameThread = async () => {
    const value = titleDraft.trim();
    if (!value || !activeThread?.liveChatId) return;
    setLiveThreads((current) => current.map((thread) => (thread.id === activeThread.id ? { ...thread, name: value } : thread)));
    await renameChat(activeThread.liveChatId, value, token).catch(() => undefined);
  };

  const editMessage = async (message, text) => {
    const rawId = String(message.id).replace("message-", "");
    setLiveThreads((current) => current.map((thread) => deriveThreadPreview(thread, thread.messages.map((item) => (
      item.id === message.id ? { ...item, text, edited: true } : item
    )))));
    setEditingMessage(null);
    await editChatMessage(rawId, text, token).catch(() => undefined);
  };

  const deleteMessage = async (message, scope) => {
    const rawId = String(message.id).replace("message-", "");
    setLiveThreads((current) => current.map((thread) => deriveThreadPreview(thread, thread.messages.filter((item) => item.id !== message.id))));
    setMessageMenuId(null);
    await deleteChatMessage(rawId, scope, token).catch(() => undefined);
  };

  const openThread = (thread) => {
    setActiveThreadId(thread.id);
    setThreadMenu(null);
    setSidebarOpen(false);
  };

  const activeSpaceData = spaces.find((item) => item.id === activeSpace);
  const canCompose = Boolean(featureFlags.workspace_local_composer);
  const emptyTitle = activeThread?.type === "self" ? "Начните заметку" : activeThread?.type === "channel" ? "Опубликуйте сообщение" : "Поздоровайтесь";
  const emptyText = activeThread?.type === "self" ? "Здесь можно оставить быстрые мысли." : "Первое сообщение задаст тон беседе.";

  return (
    <section className={["messenger-zero", sidebarCompact ? "compact" : "", sidebarOpen ? "sidebar-open" : "", detailsOpen ? "details" : ""].filter(Boolean).join(" ")}>
      <aside className="mz-rail">
        <div className="mz-logo" title={projectName}>{String(projectName || "P4").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
        <nav>
          {spaces.map((space) => (
            <button key={space.id} className={activeSpace === space.id ? "active" : ""} type="button" title={space.title} onClick={() => setActiveSpace(space.id)}>
              <span>{space.icon}</span>
            </button>
          ))}
        </nav>
        <button type="button" className="mz-rail-settings" onClick={() => setSettingsOpen(true)} title="Настройки">⚙</button>
      </aside>

      <aside className={["mz-sidebar", sidebarOpen ? "mobile-open" : ""].filter(Boolean).join(" ")}>
        <div className="mz-profile" ref={profileRef}>
          <button type="button" onClick={() => setProfileOpen((value) => !value)}>
            <span className="mz-avatar self">{getInitials(profileName)}</span>
            <span>
              <strong>{profileName}</strong>
              <small>{profile?.tag || `@${profile?.handle || "user"}`}</small>
            </span>
          </button>
          {profileOpen && (
            <div className="mz-profile-popover">
              <strong>{profileName}</strong>
              <small>{profile?.email || profile?.tag || profile?.handle}</small>
              <span>{profile?.role || "user"}</span>
              {onLogout && <button type="button" onClick={onLogout}>Logout</button>}
            </div>
          )}
        </div>

        <div className="mz-sidebar-tools">
          <label>
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" />
          </label>
          <button type="button" onClick={() => setNewChatOpen(true)} title="Новый чат">+</button>
          <button type="button" onClick={() => setSidebarCompact((value) => !value)} title={sidebarCompact ? "Развернуть" : "Свернуть"}>{sidebarCompact ? "›" : "‹"}</button>
        </div>

        <div className="mz-thread-list">
          {filteredThreads.map((thread) => (
            <button
              key={thread.id}
              className={activeThread?.id === thread.id ? "active" : ""}
              type="button"
              onClick={() => openThread(thread)}
              onContextMenu={(event) => {
                event.preventDefault();
                setThreadMenu({ thread, x: event.clientX, y: event.clientY });
              }}
            >
              <ThreadAvatar thread={thread} />
              <span className="mz-thread-copy">
                <span>
                  <strong>{thread.name}</strong>
                  <time>{thread.lastAt || getTypeTitle(thread.type)}</time>
                </span>
                <small>{thread.lastMessage}</small>
              </span>
              {thread.publicId && <em>#{thread.publicId}</em>}
            </button>
          ))}
        </div>
      </aside>

      {activeSpace === "direct" ? (
        <main className="mz-chat">
          <header className="mz-chat-head">
            <button type="button" className="mz-mobile-sidebar-button" onClick={() => setSidebarOpen(true)} title={"\u0421\u043f\u0438\u0441\u043e\u043a \u0447\u0430\u0442\u043e\u0432"} aria-label={"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a \u0447\u0430\u0442\u043e\u0432"}>{"\u2630"}</button>
            <button type="button" className="mz-chat-title-button" onClick={() => { setTitleDraft(activeThread?.name || ""); setDetailsOpen((value) => !value); }}>
              <ThreadAvatar thread={activeThread} />
              <span>
                <strong>{activeThread?.name}</strong>
                <small>{typingUser ? `${typingUser} печатает...` : getTypeTitle(activeThread?.type)}{activeThread?.status === "online" ? " · в сети" : ""}</small>
              </span>
            </button>
            <div>
              {activeThread?.publicId && <span>#{activeThread.publicId}</span>}
              <button type="button" onClick={() => { setTitleDraft(activeThread?.name || ""); setDetailsOpen((value) => !value); }}>i</button>
            </div>
          </header>

          <div className="mz-feed" ref={feedRef}>
            {activeMessages.length === 0 ? (
              <div className="mz-empty-chat">
                <strong>{emptyTitle}</strong>
                <p>{emptyText}</p>
              </div>
            ) : activeMessages.map((message) => (
              <article
                key={message.id}
                className={message.own ? "own" : ""}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMessageMenuId(message.id);
                }}
              >
                {!message.own && <span className="mz-avatar">{getInitials(message.author)}</span>}
                <div className="mz-bubble">
                  {!message.own && <strong>{message.author}</strong>}
                  {editingMessage?.id === message.id ? (
                    <form onSubmit={(event) => { event.preventDefault(); editMessage(message, editingMessage.text.trim()); }}>
                      <input value={editingMessage.text} onChange={(event) => setEditingMessage({ ...editingMessage, text: event.target.value })} autoFocus />
                      <button type="submit">OK</button>
                      <button type="button" onClick={() => setEditingMessage(null)}>×</button>
                    </form>
                  ) : <p>{message.text}</p>}
                  <footer>
                    {message.edited && <em>изм.</em>}
                    <time>{message.time}</time>
                    {message.own && <span className={message.status === "failed" ? "failed" : ""}>{message.status === "read" ? "✓✓" : message.status === "failed" ? "!" : "✓"}</span>}
                  </footer>
                  <button type="button" className="mz-message-more" onClick={() => setMessageMenuId((value) => value === message.id ? null : message.id)}>⋯</button>
                  {messageMenuId === message.id && (
                    <MessageMenu
                      message={message}
                      onEdit={() => { setEditingMessage({ id: message.id, text: message.text }); setMessageMenuId(null); }}
                      onDeleteSelf={() => deleteMessage(message, "self")}
                      onDeleteAll={() => deleteMessage(message, "all")}
                    />
                  )}
                </div>
              </article>
            ))}
          </div>

          {typingUser && <div className="mz-typing">{typingUser} печатает...</div>}
          {canCompose ? (
            <form className="mz-composer" onSubmit={sendMessage}>
              <button type="button">＋</button>
              <input value={draft} onChange={(event) => updateDraft(event.target.value)} placeholder="Сообщение" />
              <button type="submit">➤</button>
            </form>
          ) : <div className="mz-composer disabled">Отправка отключена feature flag.</div>}
        </main>
      ) : <EmptySection activeSpace={activeSpaceData?.id} />}

      {sidebarOpen && <button type="button" className="mz-sidebar-scrim" aria-label={"\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a \u0447\u0430\u0442\u043e\u0432"} onClick={() => setSidebarOpen(false)} />}

      {detailsOpen && activeThread && (
        <aside className="mz-details">
          <header>
            <ThreadAvatar thread={activeThread} />
            <div>
              <strong>{activeThread.name}</strong>
              <small>{getTypeTitle(activeThread.type)}{activeThread.publicId ? ` #${activeThread.publicId}` : ""}</small>
            </div>
            <button type="button" onClick={() => setDetailsOpen(false)}>×</button>
          </header>
          {activeThread.liveChatId && (
            <section>
              <label>Название</label>
              <input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} />
              <button type="button" onClick={renameThread}>Сохранить</button>
            </section>
          )}
          <section>
            <label>Участники</label>
            {(activeThread.memberItems || []).length > 0 ? activeThread.memberItems.map((member) => (
              <div key={member.id} className="mz-member">
                <span className={["mz-avatar", member.is_online ? "online" : ""].filter(Boolean).join(" ")}>{getInitials(member.name)}</span>
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.is_online ? "в сети" : member.tag}</small>
                </span>
              </div>
            )) : <p>Только вы.</p>}
          </section>
        </aside>
      )}

      {threadMenu && (
        <div className="mz-menu mz-context" style={{ left: threadMenu.x, top: threadMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          {threadMenu.thread.liveChatId && <button type="button" onClick={() => { togglePin(threadMenu.thread); setThreadMenu(null); }}>{threadMenu.thread.isPinned ? "Открепить" : "Закрепить"}</button>}
          {threadMenu.thread.liveChatId && <button type="button" className="danger" onClick={() => { deleteThread(threadMenu.thread); setThreadMenu(null); }}>Удалить чат</button>}
        </div>
      )}

      {newChatOpen && <NewChatDialog contacts={safeContacts} onClose={() => setNewChatOpen(false)} onCreate={createThread} />}

      {settingsOpen && (
        <div className="mz-backdrop" onClick={() => setSettingsOpen(false)}>
          <section className="mz-dialog settings" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>Настройки</span>
                <strong>Мессенджер</strong>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)}>×</button>
            </header>
            <button type="button" onClick={onToggleTheme}>{theme === "light" ? "Темная тема" : "Светлая тема"}</button>
            <button type="button" onClick={onToggleLang}>{lang === "RU" ? "English" : "Русский"}</button>
          </section>
        </div>
      )}
    </section>
  );
}
