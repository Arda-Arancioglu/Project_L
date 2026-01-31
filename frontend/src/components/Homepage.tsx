import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getNextDate, setNextDate, deleteNextDate } from "../api";
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
  const [timeInput, setTimeInput] = useState("18:00");
  const [countdown, setCountdown] = useState("");

  const isArda = currentUser === "arda";
  const greeting = isArda ? "Merhaba Arda 🩵" : "Merhaba Aşkım 💗";

  useEffect(() => {
    loadNextDate();
  }, [password]);

  // Live countdown timer
  useEffect(() => {
    if (!nextDate) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const target = new Date(nextDate.date).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown("Şimdi! 🎉");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Pad numbers to prevent layout shift
      const pad = (n: number) => n.toString().padStart(2, '0');
      
      let result = "";
      if (days > 0) result += `${days} gün `;
      if (hours > 0 || days > 0) result += `${pad(hours)} saat `;
      result += `${pad(minutes)} dk ${pad(seconds)} sn`;
      
      setCountdown(result);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextDate]);

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
      // Combine date and time into ISO string
      const datetime = `${dateInput}T${timeInput}:00`;
      const result = await setNextDate(password, datetime, "Bir sonraki buluşmamıza kalan süre:");
      setNextDateState(result.nextDate);
      setEditingDate(false);
    } catch (err) {
      console.error("Failed to save date:", err);
    }
  }

  return (
    <div className={`homepage ${currentUser}`}>
      <div className="homepage-content">
        <h1 className="homepage-title">💕</h1>
        <p className="homepage-greeting">{greeting}</p>
        <p className="homepage-subtitle">Anasayfa</p>

        {/* Next Date Countdown */}
        <div className="next-date-section">
          {editingDate ? (
            <div className="date-edit">
              <p className="date-edit-label">Bir sonraki buluşmamızı ayarla:</p>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
              <input
                type="time"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
              />
              <div className="date-edit-buttons">
                <button onClick={handleSaveDate}>💾 Kaydet</button>
                <button onClick={() => setEditingDate(false)}>İptal</button>
              </div>
            </div>
          ) : nextDate ? (
            <div className="date-countdown">
              <div className="countdown-content" onClick={() => {
                const d = new Date(nextDate.date);
                setDateInput(d.toISOString().split('T')[0]);
                setTimeInput(d.toTimeString().slice(0, 5));
                setEditingDate(true);
              }}>
                <p className="countdown-title">{nextDate.title}</p>
                <p className="countdown-time">{countdown} 💕</p>
                <p className="countdown-date">
                  {new Date(nextDate.date).toLocaleDateString("tr-TR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })} - {new Date(nextDate.date).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </p>
              </div>
              <button
                className="delete-date-btn"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm("Tarihi silmek istediğine emin misin?")) {
                    try {
                      await deleteNextDate(password);
                      setNextDateState(null);
                    } catch (err) {
                      console.error("Failed to delete date:", err);
                    }
                  }
                }}
              >
                🗑️
              </button>
            </div>
          ) : (
            <div className="no-date-entry">
              <p className="no-date-text">📅 Henüz tarih eklenmedi</p>
              <button
                className="add-date-btn"
                onClick={() => setEditingDate(true)}
              >
                ➕ Tarih Ekle
              </button>
            </div>
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
