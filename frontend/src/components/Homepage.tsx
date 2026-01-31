import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getNextDate, setNextDate } from "../api";
import type { Uploader, NextDateInfo } from "../types";
import "./Homepage.css";

interface Props {
  currentUser: Uploader;
  password: string;
}

export function Homepage({ currentUser, password }: Props) {
  const navigate = useNavigate();
  const [nextDate, setNextDateState] = useState<NextDateInfo | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [titleInput, setTitleInput] = useState("");

  const isArda = currentUser === "arda";
  const greeting = isArda ? "Merhaba Arda 🩵" : "Merhaba Aşkım 💗";

  useEffect(() => {
    loadNextDate();
  }, [password]);

  async function loadNextDate() {
    try {
      const result = await getNextDate(password);
      setNextDateState(result.nextDate);
    } catch (err) {
      console.error("Failed to load next date:", err);
    }
  }

  async function handleSaveDate() {
    if (!dateInput) return;
    try {
      const result = await setNextDate(password, dateInput, titleInput || "Buluşma 💕");
      setNextDateState(result.nextDate);
      setEditingDate(false);
    } catch (err) {
      console.error("Failed to save date:", err);
    }
  }

  function getCountdown(): string {
    if (!nextDate) return "";
    const target = new Date(nextDate.date).getTime();
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) return "Bugün! 🎉";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days === 0) return `${hours} saat kaldı! 💕`;
    if (days === 1) return `Yarın! (${hours} saat) 💕`;
    return `${days} gün ${hours} saat 💕`;
  }

  return (
    <div className={`homepage ${currentUser}`}>
      <div className="homepage-content">
        <h1 className="homepage-title">💕</h1>
        <p className="homepage-greeting">{greeting}</p>
        <p className="homepage-subtitle">Galerimiz</p>

        {/* Next Date Countdown */}
        <div className="next-date-section">
          {editingDate ? (
            <div className="date-edit">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
              <input
                type="text"
                placeholder="Başlık (ör: Buluşma)"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
              <div className="date-edit-buttons">
                <button onClick={handleSaveDate}>💾 Kaydet</button>
                <button onClick={() => setEditingDate(false)}>İptal</button>
              </div>
            </div>
          ) : nextDate ? (
            <div className="date-countdown" onClick={() => {
              setDateInput(nextDate.date);
              setTitleInput(nextDate.title);
              setEditingDate(true);
            }}>
              <p className="countdown-title">{nextDate.title}</p>
              <p className="countdown-time">{getCountdown()}</p>
              <p className="countdown-date">
                {new Date(nextDate.date).toLocaleDateString("tr-TR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          ) : (
            <button
              className="add-date-btn"
              onClick={() => setEditingDate(true)}
            >
              📅 Sonraki buluşmayı ekle
            </button>
          )}
        </div>

        <div className="homepage-buttons">
          <button
            className="homepage-btn gallery-btn"
            onClick={() => navigate("/gallery")}
          >
            <span className="btn-icon">📸</span>
            <span className="btn-text">Galeri</span>
          </button>

          <button
            className="homepage-btn favorites-btn"
            onClick={() => navigate("/favorites")}
          >
            <span className="btn-icon">❤️</span>
            <span className="btn-text">Favoriler</span>
          </button>

          <button
            className="homepage-btn discover-btn"
            onClick={() => navigate("/discover")}
          >
            <span className="btn-icon">✨</span>
            <span className="btn-text">Keşfet</span>
          </button>

          <button
            className="homepage-btn notes-btn"
            onClick={() => navigate("/notes")}
          >
            <span className="btn-icon">📝</span>
            <span className="btn-text">Notlar</span>
          </button>

          <button
            className="homepage-btn upload-btn"
            onClick={() => navigate("/upload")}
          >
            <span className="btn-icon">➕</span>
            <span className="btn-text">Yükle</span>
          </button>

          <button
            className="homepage-btn recycle-btn"
            onClick={() => navigate("/recycle")}
          >
            <span className="btn-icon">🗑️</span>
            <span className="btn-text">Çöp Kutusu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
