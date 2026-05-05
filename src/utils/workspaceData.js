export const spaces = [
  { id: "direct", icon: "💬", label: "Чаты", title: "Чаты и сообщения" },
  { id: "publics", icon: "📰", label: "Паблики", title: "Паблики и новостные порталы" },
  { id: "voice", icon: "🎙", label: "Голос", title: "Комнаты голосовых чатов" },
  { id: "meetings", icon: "📹", label: "Конфы", title: "Комната конференций" },
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
    lastMessage: "Сохраняйте здесь важные мысли и черновики.",
    lastAt: "сейчас",
    messages: [
      { id: "note-1", author: "Заметки", own: false, role: "system", time: "сейчас", text: "Это ваш личный чат для заметок. Позже он будет синхронизироваться как обычный диалог.", status: "read" },
    ],
  },
  {
    id: "alice",
    type: "direct",
    space: "direct",
    name: "Alice Morgan",
    description: "личные сообщения",
    unread: 0,
    status: "online",
    isPinned: false,
    pinOrder: 102,
    members: 2,
    topic: "Персональный диалог без шума каналов.",
    lastMessage: "Да, добавлю адаптивный режим и сохраню текущую тему.",
    lastAt: "Вчера",
    messages: [
      { id: 1, author: "Alice", role: "designer", time: "Вчера", text: "Можно сделать карточки каналов более компактными на мобильном?", status: "read" },
      { id: 2, author: "You", own: true, role: "owner", time: "Вчера", text: "Да, добавлю адаптивный режим и сохраню текущую тему.", status: "read" },
    ],
  },
];

export const dialogCreateActions = ["Личный чат", "Группа", "Канал"];
