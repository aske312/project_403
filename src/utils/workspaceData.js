export const spaces = [
  { id: "direct", icon: "@", label: "DM", title: "Личные" },
  { id: "team", icon: "#", label: "TEAM", title: "Команда" },
  { id: "voice", icon: "◉", label: "LIVE", title: "Голос" },
];

export const threads = [
  {
    id: "general",
    type: "channel",
    space: "team",
    name: "# general",
    description: "Общий канал проекта",
    unread: 4,
    status: "online",
    isPinned: false,
    pinOrder: 100,
    members: 18,
    topic: "Новости, быстрые апдейты и решения по Project_403.",
    lastMessage: "Давайте оставим простую логику, но интерфейс сделаем похожим на реальное приложение.",
    lastAt: "10:18",
    messages: [
      { id: 1, author: "Mira", role: "frontend", time: "10:12", text: "Собрала первый экран workspace: слева каналы, в центре чат, справа детали.", status: "read" },
      { id: 2, author: "Alex", role: "backend", time: "10:14", text: "Ок, backend пока можно не трогать. Главное — заложить нормальную структуру под будущие API.", status: "read" },
      { id: 3, author: "You", own: true, role: "owner", time: "10:18", text: "Давайте оставим простую логику, но интерфейс сделаем похожим на реальное приложение.", status: "read" },
    ],
  },
  {
    id: "dev-room",
    type: "group",
    space: "team",
    name: "Dev room",
    description: "Закрытая группа разработки",
    unread: 2,
    status: "busy",
    isPinned: false,
    pinOrder: 101,
    members: 6,
    topic: "Обсуждение auth, ролей, feature flags и инфраструктуры.",
    lastMessage: "Да, не усложняем. Главное — не завязать UI на то, чего ещё нет.",
    lastAt: "09:49",
    messages: [
      { id: 1, author: "Nikita", role: "infra", time: "09:44", text: "Redis пока оставим за флагом. Для локального режима хватит in-memory заглушки.", status: "read" },
      { id: 2, author: "You", own: true, role: "owner", time: "09:49", text: "Да, не усложняем. Главное — не завязать UI на то, чего ещё нет.", status: "delivered" },
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
