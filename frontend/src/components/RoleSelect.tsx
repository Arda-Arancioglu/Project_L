import type { Uploader } from "../types";
import "./RoleSelect.css";

interface Props {
  onSelect: (role: Uploader) => void;
}

export function RoleSelect({ onSelect }: Props) {
  return (
    <div className="role-select">
      <div className="role-content">
        <div className="role-icon">💕</div>
        <h1>Hoş geldin!</h1>
        <p>Sen kimsin?</p>

        <div className="role-buttons">
          <button
            className="role-btn arda"
            onClick={() => onSelect("arda")}
          >
            <span className="role-emoji">🩵</span>
            <span className="role-name">Ben Arda</span>
          </button>

          <button
            className="role-btn askim"
            onClick={() => onSelect("askim")}
          >
            <span className="role-emoji">💗</span>
            <span className="role-name">Ben Aşkım</span>
          </button>
        </div>
      </div>
    </div>
  );
}
