import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getGallery, getSignedUrl, toggleFavorite } from "../api";
import type { PhotoMeta, Uploader } from "../types";
import "./Favorites.css";

type FavoriteTab = "arda" | "askim" | "together";

interface Props {
  password: string;
}

export function Favorites({ password }: Props) {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FavoriteTab>("together");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMeta | null>(null);

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
      if (activeTab === "arda") {
        return favBy.includes("arda") && !favBy.includes("askim");
      }
      if (activeTab === "askim") {
        return favBy.includes("askim") && !favBy.includes("arda");
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
    <div className="favorites">
      <header className="favorites-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ← Geri
        </button>
        <h1>❤️ Favoriler</h1>
      </header>

      <div className="favorites-tabs">
        <button
          className={`tab ${activeTab === "arda" ? "active" : ""}`}
          onClick={() => setActiveTab("arda")}
        >
          Arda'nın ❤️
        </button>
        <button
          className={`tab ${activeTab === "askim" ? "active" : ""}`}
          onClick={() => setActiveTab("askim")}
        >
          Aşkım'ın ❤️
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
              : activeTab === "arda"
              ? "Arda'nın favori fotoğrafı yok"
              : "Aşkım'ın favori fotoğrafı yok"}
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
                  className={`heart-btn ${selectedPhoto.favoritedBy?.includes("arda") ? "active arda" : ""}`}
                  onClick={() => handleToggleFavorite(selectedPhoto, "arda")}
                >
                  🩵 Arda
                </button>
                <button
                  className={`heart-btn ${selectedPhoto.favoritedBy?.includes("askim") ? "active askim" : ""}`}
                  onClick={() => handleToggleFavorite(selectedPhoto, "askim")}
                >
                  💗 Aşkım
                </button>
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
