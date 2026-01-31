import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PasswordGate from "./components/PasswordGate";
import { RoleSelect } from "./components/RoleSelect";
import { Homepage } from "./components/Homepage";
import Gallery from "./components/Gallery";
import Upload from "./components/Upload";
import { Favorites } from "./components/Favorites";
import { Discover } from "./components/Discover";
import { RecycleBin } from "./components/RecycleBin";
import { Notes } from "./components/Notes";
import { getPassword, clearPassword, savePassword, getRole, saveRole } from "./utils";
import { verifyPassword } from "./api";
import type { Uploader } from "./types";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<Uploader | null>(null);

  useEffect(() => {
    // Check if already logged in
    const savedPw = getPassword();
    const savedRole = getRole() as Uploader | null;
    
    if (savedPw) {
      verifyPassword(savedPw).then((valid) => {
        if (valid) {
          setPassword(savedPw);
          setIsAuthenticated(true);
          if (savedRole === "arda" || savedRole === "askim") {
            setCurrentUser(savedRole);
          }
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

  const handleRoleSelect = (role: Uploader) => {
    saveRole(role);
    setCurrentUser(role);
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

  // Authenticated but no role selected
  if (!currentUser) {
    return <RoleSelect onSelect={handleRoleSelect} />;
  }

  // Authenticated with role - show app with routes
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage currentUser={currentUser} password={password} />} />
        <Route path="/gallery" element={<Gallery password={password} currentUser={currentUser} />} />
        <Route path="/upload" element={<Upload password={password} currentUser={currentUser} />} />
        <Route path="/favorites" element={<Favorites password={password} currentUser={currentUser} />} />
        <Route path="/discover" element={<Discover password={password} currentUser={currentUser} />} />
        <Route path="/recycle" element={<RecycleBin password={password} currentUser={currentUser} />} />
        <Route path="/notes" element={<Notes password={password} currentUser={currentUser} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
