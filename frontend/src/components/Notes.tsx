import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getNotes, addNote, toggleNote, deleteNote } from "../api";
import type { NoteItem, NoteCategory, Uploader } from "../types";
import "./Notes.css";

interface Props {
  password: string;
  currentUser: Uploader;
}

const CATEGORIES: { key: NoteCategory; label: string; icon: string }[] = [
  { key: "all", label: "Tümü", icon: "📋" },
  { key: "travel", label: "Gezilecek Yerler", icon: "✈️" },
  { key: "todo", label: "Yapılacaklar", icon: "✅" },
  { key: "food", label: "Yenilecekler", icon: "🍽️" },
];

export function Notes({ password, currentUser }: Props) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState("");
  const [activeCategory, setActiveCategory] = useState<NoteCategory>("all");
  const [newNoteCategory, setNewNoteCategory] = useState<NoteCategory>("todo");

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
      const result = await addNote(password, newNoteText.trim(), currentUser, newNoteCategory);
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

  // Filter notes by category
  const filteredNotes = activeCategory === "all" 
    ? notes 
    : notes.filter(n => n.category === activeCategory);
  
  const activeNotes = filteredNotes.filter((n) => !n.done);
  const completedNotes = filteredNotes.filter((n) => n.done);

  // Get category icon for display
  const getCategoryIcon = (cat: NoteCategory) => {
    return CATEGORIES.find(c => c.key === cat)?.icon || "📋";
  };

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

      {/* Category Tabs */}
      <div className="category-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`category-tab ${activeCategory === cat.key ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            <span className="tab-icon">{cat.icon}</span>
            <span className="tab-label">{cat.label}</span>
            <span className="tab-count">
              {cat.key === "all" 
                ? notes.filter(n => !n.done).length
                : notes.filter(n => n.category === cat.key && !n.done).length
              }
            </span>
          </button>
        ))}
      </div>

      {/* Add new note */}
      <div className="add-note">
        <div className="add-note-category">
          {CATEGORIES.filter(c => c.key !== "all").map((cat) => (
            <button
              key={cat.key}
              className={`cat-btn ${newNoteCategory === cat.key ? "active" : ""}`}
              onClick={() => setNewNoteCategory(cat.key)}
              title={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>
        <div className="add-note-input">
          <input
            type="text"
            placeholder={`Yeni ${CATEGORIES.find(c => c.key === newNoteCategory)?.label.toLowerCase() || "not"} ekle...`}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddNote()}
          />
          <button onClick={handleAddNote} disabled={!newNoteText.trim()}>
            ➕
          </button>
        </div>
      </div>

      {/* Active notes */}
      {activeNotes.length > 0 && (
        <div className="notes-section">
          <h2>
            {activeCategory === "all" ? "Yapılacaklar" : CATEGORIES.find(c => c.key === activeCategory)?.label}
          </h2>
          <div className="notes-list">
            {activeNotes.map((note) => (
              <div key={note.id} className={`note-item category-${note.category || "todo"}`}>
                <button
                  className="check-btn"
                  onClick={() => handleToggle(note.id)}
                >
                  ⬜
                </button>
                <span className="note-category-icon">{getCategoryIcon(note.category || "todo")}</span>
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
              <div key={note.id} className={`note-item done category-${note.category || "todo"}`}>
                <button
                  className="check-btn"
                  onClick={() => handleToggle(note.id)}
                >
                  ✅
                </button>
                <span className="note-category-icon">{getCategoryIcon(note.category || "todo")}</span>
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

      {filteredNotes.length === 0 && (
        <div className="notes-empty">
          <p>Henüz not yok 📝</p>
          <p className="notes-hint">
            {activeCategory === "all" 
              ? "Planlarınızı ve yapılacakları buraya ekleyin!"
              : `"${CATEGORIES.find(c => c.key === activeCategory)?.label}" kategorisine not ekleyin!`
            }
          </p>
        </div>
      )}
    </div>
  );
}
