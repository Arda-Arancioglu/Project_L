import { useNavigate } from "react-router-dom";
import "./Homepage.css";

export function Homepage() {
  const navigate = useNavigate();

  return (
    <div className="homepage">
      <div className="homepage-content">
        <h1 className="homepage-title">💕</h1>
        <p className="homepage-subtitle">Galerimiz</p>
        
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
            className="homepage-btn upload-btn"
            onClick={() => navigate("/upload")}
          >
            <span className="btn-icon">➕</span>
            <span className="btn-text">Yükle</span>
          </button>
        </div>
      </div>
    </div>
  );
}
