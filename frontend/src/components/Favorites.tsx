import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getGallery, getSignedUrl, toggleFavorite } from "../api";
import type { PhotoMeta, Uploader } from "../types";
import "./Favorites.css";

type FavoriteTab = "mine" | "theirs" | "together";

interface Props {
  password: string;
  currentUser: Uploader;
}

export function Favorites({ password, currentUser }: Props) {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FavoriteTab>("together");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMeta | null>(null);

  const otherUser: Uploader = currentUser === "arda" ? "askim" : "arda";
  const userLabel = currentUser === "arda" ? "🩵 Arda" : "💗 Aşkım";
  const otherLabel = currentUser === "arda" ? "💗 Aşkım" : "🩵 Arda";

  useEffect(() => {
    loadFavorites();
  }, [password]);

  async function loadFavorites() {
    try {
      setLoading(true);
      const data = await getGallery(password);
      // Filter only favorited photos
      const favPhotos = data.photos.filter(
        (p) => p.favoritedBy && p.favoritedBy.length > 0
      );
      setPhotos(favPhotos);

      // Load thumbnail URLs
      const urls: Record<string, string> = {};
      await Promise.all(
        favPhotos.map(async (photo) => {
          const thumbKey = photo.thumbnailKey || photo.key;
          urls[photo.id] = await getSignedUrl(password, thumbKey);
        })
      );
      setImageUrls(urls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  function getFilteredPhotos(): PhotoMeta[] {
    return photos.filter((photo) => {
      const favBy = photo.favoritedBy || [];
      if (activeTab === "mine") {
        return favBy.includes(currentUser) && !favBy.includes(otherUser);
      }
      if (activeTab === "theirs") {
        return favBy.includes(otherUser) && !favBy.includes(currentUser);
      }
      // together - both favorited
      return favBy.includes("arda") && favBy.includes("askim");
    });
  }

  async function handleToggleFavorite(photo: PhotoMeta, user: Uploader) {
    try {
      const result = await toggleFavorite({
        password,
        photoId: photo.id,
        user,
      });
      
      // Update local state
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, favoritedBy: result.favoritedBy } : p
        ).filter((p) => p.favoritedBy && p.favoritedBy.length > 0)
      );
      
      if (selectedPhoto?.id === photo.id) {
        const newFavBy = result.favoritedBy;
        if (newFavBy.length === 0) {
          setSelectedPhoto(null);
        } else {
          setSelectedPhoto({ ...selectedPhoto, favoritedBy: newFavBy });
        }
      }
    } catch (err) {
      console.error("Favori değiştirilemedi:", err);
    }
  }

  async function handleDownload(photo: PhotoMeta) {
    try {
      const url = await getSignedUrl(password, photo.key);
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = photo.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("İndirme başarısız:", err);
    }
  }

  async function openFullPhoto(photo: PhotoMeta) {
    const url = await getSignedUrl(password, photo.key);
    setImageUrls((prev) => ({ ...prev, [`full_${photo.id}`]: url }));
    setSelectedPhoto(photo);
  }

  const filteredPhotos = getFilteredPhotos();

  if (loading) {
    return (
      <div className="favorites-loading">
        <div className="spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="favorites-error">
        <p>{error}</p>
        <button onClick={loadFavorites}>Tekrar Dene</button>
      </div>
    );
  }

  return (
    <div className={`favorites ${currentUser}`}>
      <header className="favorites-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ← Geri
        </button>
        <h1>❤️ Favoriler</h1>
        <span className="favorites-user">{userLabel}</span>
      </header>

      <div className="favorites-tabs">
        <button
          className={`tab ${activeTab === "mine" ? "active" : ""}`}
          onClick={() => setActiveTab("mine")}
        >
          Benim ❤️
        </button>
        <button
          className={`tab ${activeTab === "theirs" ? "active" : ""}`}
          onClick={() => setActiveTab("theirs")}
        >
          {otherLabel}'ın ❤️
        </button>
        <button
          className={`tab ${activeTab === "together" ? "active" : ""}`}
          onClick={() => setActiveTab("together")}
        >
          Birlikte 💕
        </button>
      </div>

      {filteredPhotos.length === 0 ? (
        <div className="no-favorites">
          <p>
            {activeTab === "together"
              ? "İkinizin de beğendiği fotoğraf yok"
              : activeTab === "mine"
              ? "Favori fotoğrafın yok"
              : `${otherLabel} henüz beğenmemiş`}
          </p>
        </div>
      ) : (
        <div className="favorites-grid">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              className="favorite-item"
              onClick={() => openFullPhoto(photo)}
            >
              <img src={imageUrls[photo.id]} alt={photo.filename} loading="lazy" />
              <div className="favorite-hearts">
                {photo.favoritedBy?.includes("arda") && <span>🩵</span>}
                {photo.favoritedBy?.includes("askim") && <span>💗</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="photo-modal" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedPhoto(null)}>
              ✕
            </button>
            <img
              src={imageUrls[`full_${selectedPhoto.id}`] || imageUrls[selectedPhoto.id]}
              alt={selectedPhoto.filename}
            />
            <div className="modal-info">
              {selectedPhoto.note && <p className="note">{selectedPhoto.note}</p>}
              <div className="modal-actions">
                <button
                  className={`main-heart ${selectedPhoto.favoritedBy?.includes(currentUser) ? "active" : ""}`}
                  onClick={() => handleToggleFavorite(selectedPhoto, currentUser)}
                >
                  {selectedPhoto.favoritedBy?.includes(currentUser) ? "❤️" : "🤍"}
                </button>
                {selectedPhoto.favoritedBy?.includes(otherUser) && (
                  <span className="partner-liked">{otherLabel} de beğendi</span>
                )}
                <button
                  className="download-btn"
                  onClick={() => handleDownload(selectedPhoto)}
                >
                  ⬇️ İndir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
