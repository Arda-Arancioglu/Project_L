import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getGallery, getSignedUrl, toggleFavorite } from "../api";
import type { PhotoMeta, Uploader } from "../types";
import "./Discover.css";

interface Props {
  password: string;
  currentUser: Uploader;
}

export function Discover({ password, currentUser }: Props) {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState<"left" | "right" | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDiff, setTouchDiff] = useState(0);

  useEffect(() => {
    loadPhotos();
  }, [password, currentUser]);

  async function loadPhotos() {
    try {
      setLoading(true);
      const data = await getGallery(password);
      // Filter photos not yet favorited by current user, shuffle them
      const unfavorited = data.photos
        .filter((p) => !p.favoritedBy?.includes(currentUser))
        .sort(() => Math.random() - 0.5);
      setPhotos(unfavorited);
      if (unfavorited.length > 0) {
        const url = await getSignedUrl(password, unfavorited[0].key);
        setImageUrl(url);
      }
    } catch (err) {
      console.error("Failed to load photos:", err);
    } finally {
      setLoading(false);
    }
  }

  const currentPhoto = photos[currentIndex];

  const goToNext = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < photos.length) {
      setCurrentIndex(nextIndex);
      const url = await getSignedUrl(password, photos[nextIndex].key);
      setImageUrl(url);
    }
  }, [currentIndex, photos, password]);

  const handleSwipe = useCallback(
    async (direction: "left" | "right") => {
      if (!currentPhoto) return;

      setSwiping(direction);

      if (direction === "right") {
        // Like - add to favorites
        try {
          await toggleFavorite({
            password,
            photoId: currentPhoto.id,
            user: currentUser,
          });
        } catch (err) {
          console.error("Failed to favorite:", err);
        }
      }

      // Wait for animation
      setTimeout(() => {
        setSwiping(null);
        setTouchDiff(0);
        goToNext();
      }, 300);
    },
    [currentPhoto, password, currentUser, goToNext]
  );

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.touches[0].clientX - touchStart;
    setTouchDiff(diff);
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;
    if (Math.abs(touchDiff) > 100) {
      handleSwipe(touchDiff > 0 ? "right" : "left");
    } else {
      setTouchDiff(0);
    }
    setTouchStart(null);
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleSwipe("right");
      if (e.key === "ArrowLeft") handleSwipe("left");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSwipe]);

  const remaining = photos.length - currentIndex;
  const userLabel = currentUser === "arda" ? "🩵 Arda" : "💗 Aşkım";

  if (loading) {
    return (
      <div className="discover-loading">
        <div className="spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className={`discover ${currentUser}`}>
      <header className="discover-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ← Geri
        </button>
        <h1>✨ Keşfet</h1>
        <span className="discover-user">{userLabel}</span>
      </header>

      {!currentPhoto ? (
        <div className="discover-empty">
          <p>🎉 Tüm fotoğrafları gördün!</p>
          <button onClick={loadPhotos}>Tekrar Başla</button>
        </div>
      ) : (
        <>
          <div className="discover-counter">{remaining} fotoğraf kaldı</div>

          <div
            className={`discover-card ${swiping ? `swiping-${swiping}` : ""}`}
            style={{
              transform: touchDiff
                ? `translateX(${touchDiff}px) rotate(${touchDiff * 0.05}deg)`
                : undefined,
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img src={imageUrl} alt="" />
            {currentPhoto.note && (
              <div className="card-note">
                <p>{currentPhoto.note}</p>
                {currentPhoto.noteBy && (
                  <span className="note-author">
                    — {currentPhoto.noteBy === "arda" ? "Arda" : "Aşkım"}
                  </span>
                )}
              </div>
            )}
            <div className="swipe-hint left">👎</div>
            <div className="swipe-hint right">❤️</div>
          </div>

          <div className="discover-actions">
            <button
              className="action-btn skip"
              onClick={() => handleSwipe("left")}
            >
              ✕
            </button>
            <button
              className="action-btn like"
              onClick={() => handleSwipe("right")}
            >
              ❤️
            </button>
          </div>

          <p className="discover-tip">
            ← Kaydır: Geç | Kaydır →: Beğen
          </p>
        </>
      )}
    </div>
  );
}
