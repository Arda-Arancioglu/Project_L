import { useState } from "react";
import { verifyPassword } from "../api";
import "./PasswordGate.css";

interface Props {
  onSuccess: (password: string) => void;
}

export default function PasswordGate({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Şifreyi gir");
      return;
    }

    setLoading(true);
    setError("");

    const valid = await verifyPassword(password);

    if (valid) {
      onSuccess(password);
    } else {
      setError("Yanlış şifre 💔");
    }

    setLoading(false);
  };

  return (
    <div className="password-gate">
      <div className="password-card">
        <div className="heart-icon">💕</div>
        <h1>Galerimiz</h1>
        <p>Gizli şifremizi gir</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre..."
            autoFocus
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Kontrol ediliyor..." : "Giriş 💝"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
