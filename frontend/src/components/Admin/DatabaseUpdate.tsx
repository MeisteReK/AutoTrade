import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import API_URL from "../../config/api";

interface UpdateStatus {
  id?: string;
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  current_step: string | null;
  progress_percent: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  steps_completed: string[];
  steps_failed: string[];
  steps_to_run?: string[];
  start_step?: string;
  n_offers_scraped?: number | null;
  duration_hours?: number;
  is_running: boolean;
  can_start_new: boolean;
}

interface UpdateHistoryRecord extends UpdateStatus {
  duration_seconds?: number;
}

interface ScraperConfig {
  max_offers_per_brand: number | null;
  brands_to_scrape: string[];
}

export const DatabaseUpdate: React.FC = () => {
  const { token } = useAuth();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [history, setHistory] = useState<UpdateHistoryRecord[]>([]);
  const [scraperConfig, setScraperConfig] = useState<ScraperConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [selectedOption, setSelectedOption] = useState<string>("scraping_and_update"); // "scraping_and_update" | "scraping_only" | "update_only"
  const [showModal, setShowModal] = useState<{type: 'start' | 'cancel' | 'reset' | 'delete_history' | null, message?: string, recordId?: string}>({type: null});
  const [showHistory, setShowHistory] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{stats?: any, error?: string} | null>(null);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLimit] = useState(10);

  useEffect(() => {
    if (token) {
      fetchStatus();
      fetchHistory();
      fetchScraperConfig();
    }
  }, [token]);

  // Osobny polling z dynamicznym interwałem
  useEffect(() => {
    if (!token) return;

    const pollInterval = status?.status === "running" ? 5000 : 30000; // 5s gdy działa, 30s gdy idle
    const interval = setInterval(() => {
      fetchStatus();
      if (status?.status !== "running") {
        fetchHistory();
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [token, status?.status]);

  const fetchStatus = async () => {
    if (!token) return;
    
    try {
      const res = await axios.get(`${API_URL}/admin/database/update-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(res.data);
      setError("");
    } catch (error: any) {
      console.error("Error fetching status:", error);
      setError("Błąd podczas pobierania statusu");
    }
  };

  const fetchHistory = async (offset: number = 0) => {
    if (!token) return;
    
    try {
      const res = await axios.get(`${API_URL}/admin/database/update-history?limit=${historyLimit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data.history || []);
      setHistoryTotal(res.data.total || 0);
      setHistoryOffset(offset);
    } catch (error: any) {
      console.error("Error fetching history:", error);
    }
  };

  const handleDeleteHistoryRecord = (recordId: string) => {
    setShowModal({
      type: 'delete_history',
      message: 'Czy na pewno chcesz usunąć ten rekord z historii?',
      recordId: recordId
    });
  };

  const executeDeleteHistory = async () => {
    if (!token || !showModal.recordId) return;
    
    setLoading(true);
    setError("");
    
    try {
      await axios.delete(`${API_URL}/admin/database/update-history/${showModal.recordId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Odśwież historię
      fetchHistory(historyOffset);
      setShowModal({type: null});
      setError("");
    } catch (error: any) {
      console.error("Error deleting history record:", error);
      setError("Błąd podczas usuwania rekordu: " + (error.response?.data?.detail || error.message));
      setShowModal({type: null});
    } finally {
      setLoading(false);
    }
  };

  const fetchScraperConfig = async () => {
    if (!token) return;
    
    try {
      const res = await axios.get(`${API_URL}/admin/scraper/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScraperConfig({
        max_offers_per_brand: res.data.max_offers_per_brand,
        brands_to_scrape: res.data.brands_to_scrape || []
      });
    } catch (error: any) {
      console.error("Error fetching scraper config:", error);
    }
  };

  const isLongScrapingProcess = (): boolean => {
    // Jeśli nie ma scrapowania w wybranej opcji, nie jest to długi proces
    if (selectedOption !== "scraping_and_update" && selectedOption !== "scraping_only") {
      return false;
    }

    // Jeśli nie mamy konfiguracji, zakładamy że to długi proces (bezpieczne założenie)
    if (!scraperConfig) {
      return true;
    }

    const brandsCount = scraperConfig.brands_to_scrape?.length || 0;
    const maxOffers = scraperConfig.max_offers_per_brand;

    // Jeśli jest limit ofert i jest mało marek, to nie jest długi proces
    if (maxOffers !== null && maxOffers !== undefined && maxOffers > 0) {
      // Jeśli jest tylko 1 marka i max 10 ofert, to szybki proces
      if (brandsCount === 1 && maxOffers <= 10) {
        return false;
      }
      // Jeśli jest kilka marek ale mały limit (np. 10 ofert na markę), sprawdźmy całkowitą liczbę
      const totalOffers = brandsCount * maxOffers;
      if (totalOffers <= 50) {
        return false; // Mniej niż 50 ofert to szybki proces
      }
    }

    // Jeśli jest wiele marek bez limitu, to długi proces
    if (brandsCount > 5 && (maxOffers === null || maxOffers === undefined || maxOffers === 0)) {
      return true;
    }

    // Domyślnie zakładamy że to długi proces jeśli jest więcej niż 3 marki lub brak limitu
    return brandsCount > 3 || maxOffers === null || maxOffers === undefined || maxOffers === 0;
  };

  const handleStartUpdate = () => {
    if (!selectedOption) {
      setError("Wybierz opcję");
      return;
    }
    
    // Mapuj opcję na tekst opcji
    let optionsText = "";
    
    if (selectedOption === "scraping_and_update") {
      optionsText = "scrapowanie i aktualizację bazy danych";
    } else if (selectedOption === "scraping_only") {
      optionsText = "scrapowanie (bez aktualizacji bazy)";
    } else if (selectedOption === "update_only") {
      // Dla update_only nie uruchamiamy procesu - użytkownik użyje sekcji importu CSV poniżej
      // Sekcja importu jest widoczna tylko gdy wybrano opcję 3
      return;
    }
    
    const isLongProcess = selectedOption !== "update_only" && isLongScrapingProcess();
    const configInfo = scraperConfig && (selectedOption === "scraping_and_update" || selectedOption === "scraping_only")
      ? ` (${scraperConfig.brands_to_scrape?.length || 0} ${scraperConfig.brands_to_scrape?.length === 1 ? 'marka' : 'marek'}${scraperConfig.max_offers_per_brand ? `, max ${scraperConfig.max_offers_per_brand} ofert/marka` : ''})`
      : '';
    
    const message = isLongProcess
      ? `Uruchomić ${optionsText}?${configInfo} Proces może trwać do 2 dni. Upewnij się, że serwer będzie działał przez cały czas.`
      : `Uruchomić ${optionsText}?${configInfo}`;
    setShowModal({type: 'start', message});
  };

  const handleCancelUpdate = () => {
    setShowModal({type: 'cancel', message: 'Czy na pewno chcesz anulować uruchomiony proces aktualizacji? Proces zostanie przerwany.'});
  };

  const executeModalAction = async () => {
    if (!token || !showModal.type) return;
    
    setLoading(true);
    setError("");
    
    try {
      if (showModal.type === 'start') {
        // Mapuj opcję na steps_to_run
        let stepsToRun: string[] = [];
        
        if (selectedOption === "scraping_and_update") {
          stepsToRun = ["scraping", "processing", "database_update"];
        } else if (selectedOption === "scraping_only") {
          stepsToRun = ["scraping"];
        }
        
        await axios.post(`${API_URL}/admin/database/full-update`, {
          start_step: "scraping",
          steps_to_run: stepsToRun.length > 0 ? stepsToRun : undefined
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await fetchStatus();
      } else if (showModal.type === 'delete_history') {
        await executeDeleteHistory();
        return; // executeDeleteHistory już obsługuje loading i błędy
      } else if (showModal.type === 'cancel') {
        await axios.post(`${API_URL}/admin/database/cancel-update`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await fetchStatus();
      } else if (showModal.type === 'reset') {
        const force = status?.status === "running";
        try {
          await axios.post(`${API_URL}/admin/database/reset-status?force=${force}`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error: any) {
          if (error.response?.data?.detail?.includes("force")) {
            await axios.post(`${API_URL}/admin/database/reset-status?force=true`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
          } else {
            throw error;
          }
        }
        await fetchStatus();
      }
      setShowModal({type: null});
      setError("");
    } catch (error: any) {
      setError(error.response?.data?.detail || `Błąd podczas ${showModal.type === 'start' ? 'uruchamiania' : showModal.type === 'cancel' ? 'anulowania' : 'resetowania'} aktualizacji`);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal({type: null});
  };

  const getStepName = (step: string | null) => {
    const names: Record<string, string> = {
      scraping: "Scrapowanie otomoto.pl",
      processing: "Przetwarzanie danych", // Ukryte w UI, ale nadal wykonywane
      database_update: "Aktualizacja bazy danych",
    };
    return names[step || ""] || step || "Oczekiwanie...";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-blue-400";
      case "completed":
        return "text-green-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-slate-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "running":
        return "W trakcie";
      case "completed":
        return "Zakończone";
      case "failed":
        return "Błąd";
      case "cancelled":
        return "Anulowane";
      default:
        return "Oczekiwanie";
    }
  };

  if (!status) {
    return (
      <div className="rounded-lg bg-slate-800 p-6">
        <p className="text-slate-400">Ładowanie statusu...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-slate-800 p-6">
      <h2 className="text-xl font-semibold mb-4">Aktualizacja bazy danych</h2>

      {/* Status i etapy - tylko gdy proces działa */}
      {status.status === "running" && (
      <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-300">Status:</span>
          <span className={`text-lg font-bold ${getStatusColor(status.status)}`}>
            {getStatusText(status.status)}
          </span>
        </div>

        {/* Postęp - tylko gdy działa */}
        {status.status === "running" && (
          <div className="mb-4">
            <div className="w-full bg-slate-600 rounded-full h-6 mb-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-6 rounded-full transition-all duration-500 flex items-center justify-center text-xs font-semibold text-white"
                style={{ width: `${status.progress_percent}%`, minWidth: status.progress_percent > 0 ? '40px' : '0' }}
              >
                {status.progress_percent > 5 && `${status.progress_percent}%`}
              </div>
            </div>
            <div className="text-sm font-medium text-slate-300 text-center">
              {getStepName(status.current_step)}
            </div>
          </div>
        )}

        {/* Etapy - zawsze widoczne */}
        <div className="mb-3">
          <div className="text-xs text-slate-400 mb-2">Etapy:</div>
          <div className="flex gap-3">
            {["scraping", "database_update"].map((step) => {
              const isCompleted = status.steps_completed.includes(step);
              const isFailed = status.steps_failed.includes(step);
              const isCurrent = status.current_step === step;
              
              return (
                <div 
                  key={step} 
                  className={`flex-1 flex items-center gap-2 p-2 rounded text-xs ${
                    isCurrent ? 'bg-blue-900/30 border border-blue-700' :
                    isCompleted ? 'bg-green-900/20 border border-green-700/50' :
                    isFailed ? 'bg-red-900/30 border border-red-700' :
                    'bg-slate-700/30 border border-slate-600'
                  }`}
                >
                  <span className={`text-lg ${
                    isCompleted ? "text-green-400" :
                    isFailed ? "text-red-400" :
                    isCurrent ? "text-blue-400 animate-pulse" :
                    "text-slate-500"
                  }`}>
                    {isCompleted ? "✓" : isFailed ? "✗" : isCurrent ? "⟳" : "○"}
                  </span>
                  <span className="font-medium">
                    {getStepName(step)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Informacje - kompaktowe */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 border-t border-slate-600 pt-3">
          {status.started_at && (
            <div><span className="font-medium">Start:</span> {new Date(status.started_at).toLocaleString("pl-PL", {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</div>
          )}
          {status.duration_hours && status.status === "running" && (
            <div><span className="font-medium">Czas:</span> {status.duration_hours.toFixed(1)} h</div>
          )}
          {status.n_offers_scraped !== null && status.n_offers_scraped !== undefined && (
            <div className="col-span-2"><span className="font-medium">Oferty:</span> {status.n_offers_scraped.toLocaleString("pl-PL")}</div>
          )}
        </div>
      </div>
      )}

      {/* Podsumowanie po zakończeniu procesu */}
      {status.status === "completed" && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400 text-lg">✓</span>
            <span className="text-green-400 font-semibold">Proces zakończony pomyślnie</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            {status.completed_at && (
              <div><span className="font-medium">Zakończono:</span> {new Date(status.completed_at).toLocaleString("pl-PL", {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</div>
            )}
            {status.n_offers_scraped !== null && status.n_offers_scraped !== undefined && (
              <div><span className="font-medium">Zescrapowane oferty:</span> {status.n_offers_scraped.toLocaleString("pl-PL")}</div>
            )}
            {status.steps_completed && status.steps_completed.length > 0 && (
              <div className="col-span-2"><span className="font-medium">Wykonane etapy:</span> {status.steps_completed.map(s => getStepName(s)).join(", ")}</div>
            )}
          </div>
        </div>
      )}

      {status.status === "cancelled" && (
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-lg">⚠</span>
            <span className="text-yellow-400 font-semibold">Proces został anulowany</span>
          </div>
          {status.completed_at && (
            <div className="text-xs text-slate-400">
              <span className="font-medium">Anulowano:</span> {new Date(status.completed_at).toLocaleString("pl-PL", {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}
            </div>
          )}
        </div>
      )}

      {status.status === "failed" && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400 text-lg">✗</span>
            <span className="text-red-400 font-semibold">Proces zakończony błędem</span>
          </div>
          {status.error_message && (
            <div className="text-xs text-red-300 mt-1 break-words">
              {status.error_message}
            </div>
          )}
        </div>
      )}

      {/* Błędy bieżące (z frontendu) */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
          <strong>Błąd:</strong> {error}
        </div>
      )}

      {/* Opcje - widoczne gdy nie działa proces */}
      {status.status !== "running" && (
        <div className="mb-6">
          <div className="text-sm font-medium mb-4 text-slate-300">Wybierz opcję:</div>
          <div className="space-y-3">
            {/* Opcja 1 */}
            <label 
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedOption === "scraping_and_update" 
                  ? "border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-900/20" 
                  : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/40 bg-slate-700/30"
              }`}
            >
              <input
                type="radio"
                name="updateOption"
                value="scraping_and_update"
                checked={selectedOption === "scraping_and_update"}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="hidden"
              />
              <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-all ${
                selectedOption === "scraping_and_update"
                  ? "border-blue-400 bg-blue-500 text-white"
                  : "border-slate-500 bg-slate-600 text-slate-400"
              }`}>
                {selectedOption === "scraping_and_update" ? "✓" : "1"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🔄</span>
                  <span className="font-semibold text-slate-200">Scrapowanie + Aktualizacja bazy</span>
                </div>
                <div className="text-xs text-slate-400 ml-7">Pełny proces: scrapowanie, przetwarzanie i aktualizacja bazy</div>
              </div>
            </label>

            {/* Opcja 2 */}
            <label 
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedOption === "scraping_only" 
                  ? "border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-900/20" 
                  : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/40 bg-slate-700/30"
              }`}
            >
              <input
                type="radio"
                name="updateOption"
                value="scraping_only"
                checked={selectedOption === "scraping_only"}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="hidden"
              />
              <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-all ${
                selectedOption === "scraping_only"
                  ? "border-blue-400 bg-blue-500 text-white"
                  : "border-slate-500 bg-slate-600 text-slate-400"
              }`}>
                {selectedOption === "scraping_only" ? "✓" : "2"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">📥</span>
                  <span className="font-semibold text-slate-200">Tylko scrapowanie</span>
                </div>
                <div className="text-xs text-slate-400 ml-7">Plik CSV: otomoto-webscrape/scraped_data/&lt;marka&gt;.csv</div>
              </div>
            </label>

            {/* Opcja 3 */}
            <label 
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedOption === "update_only" 
                  ? "border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-900/20" 
                  : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/40 bg-slate-700/30"
              }`}
            >
              <input
                type="radio"
                name="updateOption"
                value="update_only"
                checked={selectedOption === "update_only"}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="hidden"
              />
              <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-all ${
                selectedOption === "update_only"
                  ? "border-blue-400 bg-blue-500 text-white"
                  : "border-slate-500 bg-slate-600 text-slate-400"
              }`}>
                {selectedOption === "update_only" ? "✓" : "3"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">📤</span>
                  <span className="font-semibold text-slate-200">Import CSV do bazy</span>
                </div>
                <div className="text-xs text-slate-400 ml-7">Wgraj plik CSV z wcześniejszego scrapowania</div>
              </div>
            </label>

            {/* Import CSV - pod opcją 3 */}
            {selectedOption === "update_only" && (
              <div className="mt-3 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-2 text-slate-300">Wybierz plik CSV:</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setImportFile(file || null);
                      setImportResult(null);
                    }}
                    className="w-full px-3 py-2 bg-slate-700 rounded text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  />
                </div>

                {importFile && (
                  <div className="mb-3 text-sm text-slate-400">
                    {importFile.name} ({(importFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (!importFile || !token) return;
                    setImporting(true);
                    setImportResult(null);
                    try {
                      const formData = new FormData();
                      formData.append('file', importFile);
                      const res = await axios.post(`${API_URL}/admin/database/import-csv`, formData, {
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                      });
                      setImportResult({ stats: res.data.stats });
                      setImportFile(null);
                      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                      if (fileInput) fileInput.value = '';
                    } catch (error: any) {
                      setImportResult({ error: error.response?.data?.detail || "Błąd podczas importu" });
                    } finally {
                      setImporting(false);
                    }
                  }}
                  disabled={!importFile || importing}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {importing ? "Importowanie..." : "Importuj do bazy"}
                </button>

                {importResult && (
                  <div className={`mt-3 p-3 rounded text-sm ${
                    importResult.error 
                      ? "bg-red-900/30 border border-red-700 text-red-300" 
                      : "bg-green-900/30 border border-green-700 text-green-300"
                  }`}>
                    {importResult.error ? (
                      <div><strong>Błąd:</strong> {importResult.error}</div>
                    ) : (
                      <div>
                        <strong>✓ Import zakończony!</strong>
                        {importResult.stats && (
                          <div className="mt-2 text-xs">
                            Nowe: {importResult.stats.inserted} | 
                            Zaktualizowane: {importResult.stats.updated} | 
                            Łącznie: {importResult.stats.total_processed}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Przyciski - uproszczone */}
      <div className="flex flex-wrap gap-2">
        {status.status !== "running" && selectedOption !== "update_only" && (
          <button
            onClick={handleStartUpdate}
            disabled={loading || !status.can_start_new}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 text-sm font-medium"
          >
            {loading ? "Uruchamianie..." : "Uruchom"}
          </button>
        )}

        {status.status === "running" && (
          <button
            onClick={handleCancelUpdate}
            disabled={loading}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 text-sm font-medium"
          >
            Anuluj
          </button>
        )}

        <button
          onClick={fetchStatus}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
        >
          Odśwież
        </button>

        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) fetchHistory(0);
          }}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
        >
          {showHistory ? "Ukryj historię" : "Historia"}
        </button>
      </div>

      {/* Info - tylko gdy działa */}
      {status.status === "running" && (
        <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded text-sm text-blue-300">
          ℹ️ Proces działa w tle. Możesz zamknąć tę stronę - status będzie dostępny po powrocie.
        </div>
      )}

      {/* Uniwersalny modal */}
      {showModal.type && (
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
          onClick={closeModal}
        >
          <div
            className="rounded-lg bg-slate-800 p-6 border border-slate-700"
            style={{
              maxWidth: '450px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3">
              {showModal.type === 'start' && 'Uruchomić aktualizację?'}
              {showModal.type === 'cancel' && 'Anulować proces?'}
              {showModal.type === 'reset' && (status?.status === "running" ? "Wymusić reset statusu?" : "Resetować status?")}
              {showModal.type === 'delete_history' && 'Usunąć rekord z historii?'}
            </h3>
            <p className="text-sm text-slate-400 mb-6 whitespace-pre-line">
              {showModal.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={executeModalAction}
                disabled={loading || (showModal.type === 'start' && !selectedOption)}
                className={`px-4 py-2 rounded text-sm text-white transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  showModal.type === 'start' ? 'bg-blue-600 hover:bg-blue-700' :
                  showModal.type === 'cancel' ? 'bg-red-600 hover:bg-red-700' :
                  showModal.type === 'delete_history' ? 'bg-red-600 hover:bg-red-700' :
                  status?.status === "running" ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading 
                  ? (showModal.type === 'start' ? 'Uruchamianie...' : 
                     showModal.type === 'cancel' ? 'Anulowanie...' : 
                     showModal.type === 'delete_history' ? 'Usuwanie...' :
                     'Resetowanie...')
                  : (showModal.type === 'start' ? 'Uruchom' :
                     showModal.type === 'cancel' ? 'Tak, anuluj' :
                     showModal.type === 'delete_history' ? 'Tak, usuń' :
                     status?.status === "running" ? 'Wymuś reset' : 'Resetuj')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historia - accordion */}
      {showHistory && (
        <div className="mt-6 border-t border-slate-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">
              Historia ({historyTotal})
            </h3>
            {history.length > 0 && (
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => fetchHistory(Math.max(0, historyOffset - historyLimit))}
                  disabled={historyOffset === 0}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Poprzednia
                </button>
                <span className="px-2 py-1 text-slate-400">
                  {historyOffset + 1}-{Math.min(historyOffset + historyLimit, historyTotal)} z {historyTotal}
                </span>
                <button
                  onClick={() => fetchHistory(historyOffset + historyLimit)}
                  disabled={historyOffset + historyLimit >= historyTotal}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Następna →
                </button>
              </div>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">Brak historii</p>
          ) : (
            <div className="space-y-2">
              {history.map((record: any) => (
                <div key={record.id || record.started_at} className="p-3 bg-slate-700/30 rounded border border-slate-600">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${getStatusColor(record.status)}`}>
                          {getStatusText(record.status)}
                        </span>
                        {record.import_type === "csv_upload" && (
                          <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">
                            Import CSV
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {record.started_at && new Date(record.started_at).toLocaleString("pl-PL", {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}
                      </div>
                    </div>
                    {record.id && (
                      <button
                        onClick={() => handleDeleteHistoryRecord(record.id)}
                        className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded transition-colors"
                        title="Usuń rekord"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    {record.import_type === "csv_upload" ? (
                      <>
                        {record.import_filename && (
                          <span className="text-slate-300">📄 {record.import_filename}</span>
                        )}
                        {record.import_stats && (
                          <>
                            <span>Nowe: {record.import_stats.inserted || 0}</span>
                            <span>Zaktualizowane: {record.import_stats.updated || 0}</span>
                            <span className="text-green-400">✓ Baza zaktualizowana</span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {record.scraped_brands && record.scraped_brands.length > 0 && (
                          <span className="text-slate-300">
                            Marki: {record.scraped_brands.join(", ")}
                          </span>
                        )}
                        {record.n_offers_scraped !== null && record.n_offers_scraped !== undefined && (
                          <span>Oferty: {record.n_offers_scraped.toLocaleString("pl-PL")}</span>
                        )}
                        {record.duration_hours && (
                          <span>Czas: {record.duration_hours.toFixed(1)}h</span>
                        )}
                        {record.steps_completed?.includes("database_update") && (
                          <span className="text-green-400">✓ Baza zaktualizowana</span>
                        )}
                        {record.steps_completed?.includes("scraping") && !record.steps_completed?.includes("database_update") && (
                          <span className="text-blue-400">✓ Tylko scrapowanie</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

