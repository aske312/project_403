import React, { useState } from "react";
import "../styles/home.css";

export default function Home() {
  const [theme, setTheme] = useState("light");
  const [lang, setLang] = useState("RU");

  const t = {
    RU: {
      brand: "Project_403",
      subtitle: "Минималистичный мессенджер нового поколения",
      desc:
        "Проект создан для быстрого, чистого и приватного общения без лишних элементов интерфейса.",
      download: "Скачать приложение",

      b1: "Мгновенные сообщения",
      b1t: "Сообщения доставляются без задержек",

      b2: "Чистый интерфейс",
      b2t: "Никакого визуального шума",

      b3: "Приватность",
      b3t: "Фокус на безопасности общения",

      footer: "Система стабильна"
    },

    EN: {
      brand: "Project_403",
      subtitle: "Next-generation minimal messenger",
      desc:
        "Built for fast, clean and private communication without UI clutter.",
      download: "Download app",

      b1: "Instant messaging",
      b1t: "Messages delivered without delay",

      b2: "Clean UI",
      b2t: "No visual clutter",

      b3: "Privacy focused",
      b3t: "Security-first communication",

      footer: "System stable"
    }
  }[lang];

  return (
    <div className={`app ${theme}`}>

      {/* HEADER */}
      <header className="header">

        <div className="logo">{t.brand}</div>

        <div className="header-right">

          <button
            className="circle-btn"
            onClick={() =>
              setTheme(theme === "light" ? "dark" : "light")
            }
          >
            🕯️
          </button>

          <button
            className="flag-btn"
            onClick={() =>
              setLang(lang === "RU" ? "EN" : "RU")
            }
          >
            {lang === "RU" ? (
              <img src="/assets/ru.png" />
            ) : (
              <img src="/assets/uk.png" />
            )}
          </button>

        </div>

      </header>

      {/* HERO */}
      <main className="hero">

        <h1>{t.brand}</h1>
        <p className="subtitle">{t.subtitle}</p>

        <p className="desc">{t.desc}</p>

        {/* BLOCKS */}
        <div className="blocks">

          <div className="block">
            <div className="img">
              <img src="/assets/msg.png" alt="" />
            </div>
            <div>
              <b>{t.b1}</b>
              <p>{t.b1t}</p>
            </div>
          </div>

          <div className="block">
            <div className="img">
              <img src="/assets/ui.png" alt="" />
            </div>
            <div>
              <b>{t.b2}</b>
              <p>{t.b2t}</p>
            </div>
          </div>

          <div className="block">
            <div className="img">
              <img src="/assets/lock.png" alt="" />
            </div>
            <div>
              <b>{t.b3}</b>
              <p>{t.b3t}</p>
            </div>
          </div>

        </div>

        {/* DOWNLOAD CTA (внизу описания) */}
        <button className="download-btn">
          ⬇ {t.download}
        </button>

      </main>

      {/* FOOTER */}
      <footer className="footer">

        <div>{t.footer}</div>

        <div className="links">
          <a href="https://github.com">GitHub</a>
          <a href="https://vk.com">VK</a>
          <a href="https://t.me">Telegram</a>
        </div>

      </footer>

    </div>
  );
}