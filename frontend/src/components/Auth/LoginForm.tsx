import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister: _onSwitchToRegister }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Walidacja przed wysłaniem
    if (!username.trim()) {
      setError("Nazwa użytkownika jest wymagana.");
      return;
    }
    
    if (username.trim().length < 3) {
      setError("Nazwa użytkownika musi mieć co najmniej 3 znaki.");
      return;
    }
    
    if (!password) {
      setError("Hasło jest wymagane.");
      return;
    }
    
    if (password.length < 1) {
      setError("Hasło jest wymagane.");
      return;
    }
    
    setLoading(true);

    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Błąd podczas logowania. Sprawdź dane."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-300">
            Nazwa użytkownika
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500"
            placeholder="Wprowadź nazwę użytkownika"
            required
            autoFocus
            style={{ color: '#ffffff' }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-300">
            Hasło
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500"
            placeholder="Wprowadź hasło"
            required
            style={{ color: '#ffffff' }}
          />
        </div>
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-blue-500/30"
        >
          {loading ? "Logowanie..." : "Zaloguj się"}
        </button>
      </form>
  );
};

