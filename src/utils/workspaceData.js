export const spaces = [
  { id: "direct", icon: "💬", label: "Чаты", title: "Чаты и сообщения" },
  { id: "publics", icon: "📣", label: "Каналы", title: "Каналы и публикации" },
  { id: "voice", icon: "🎙", label: "Голос", title: "Голосовые комнаты" },
  { id: "meetings", icon: "📹", label: "Встречи", title: "Конференции" },
];

export const threads = [
  {
    id: "notes",
    type: "self",
    space: "direct",
    name: "Заметки",
    description: "чат с самим собой",
    unread: 0,
    status: "online",
    isPinned: true,
    pinOrder: 0,
    members: 1,
    topic: "Личные заметки, ссылки и быстрые мысли.",
    lastMessage: "Личные заметки",
    lastAt: "",
    messages: [],
  },
];

export const dialogCreateActions = ["Личный чат", "Группа", "Канал"];
