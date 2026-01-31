import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getNotes, addNote, toggleNote, deleteNote } from "../api";
import type { NoteItem, Uploader } from "../types";
import "./Notes.css";

interface Props {
  password: string;
  currentUser: Uploader;
}

export function Notes({ password, currentUser }: Props) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState("");

  const userLabel = currentUser === "arda" ? "🩵 Arda" : "💗 Aşkım";

  useEffect(() => {
    loadNotes();
  }, [password]);

  async function loadNotes() {
    try {
      setLoading(true);
      const result = await getNotes(password);
      setNotes(result.notes || []);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote() {
    if (!newNoteText.trim()) return;
    try {
      const result = await addNote(password, newNoteText.trim(), currentUser);
      setNotes([result.note, ...notes]);
      setNewNoteText("");
    } catch (err) {
      console.error("Failed to add note:", err);
    }
  }

  async function handleToggle(noteId: string) {
    try {
      const result = await toggleNote(password, noteId);
      setNotes(notes.map((n) =>
        n.id === noteId ? { ...n, done: result.done } : n
      ));
    } catch (err) {
      console.error("Failed to toggle note:", err);
    }
  }

  async function handleDelete(noteId: string) {
    try {
      await deleteNote(password, noteId);
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  }

  const activeNotes = notes.filter((n) => !n.done);
  const completedNotes = notes.filter((n) => n.done);

  if (loading) {
    return (
      <div className="notes-loading">
        <div className="spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className={`notes-page ${currentUser}`}>
      <header className="notes-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ← Geri
        </button>
        <h1>📝 Notlar & Planlar</h1>
        <span className="notes-user">{userLabel}</span>
      </header>

      {/* Add new note */}
      <div className="add-note">
        <input
          type="text"
          placeholder="Yeni not veya plan ekle..."
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleAddNote()}
        />
        <button onClick={handleAddNote} disabled={!newNoteText.trim()}>
          ➕
        </button>
      </div>

      {/* Active notes */}
      {activeNotes.length > 0 && (
        <div className="notes-section">
          <h2>Yapılacaklar</h2>
          <div className="notes-list">
            {activeNotes.map((note) => (
              <div key={note.id} className="note-item">
                <button
                  className="check-btn"
                  onClick={() => handleToggle(note.id)}
                >
                  ⬜
                </button>
                <div className="note-content">
                  <p className="note-text">{note.text}</p>
                  <span className="note-author">
                    {note.createdBy === "arda" ? "🩵 Arda" : "💗 Aşkım"} •{" "}
                    {new Date(note.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <button
                  className="delete-note-btn"
                  onClick={() => handleDelete(note.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed notes */}
      {completedNotes.length > 0 && (
        <div className="notes-section completed">
          <h2>Tamamlananlar ✓</h2>
          <div className="notes-list">
            {completedNotes.map((note) => (
              <div key={note.id} className="note-item done">
                <button
                  className="check-btn"
                  onClick={() => handleToggle(note.id)}
                >
                  ✅
                </button>
                <div className="note-content">
                  <p className="note-text">{note.text}</p>
                  <span className="note-author">
                    {note.createdBy === "arda" ? "🩵 Arda" : "💗 Aşkım"}
                  </span>
                </div>
                <button
                  className="delete-note-btn"
                  onClick={() => handleDelete(note.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {notes.length === 0 && (
        <div className="notes-empty">
          <p>Henüz not yok 📝</p>
          <p className="notes-hint">Planlarınızı ve yapılacakları buraya ekleyin!</p>
        </div>
      )}
    </div>
  );
}
