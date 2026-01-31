import React, { useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSwitchToLogin: _onSwitchToLogin,
}) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  // Walidacja wymagań hasła
  const passwordRequirements = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  }, [password]);

  const isPasswordValid = useMemo(() => {
    return Object.values(passwordRequirements).every(Boolean);
  }, [passwordRequirements]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return "Hasło musi mieć co najmniej 8 znaków";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Hasło musi zawierać co najmniej jedną wielką literę";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Hasło musi zawierać co najmniej jedną małą literę";
    }
    if (!/\d/.test(pwd)) {
      return "Hasło musi zawierać co najmniej jedną cyfrę";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      return "Hasło musi zawierać co najmniej jeden znak specjalny (!@#$%^&*(),.?\":{}|<>)";
    }
    return null;
  };

  // Walidacja emaila
  const validateEmail = (email: string): string | null => {
    if (!email.trim()) {
      return "Email jest wymagany";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Podaj poprawny adres email";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Walidacja nazwy użytkownika
    if (!username.trim()) {
      setError("Nazwa użytkownika jest wymagana.");
      return;
    }
    
    if (username.trim().length < 3) {
      setError("Nazwa użytkownika musi mieć co najmniej 3 znaki.");
      return;
    }
    
    if (username.trim().length > 50) {
      setError("Nazwa użytkownika nie może przekraczać 50 znaków.");
      return;
    }

    // Walidacja emaila
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    // Walidacja hasła
    if (password !== confirmPassword) {
      setError("Hasła nie są identyczne");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      await register(username.trim(), email.trim(), password);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Błąd podczas rejestracji. Spróbuj ponownie."
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
            placeholder="Min. 3 znaki"
            required
            minLength={3}
            maxLength={50}
            autoFocus
            style={{ color: '#ffffff' }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-300">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500"
            placeholder="twoj@email.com"
            required
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
            className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500 ${
              password && !isPasswordValid
                ? "border-red-600 focus:ring-red-500"
                : password && isPasswordValid
                ? "border-green-600"
                : "border-slate-600"
            }`}
            placeholder="Min. 8 znaków, wielka litera, cyfra, znak specjalny"
            required
            minLength={8}
            style={{ color: '#ffffff' }}
          />
          {password && (
            <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs space-y-1">
              <div className="text-slate-400 mb-1.5">Wymagania hasła:</div>
              <div className={`flex items-center gap-1.5 ${passwordRequirements.minLength ? "text-green-400" : "text-slate-500"}`}>
                <span>{passwordRequirements.minLength ? "✓" : "○"}</span>
                <span>Co najmniej 8 znaków</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordRequirements.hasUpperCase ? "text-green-400" : "text-slate-500"}`}>
                <span>{passwordRequirements.hasUpperCase ? "✓" : "○"}</span>
                <span>Wielka litera (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordRequirements.hasLowerCase ? "text-green-400" : "text-slate-500"}`}>
                <span>{passwordRequirements.hasLowerCase ? "✓" : "○"}</span>
                <span>Mała litera (a-z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordRequirements.hasNumber ? "text-green-400" : "text-slate-500"}`}>
                <span>{passwordRequirements.hasNumber ? "✓" : "○"}</span>
                <span>Cyfra (0-9)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordRequirements.hasSpecialChar ? "text-green-400" : "text-slate-500"}`}>
                <span>{passwordRequirements.hasSpecialChar ? "✓" : "○"}</span>
                <span>Znak specjalny (!@#$%^&*...)</span>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-300">
            Potwierdź hasło
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500 ${
              confirmPassword && password !== confirmPassword
                ? "border-red-600 focus:ring-red-500"
                : confirmPassword && password === confirmPassword
                ? "border-green-600"
                : "border-slate-600"
            }`}
            placeholder="Powtórz hasło"
            required
            minLength={8}
            style={{ color: '#ffffff' }}
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-1 text-xs text-red-400">Hasła nie są identyczne</p>
          )}
          {confirmPassword && password === confirmPassword && password && (
            <p className="mt-1 text-xs text-green-400">✓ Hasła są identyczne</p>
          )}
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
          {loading ? "Rejestrowanie..." : "Zarejestruj się"}
        </button>
      </form>
  );
};

