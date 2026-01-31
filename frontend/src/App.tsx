import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PasswordGate from "./components/PasswordGate";
import { Homepage } from "./components/Homepage";
import Gallery from "./components/Gallery";
import Upload from "./components/Upload";
import { Favorites } from "./components/Favorites";
import { getPassword, clearPassword, savePassword } from "./utils";
import { verifyPassword } from "./api";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState<string>("");

  useEffect(() => {
    // Check if already logged in
    const savedPw = getPassword();
    if (savedPw) {
      verifyPassword(savedPw).then((valid) => {
        if (valid) {
          setPassword(savedPw);
          setIsAuthenticated(true);
        } else {
          clearPassword();
          setIsAuthenticated(false);
        }
      });
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const handleLogin = (pw: string) => {
    savePassword(pw);
    setPassword(pw);
    setIsAuthenticated(true);
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="app-loading">
        <div className="spinner">💕</div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <PasswordGate onSuccess={handleLogin} />;
  }

  // Authenticated - show app with routes
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/gallery" element={<Gallery password={password} />} />
        <Route path="/upload" element={<Upload password={password} />} />
        <Route path="/favorites" element={<Favorites password={password} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
