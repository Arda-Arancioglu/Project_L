import { useState, useEffect } from "react";
import PasswordGate from "./components/PasswordGate";
import Gallery from "./components/Gallery";
import Upload from "./components/Upload";
import { getPassword, clearPassword } from "./utils";
import { verifyPassword } from "./api";
import "./App.css";

type View = "loading" | "login" | "gallery" | "upload";

function App() {
  const [view, setView] = useState<View>("loading");

  useEffect(() => {
    // Check if already logged in
    const savedPw = getPassword();
    if (savedPw) {
      verifyPassword(savedPw).then((valid) => {
        setView(valid ? "gallery" : "login");
        if (!valid) clearPassword();
      });
    } else {
      setView("login");
    }
  }, []);

  if (view === "loading") {
    return (
      <div className="app-loading">
        <div className="spinner">💕</div>
      </div>
    );
  }

  if (view === "login") {
    return <PasswordGate onSuccess={() => setView("gallery")} />;
  }

  if (view === "upload") {
    return (
      <Upload
        onBack={() => setView("gallery")}
        onComplete={() => setView("gallery")}
      />
    );
  }

  return <Gallery onUploadClick={() => setView("upload")} />;
}

export default App;
