import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import API_URL from "../../config/api";

interface ScraperConfig {
  max_workers: number;
  request_timeout: number;
  delay_between_offers_min: number;
  delay_between_offers_max: number;
  delay_between_pages_min: number;
  delay_between_pages_max: number;
  max_offers_per_brand: number | null;
  brands_to_scrape: string[];
  date_from: string | null;
  date_to: string | null;
}

interface ScraperStats {
  total_estimated_offers: number;
  total_offers_in_database?: number;  // Opcjonalne, dla kompatybilności wstecznej
  brand_stats: Record<string, number | { in_database: number; to_scrape: number }>;
  estimated_hours: number;
  estimated_days: number;
  estimated_minutes?: number;  // Opcjonalne, dla kompatybilności wstecznej
  config: {
    brands_count: number;
    date_from: string | null;
    date_to: string | null;
    max_workers: number;
    max_offers_per_brand?: number | null;  // Opcjonalne, dla kompatybilności wstecznej
  };
}

const ALL_BRANDS = [
  "abarth", "alfa-romeo", "audi", "bmw", "chevrolet", "citroen",
  "dacia", "fiat", "ford", "honda", "hyundai", "kia", "mazda",
  "mercedes-benz", "nissan", "opel", "peugeot", "renault", "seat",
  "skoda", "toyota", "volkswagen", "volvo"
];

export const ScraperConfig: React.FC = () => {
  const { token } = useAuth();
  const [config, setConfig] = useState<ScraperConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [stats, setStats] = useState<ScraperStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [dateError, setDateError] = useState<string>("");
  const [brandSearch, setBrandSearch] = useState<string>("");

  // Funkcja pomocnicza do parsowania daty DD.MM.YYYY
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split(".");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // miesiące są 0-indexowane
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month, day);
  };

  // Konwersja DD.MM.YYYY -> YYYY-MM-DD (dla HTML5 date picker)
  const convertToDateInputFormat = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = parseDate(dateStr);
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Konwersja YYYY-MM-DD -> DD.MM.YYYY (z HTML5 date picker)
  const convertFromDateInputFormat = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00"); // dodajemy czas, żeby uniknąć problemów z timezone
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  useEffect(() => {
    if (token) {
      fetchConfig();
    }
  }, [token]);

  useEffect(() => {
    if (token && config) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, config?.brands_to_scrape, config?.date_from, config?.date_to, statsRefreshTrigger]);

  // Odśwież konfigurację i statystyki po załadowaniu komponentu (na wypadek zmian w pliku)
  useEffect(() => {
    if (token) {
      // Małe opóźnienie, aby dać czas na załadowanie komponentu
      const timeoutId = setTimeout(() => {
        fetchConfig().then(() => {
          // Po pobraniu konfiguracji, odśwież statystyki
          setStatsRefreshTrigger(prev => prev + 1);
        });
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [token]);

  const fetchConfig = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/scraper/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(res.data);
      setError("");
    } catch (error: any) {
      console.error("Error fetching config:", error);
      setError("Błąd podczas pobierania konfiguracji");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    
    setLoadingStats(true);
    try {
      const res = await axios.get(`${API_URL}/admin/scraper/config/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      // Nie pokazujemy błędu, bo to tylko statystyki
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSave = async () => {
    if (!token || !config) return;
    
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      await axios.post(`${API_URL}/admin/scraper/config`, config, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess("Konfiguracja zapisana pomyślnie!");
      setTimeout(() => setSuccess(""), 3000);
      
      // Wymuś odświeżenie statystyk po zapisaniu
      setStatsRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Błąd podczas zapisywania konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    if (!token) return;
    
    setShowResetConfirm(false);
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/scraper/config/default`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(res.data);
      setSuccess("Przywrócono domyślne ustawienia");
      setTimeout(() => setSuccess(""), 3000);
      
      // Wymuś odświeżenie statystyk po przywróceniu domyślnych
      setStatsRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      setError("Błąd podczas pobierania domyślnych ustawień");
    } finally {
      setLoading(false);
    }
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  const toggleBrand = (brand: string) => {
    if (!config) return;
    const newBrands = config.brands_to_scrape.includes(brand)
      ? config.brands_to_scrape.filter(b => b !== brand)
      : [...config.brands_to_scrape, brand];
    setConfig({ ...config, brands_to_scrape: newBrands });
  };

  const selectAllBrands = () => {
    if (!config) return;
    setConfig({ ...config, brands_to_scrape: [...ALL_BRANDS] });
  };

  const deselectAllBrands = () => {
    if (!config) return;
    setConfig({ ...config, brands_to_scrape: [] });
  };

  const getFilteredBrands = () => {
    if (!brandSearch.trim()) return ALL_BRANDS;
    const search = brandSearch.toLowerCase().trim();
    return ALL_BRANDS.filter(brand => 
      brand.toLowerCase().includes(search) || 
      brand.replace("-", " ").toLowerCase().includes(search)
    );
  };

  if (loading && !config) {
    return (
      <div className="rounded-lg bg-slate-800 p-6">
        <p className="text-slate-400">Ładowanie konfiguracji...</p>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="rounded-lg bg-slate-800 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Konfiguracja scrapera</h2>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            Domyślne
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 text-sm font-medium"
          >
            {saving ? "Zapisywanie..." : "Zapisz"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded text-sm text-green-300">
          {success}
        </div>
      )}

      {/* Podgląd statystyk */}
      {stats && (
        <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
          <h3 className="text-sm font-semibold mb-3">📊 Podgląd przed uruchomieniem</h3>
          {loadingStats ? (
            <p className="text-xs text-slate-400">Ładowanie statystyk...</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Liczba ofert do pobrania:</span>
                  <span className="font-semibold text-blue-400">
                    {stats.total_estimated_offers.toLocaleString('pl-PL')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Szacowany czas:</span>
                  <span className="font-semibold text-blue-400">
                    {stats.estimated_days >= 1
                      ? `${stats.estimated_days.toFixed(1)} dni`
                      : stats.estimated_hours >= 1
                      ? `${stats.estimated_hours.toFixed(1)} godzin`
                      : stats.estimated_minutes
                      ? `${stats.estimated_minutes.toFixed(1)} minut`
                      : `${(stats.estimated_hours * 60).toFixed(1)} minut`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Wybrane marki:</span>
                  <span className="font-semibold">{stats.config.brands_count}</span>
                </div>
                {stats.config.max_offers_per_brand ? (
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Limit na markę:</span>
                    <span className="font-semibold">{stats.config.max_offers_per_brand.toLocaleString('pl-PL')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Limit na markę:</span>
                    <span className="font-semibold text-green-400">Brak limitu</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                {stats.config.date_from || stats.config.date_to ? (
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Zakres dat:</span>
                    <span className="font-semibold">
                      {stats.config.date_from || "początek"} - {stats.config.date_to || "koniec"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Filtrowanie dat:</span>
                    <span className="font-semibold text-green-400">Wyłączone</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">
            * Statystyki oparte na danych z bazy. Rzeczywista liczba może się różnić.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* MAX_WORKERS */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Liczba równoległych wątków (MAX_WORKERS)
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={config.max_workers}
            onChange={(e) => setConfig({ ...config, max_workers: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">
            Więcej wątków = szybsze scrapowanie, ale większe obciążenie serwera
          </p>
        </div>

        {/* REQUEST_TIMEOUT */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Timeout żądań HTTP (sekundy)
          </label>
          <input
            type="number"
            min="5"
            max="60"
            value={config.request_timeout}
            onChange={(e) => setConfig({ ...config, request_timeout: parseInt(e.target.value) || 15 })}
            className="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        {/* DELAY_BETWEEN_OFFERS */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Opóźnienie między ofertami (sekundy)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Min</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5.0"
                value={config.delay_between_offers_min}
                onChange={(e) => setConfig({ ...config, delay_between_offers_min: parseFloat(e.target.value) || 0.4 })}
                className="w-full px-3 py-2 bg-slate-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Max</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5.0"
                value={config.delay_between_offers_max}
                onChange={(e) => setConfig({ ...config, delay_between_offers_max: parseFloat(e.target.value) || 0.8 })}
                className="w-full px-3 py-2 bg-slate-700 rounded text-sm"
              />
            </div>
          </div>
        </div>

        {/* DELAY_BETWEEN_PAGES */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Opóźnienie między stronami (sekundy)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Min</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10.0"
                value={config.delay_between_pages_min}
                onChange={(e) => setConfig({ ...config, delay_between_pages_min: parseFloat(e.target.value) || 1.0 })}
                className="w-full px-3 py-2 bg-slate-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Max</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10.0"
                value={config.delay_between_pages_max}
                onChange={(e) => setConfig({ ...config, delay_between_pages_max: parseFloat(e.target.value) || 2.0 })}
                className="w-full px-3 py-2 bg-slate-700 rounded text-sm"
              />
            </div>
          </div>
        </div>

        {/* MAX_OFFERS_PER_BRAND */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Limit ofert na markę
          </label>
          <input
            type="number"
            min="1"
            value={config.max_offers_per_brand || ""}
            onChange={(e) => setConfig({ 
              ...config, 
              max_offers_per_brand: e.target.value ? parseInt(e.target.value) : null 
            })}
            placeholder="Brak limitu"
            className="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">
            Pozostaw puste dla pełnego scrapowania (bez limitu)
          </p>
        </div>

        {/* Zakres dat publikacji */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Zakres dat publikacji ogłoszeń
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Od</label>
              <input
                type="date"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-slate-200"
                value={config.date_from ? convertToDateInputFormat(config.date_from) : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    setConfig({ 
                      ...config, 
                      date_from: null 
                    });
                    setDateError("");
                    return;
                  }
                  
                  const convertedValue = convertFromDateInputFormat(value);
                  setConfig({ 
                    ...config, 
                    date_from: convertedValue 
                  });
                  
                  // Walidacja
                  const inputDate = parseDate(convertedValue);
                  if (inputDate) {
                    // Walidacja: sprawdź czy data "od" nie jest nowsza niż data "do"
                    if (config.date_to) {
                      const toDate = parseDate(config.date_to);
                      if (toDate && inputDate > toDate) {
                        setDateError(`Data "od" nie może być nowsza niż data "do"`);
                        return;
                      }
                    }
                    
                    // Jeśli wszystkie walidacje przeszły, wyczyść błąd
                    setDateError("");
                  }
                }}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Do</label>
              <input
                type="date"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-slate-200"
                value={config.date_to ? convertToDateInputFormat(config.date_to) : ""}
                min={config.date_from ? convertToDateInputFormat(config.date_from) : undefined}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    setConfig({ 
                      ...config, 
                      date_to: null 
                    });
                    setDateError("");
                    return;
                  }
                  
                  const convertedValue = convertFromDateInputFormat(value);
                  setConfig({ 
                    ...config, 
                    date_to: convertedValue 
                  });
                  
                  // Walidacja
                  const inputDate = parseDate(convertedValue);
                  if (inputDate) {
                    // Walidacja: sprawdź czy data "do" nie jest starsza niż data "od"
                    if (config.date_from) {
                      const fromDate = parseDate(config.date_from);
                      if (fromDate && inputDate < fromDate) {
                        setDateError(`Data "do" nie może być starsza niż data "od"`);
                        return;
                      }
                    }
                    
                    // Jeśli wszystkie walidacje przeszły, wyczyść błąd
                    setDateError("");
                  }
                }}
              />
            </div>
          </div>
          {dateError && (
            <p className="text-xs text-red-400 mt-1">
              {dateError}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            Pozostaw puste dla wszystkich dat.
          </p>
          {config.date_from && config.date_to && (
            <p className="text-xs text-yellow-400 mt-1">
              ⚠️ Uwaga: Filtrowanie po datach może znacznie wydłużyć czas scrapowania, 
              ponieważ scraper musi sprawdzić każdą ofertę.
            </p>
          )}
        </div>

        {/* BRANDS_TO_SCRAPE */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">
              Marki do scrapowania ({config.brands_to_scrape.length} / {ALL_BRANDS.length})
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllBrands}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
              >
                Wszystkie
              </button>
              <button
                type="button"
                onClick={deselectAllBrands}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
              >
                Żadne
              </button>
            </div>
          </div>

          {/* Wyszukiwarka */}
          <div className="mb-2" style={{ margin: '10px 0px' }}>
            <input
              type="text"
              placeholder="Szukaj marki..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500"
            />
          </div>

          {/* Lista marek */}
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/50 rounded">
            {getFilteredBrands().length > 0 ? (
              getFilteredBrands().map((brand) => (
                <label 
                  key={brand} 
                  className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-400 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={config.brands_to_scrape.includes(brand)}
                    onChange={() => toggleBrand(brand)}
                    className="rounded"
                  />
                  <span className="capitalize">{brand.replace("-", " ")}</span>
                </label>
              ))
            ) : (
              <div className="col-span-full text-center text-slate-500 text-xs py-2">
                Brak wyników
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal potwierdzenia resetu */}
      {showResetConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={cancelReset}
        >
          <div
            className="rounded-lg bg-slate-800 p-6 border border-slate-700"
            style={{
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3">Przywrócić domyślne ustawienia?</h3>
            <p className="text-sm text-slate-400 mb-6">
              Wszystkie zmiany w konfiguracji zostaną utracone i zastąpione domyślnymi wartościami.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelReset}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors font-medium"
              >
                Przywróć
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

