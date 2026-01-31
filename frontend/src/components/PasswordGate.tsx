import { useState } from "react";
import { verifyPassword } from "../api";
import { savePassword } from "../utils";
import "./PasswordGate.css";

interface Props {
  onSuccess: () => void;
}

export default function PasswordGate({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter the password");
      return;
    }

    setLoading(true);
    setError("");

    const valid = await verifyPassword(password);

    if (valid) {
      savePassword(password);
      onSuccess();
    } else {
      setError("Wrong password 💔");
    }

    setLoading(false);
  };

  return (
    <div className="password-gate">
      <div className="password-card">
        <div className="heart-icon">💕</div>
        <h1>Our Gallery</h1>
        <p>Enter our secret password to continue</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Secret password..."
            autoFocus
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Checking..." : "Enter 💝"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
