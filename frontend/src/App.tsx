import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { DatabaseUpdate } from "./components/Admin/DatabaseUpdate";
import { ScraperConfig } from "./components/Admin/ScraperConfig";
import { useAuth } from "./context/AuthContext";
import { LoginForm } from "./components/Auth/LoginForm";
import { RegisterForm } from "./components/Auth/RegisterForm";
import { SavedTab } from "./components/SavedTab";
import { FiltersSidebar } from "./components/FiltersSidebar";
import { OverviewTab } from "./components/Tabs/OverviewTab";
import { AnalyticsTab } from "./components/Tabs/AnalyticsTab";
import { ValuationTab } from "./components/Tabs/ValuationTab";
import { CompareTab } from "./components/Tabs/CompareTab";
import type {
  AnalysisResult,
  PriceStatistics,
  Listing,
  ListingsResponse,
  TrendPoint,
  TrendResponse,
  PriceMileagePoint,
  PriceMileageResponse,
  PriceStatsByCategoryResponse,
} from "./types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
);

// ====== Funkcje pomocnicze ======


// ====== Ustawienia API ======
import API_URL from "./config/api";
const PAGE_SIZE = 50;

const App: React.FC = () => {
  // filtry (sidebar)
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [generations, setGenerations] = useState<string[]>([]);
  const [displacements, setDisplacements] = useState<number[]>([]);
  const [fuelTypesByModel, setFuelTypesByModel] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedGeneration, setSelectedGeneration] = useState<string>("");
  const [selectedFuelType, setSelectedFuelType] = useState<string>("");
  const [yearMin, setYearMin] = useState<string>("");
  const [yearMax, setYearMax] = useState<string>("");
  const [mileageMax, setMileageMax] = useState<string>("");
  const [displacementMin, setDisplacementMin] = useState<string>("");
  const [displacementMax, setDisplacementMax] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ min_date: string | null; max_date: string | null } | null>(null);

  // dane z API
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [totalListings, setTotalListings] = useState<number>(0);

  // dane do analiz zaawansowanych
  const [priceMileageData, setPriceMileageData] = useState<PriceMileagePoint[]>([]);
  const [priceStatsByCategory, setPriceStatsByCategory] = useState<PriceStatsByCategoryResponse | null>(null);
  const [priceStatistics, setPriceStatistics] = useState<PriceStatistics | null>(null);

  // paginacja
  const [page, setPage] = useState<number>(1);

  // UI
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false); // Stan dla sidebara na mobile
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; listingId: number | null }>({ show: false, listingId: null });

  // zakładki
  const [activeTab, setActiveTab] = useState<
    "overview" | "analytics" | "valuation" | "compare" | "admin" | "saved" | "auth" | "filters"
  >("overview");

  // Autentykacja
  const { user, token, logout, isAdmin } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  
  // Automatyczne przełączanie zakładki po zalogowaniu/wylogowaniu
  useEffect(() => {
    // Po zalogowaniu - jeśli jesteśmy na "auth", przełącz na "overview"
    if (user && activeTab === "auth") {
      setActiveTab("overview");
    }
    
    // Po wylogowaniu - jeśli jesteśmy na "saved" lub "admin", przełącz na "overview"
    if (!user && (activeTab === "saved" || activeTab === "admin")) {
      setActiveTab("overview");
    }
  }, [user, activeTab]);

  // Zamknij sidebar gdy klikamy inną zakładkę (oprócz "filters")
  useEffect(() => {
    if (activeTab !== "filters" && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [activeTab, sidebarOpen]);

  // Zarządzanie z-indexami tooltipów - obniż z-index innych ikon gdy tooltip jest aktywny
  useEffect(() => {
    const handleMouseEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      const icon = target.closest('.chart-help-icon') as HTMLElement;
      if (icon) {
        // Obniż z-index wszystkich innych ikon
        document.querySelectorAll('.chart-help-icon').forEach((otherIcon) => {
          if (otherIcon !== icon) {
            (otherIcon as HTMLElement).style.zIndex = '0';
          }
        });
      }
    };

    const handleMouseLeave = () => {
      // Przywróć normalne z-indexy po krótkim opóźnieniu (żeby tooltip zdążył się ukryć)
      setTimeout(() => {
        document.querySelectorAll('.chart-help-icon').forEach((icon) => {
          (icon as HTMLElement).style.zIndex = '';
        });
      }, 100);
    };

    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);

    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
    };
  }, []);
  
  // Funkcja do usuwania oferty (tylko dla adminów)
  const handleDeleteListing = (listingId: number) => {
    if (!token || !isAdmin) return;
    setDeleteConfirm({ show: true, listingId });
  };

  const confirmDeleteListing = async () => {
    if (!deleteConfirm.listingId) return;
    
    try {
      await axios.delete(`${API_URL}/admin/listings/${deleteConfirm.listingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Odśwież dane po usunięciu
      await fetchData(page, false);
      setDeleteConfirm({ show: false, listingId: null });
    } catch (error: any) {
      console.error("Error deleting listing:", error);
      setDeleteConfirm({ show: false, listingId: null });
    }
  };

  const cancelDeleteListing = () => {
    setDeleteConfirm({ show: false, listingId: null });
  };

  
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);
  const [transmissions, setTransmissions] = useState<string[]>([]);


  //sortowanie tabeli ofert
  const [sortBy, setSortBy] = useState<"year" | "mileage" | "price" | "brand" | "model" | null>(
  null
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  
  // wyszukiwanie i filtry zaawansowane w tabeli
  const [searchText] = useState<string>("");
  const [priceMin] = useState<string>("");
  const [priceMax] = useState<string>("");
  const [locationFilter] = useState<string>("");

  // ================== POBIERANIE DANYCH ==================

  // 1. Pobierz listę marek, paliw, skrzyń i zakres dat przy starcie
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [brandsRes, fuelRes, transRes, dateRangeRes] = await Promise.all([
          axios.get<string[]>(`${API_URL}/brands`),
          axios.get<string[]>(`${API_URL}/fuel-types`),
          axios.get<string[]>(`${API_URL}/transmissions`),
          axios.get<{ min_date: string | null; max_date: string | null }>(`${API_URL}/publication-date-range`),
        ]);
        setBrands(brandsRes.data);
        setFuelTypes(fuelRes.data);
        setTransmissions(transRes.data);
        setDateRange(dateRangeRes.data);
      } catch (err) {
        console.error(err);
        setErrorMsg(
          "Nie udało się pobrać danych słownikowych (marki/paliwa/skrzynie/daty)."
        );
      }
    };

    fetchInitial();
  }, []);

  // 2. Pobierz listę modeli do sidebaru, gdy zmieni się marka (filtry)
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedBrand) {
        setModels([]);
        setSelectedModel("");
        setGenerations([]);
        setSelectedGeneration("");
        return;
      }
      try {
        const res = await axios.get<string[]>(`${API_URL}/models`, {
          params: { brand: selectedBrand },
        });
        setModels(res.data);
        setGenerations([]);
        setSelectedGeneration("");
      } catch (err) {
        console.error(err);
        setErrorMsg("Nie udało się pobrać listy modeli.");
      }
    };

    fetchModels();
  }, [selectedBrand]);


  // 2b. Pobierz listę wersji, gdy zmieni się marka lub model
  useEffect(() => {
    const fetchVersions = async () => {
      if (!selectedBrand || !selectedModel) {
        setGenerations([]);
        setSelectedGeneration("");
        return;
      }
      try {
        const res = await axios.get<string[]>(`${API_URL}/generations`, {
          params: { brand: selectedBrand, model: selectedModel },
        });
        setGenerations(res.data);
        // Jeśli wybrana generacja nie jest już dostępna, wyczyść ją
        if (selectedGeneration && !res.data.includes(selectedGeneration)) {
          setSelectedGeneration("");
        }
      } catch (err) {
        console.error(err);
        setGenerations([]);
        setSelectedGeneration("");
      }
    };

    fetchVersions();
  }, [selectedBrand, selectedModel, selectedGeneration]);

  // 2c. Pobierz listę pojemności, gdy zmieni się marka lub model
  useEffect(() => {
    const fetchDisplacements = async () => {
      if (!selectedBrand || !selectedModel) {
        setDisplacements([]);
        setDisplacementMin("");
        setDisplacementMax("");
        return;
      }
      try {
        const res = await axios.get<number[]>(`${API_URL}/displacements`, {
          params: { brand: selectedBrand, model: selectedModel },
        });
        setDisplacements(res.data);
        // Jeśli wybrane pojemności nie są już dostępne, wyczyść je
        if (displacementMin && !res.data.includes(Number(displacementMin))) {
          setDisplacementMin("");
        }
        if (displacementMax && !res.data.includes(Number(displacementMax))) {
          setDisplacementMax("");
        }
      } catch (err) {
        console.error(err);
        setDisplacements([]);
        setDisplacementMin("");
        setDisplacementMax("");
      }
    };

    fetchDisplacements();
  }, [selectedBrand, selectedModel, displacementMin, displacementMax]);

  // 2d. Pobierz listę typów paliwa, gdy zmieni się marka lub model
  useEffect(() => {
    const fetchFuelTypes = async () => {
      if (!selectedBrand || !selectedModel) {
        setFuelTypesByModel([]);
        setSelectedFuelType("");
        return;
      }
      try {
        const res = await axios.get<string[]>(`${API_URL}/fuel-types-by-model`, {
          params: { brand: selectedBrand, model: selectedModel },
        });
        setFuelTypesByModel(res.data);
        // Jeśli wybrany typ paliwa nie jest już dostępny, wyczyść go
        if (selectedFuelType && !res.data.includes(selectedFuelType)) {
          setSelectedFuelType("");
        }
      } catch (err) {
        console.error(err);
        setFuelTypesByModel([]);
        setSelectedFuelType("");
      }
    };

    fetchFuelTypes();
  }, [selectedBrand, selectedModel, selectedFuelType]);


  // 4. Pobierz statystyki, trend i listę ofert dla filtrów z sidebaru + konkretnej strony
  const fetchData = async (
  pageOverride?: number,
  _scrollToTable: boolean = false,
  sortByOverride?: "year" | "mileage" | "price" | "brand" | "model" | null,
  sortDirOverride?: "asc" | "desc" | null
) => {
  try {
    setLoading(true);
    setErrorMsg("");

    const currentPage = pageOverride ?? page;
    const offset = (currentPage - 1) * PAGE_SIZE;

    const params: Record<string, string | number> = {};
    if (selectedBrand) params.brand = selectedBrand;
    if (selectedModel) params.model = selectedModel;
    if (selectedGeneration) params.generation = selectedGeneration;
    if (yearMin) params.year_min = Number(yearMin);
    if (yearMax) params.year_max = Number(yearMax);
    if (mileageMax) params.mileage_max = Number(mileageMax);
    if (displacementMin) params.displacement_min = Number(displacementMin);
    if (displacementMax) params.displacement_max = Number(displacementMax);
    if (selectedFuelType) params.fuel_type = selectedFuelType;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    const sortByParam = sortByOverride ?? sortBy;
    const sortDirParam = sortDirOverride ?? sortDir;

    if (sortByParam) params.sort_by = sortByParam;
    if (sortDirParam) params.sort_dir = sortDirParam;

    const [analysisRes, trendRes, listingsRes] = await Promise.all([
      axios.get<AnalysisResult>(`${API_URL}/analysis`, { params }),
      axios.get<TrendResponse>(`${API_URL}/trend-by-year`, { params }),
      axios.get<ListingsResponse>(`${API_URL}/listings-filtered`, {
        params: { ...params, limit: PAGE_SIZE, offset },
      }),
    ]);

    setAnalysis(analysisRes.data);
    setTrend(trendRes.data.points);
    setListings(listingsRes.data.items);

    setTotalListings(listingsRes.data.total);
    setPage(currentPage);

    // Scroll do tabeli jest teraz obsługiwany w komponencie OverviewTab
  } catch (err) {
    console.error(err);
    setErrorMsg("Błąd podczas pobierania danych z API.");
  } finally {
    setLoading(false);
  }
};

  // 5. Pobierz dane do analiz zaawansowanych
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchAnalyticsData = async () => {
      if (activeTab !== "analytics") {
        // Resetuj dane gdy nie jesteśmy w zakładce analytics
        if (isMounted) {
          setPriceMileageData([]);
          setPriceStatsByCategory(null);
          setPriceStatistics(null);
        }
        return;
      }

      // Krótkie opóźnienie, aby uniknąć problemów przy szybkim przełączaniu zakładek
      await new Promise(resolve => setTimeout(resolve, 100));

      // Sprawdź ponownie czy nadal jesteśmy w zakładce analytics
      if (activeTab !== "analytics" || !isMounted) {
        return;
      }

      try {
        const params: Record<string, string | number> = {};
        if (selectedBrand) params.brand = selectedBrand;
        if (selectedModel) params.model = selectedModel;
        if (selectedGeneration) params.generation = selectedGeneration;
        if (yearMin) params.year_min = Number(yearMin);
        if (yearMax) params.year_max = Number(yearMax);
        if (mileageMax) params.mileage_max = Number(mileageMax);
        if (displacementMin) params.displacement_min = Number(displacementMin);
        if (displacementMax) params.displacement_max = Number(displacementMax);
        if (selectedFuelType) params.fuel_type = selectedFuelType;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;

        // Ustaw timeout na 60 sekund dla dużych zbiorów danych
        const axiosConfig = {
          timeout: 60000, // 60 sekund
          signal: abortController.signal
        };

        const [priceMileageRes, priceStatsRes, priceStatsRes2] = await Promise.all([
          axios.get<PriceMileageResponse>(`${API_URL}/analytics/price-mileage`, { 
            params: { ...params, limit: 50000 }, // Zmniejszono z 200000 do 50000 dla lepszej wydajności
            ...axiosConfig
          }),
          axios.get<PriceStatsByCategoryResponse>(`${API_URL}/analytics/price-stats-by-category`, { 
            params,
            ...axiosConfig
          }),
          axios.get<PriceStatistics>(`${API_URL}/analytics/price-statistics`, { 
            params,
            ...axiosConfig
          }),
        ]);

        // Sprawdź czy komponent jest nadal zamontowany przed ustawieniem stanu
        if (isMounted && activeTab === "analytics") {
          const points = priceMileageRes.data?.points || [];
          
          // Jeśli mamy więcej niż 50000 punktów, wyświetl ostrzeżenie
          if (points.length > 50000) {
            console.warn(`Otrzymano ${points.length} punktów. Wykresy będą wyświetlać próbkę danych dla lepszej wydajności.`);
          }
          
          setPriceMileageData(points);
          setPriceStatsByCategory(priceStatsRes.data || null);
          setPriceStatistics(priceStatsRes2.data || null);
        }
      } catch (err: any) {
        // Ignoruj błędy związane z anulowaniem requestu
        if (err.name === 'AbortError' || err.name === 'CanceledError') {
          return;
        }
        console.error("Błąd podczas pobierania danych analitycznych:", err);
        
        if (isMounted && activeTab === "analytics") {
          // Sprawdź typ błędu i wyświetl odpowiedni komunikat
          if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            setErrorMsg("Przekroczono limit czasu oczekiwania. Spróbuj zawęzić filtry (np. wybierz konkretną markę/model) lub odśwież stronę.");
          } else if (err.response?.status === 500) {
            setErrorMsg("Błąd serwera. Prawdopodobnie zbyt dużo danych do przetworzenia. Spróbuj zawęzić filtry (np. wybierz konkretną markę/model).");
          } else if (err.response?.status === 413) {
            setErrorMsg("Zbyt dużo danych. Spróbuj zawęzić filtry (np. wybierz konkretną markę/model).");
          } else {
            setErrorMsg(`Błąd podczas pobierania danych analitycznych: ${err.message || "Nieznany błąd"}. Spróbuj zawęzić filtry.`);
          }
        }
      }
    };

    fetchAnalyticsData();

    // Cleanup: anuluj requesty i oznacz komponent jako odmontowany
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [activeTab, selectedBrand, selectedModel, selectedGeneration, yearMin, yearMax, mileageMax, displacementMin, displacementMax, selectedFuelType, dateFrom, dateTo]);

// funkcja do obslugi klikniecia w naglówku

const handleSort = (column: "year" | "mileage" | "price" | "brand" | "model") => {
  let newDir: "asc" | "desc" = "desc";

  if (sortBy === column) {
    newDir = sortDir === "asc" ? "desc" : "asc";
  }

  setSortBy(column);
  setSortDir(newDir);

  // zawsze od pierwszej strony przy zmianie sortowania
  fetchData(1, true, column, newDir);
};

  // Filtrowanie listingu po stronie klienta (wyszukiwanie tekstowe, cena, lokalizacja)
  const filteredListings = listings.filter((listing) => {
    // Wyszukiwanie tekstowe
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const matchesSearch = 
        listing.vehicle_brand?.toLowerCase().includes(searchLower) ||
        listing.vehicle_model?.toLowerCase().includes(searchLower) ||
        listing.vehicle_generation?.toLowerCase().includes(searchLower) ||
        listing.vehicle_version?.toLowerCase().includes(searchLower) ||
        listing.fuel_type?.toLowerCase().includes(searchLower) ||
        listing.transmission?.toLowerCase().includes(searchLower) ||
        listing.offer_location?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Filtr ceny
    if (priceMin && listing.price_pln < Number(priceMin)) return false;
    if (priceMax && listing.price_pln > Number(priceMax)) return false;

    // Filtr lokalizacji
    if (locationFilter) {
      const locationLower = locationFilter.toLowerCase();
      if (!listing.offer_location?.toLowerCase().includes(locationLower)) return false;
    }

    return true;
  });

// =============== PORÓWNANIA – OBSŁUGA FORMULARZA ===============



  // ================== UI / RENDER ==================



  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex relative">
      {/* Overlay na mobile gdy sidebar jest otwarty */}
      {sidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => {
            setSidebarOpen(false);
            setActiveTab(activeTab === "filters" ? "overview" : activeTab);
          }}
        />
      )}

      {/* LEFT SIDEBAR - FILTRY */}
      <FiltersSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        brands={brands}
        models={models}
        generations={generations}
        displacements={displacements}
        fuelTypesByModel={fuelTypesByModel}
        selectedBrand={selectedBrand}
        setSelectedBrand={setSelectedBrand}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        selectedGeneration={selectedGeneration}
        setSelectedGeneration={setSelectedGeneration}
        selectedFuelType={selectedFuelType}
        setSelectedFuelType={setSelectedFuelType}
        yearMin={yearMin}
        setYearMin={setYearMin}
        yearMax={yearMax}
        setYearMax={setYearMax}
        mileageMax={mileageMax}
        setMileageMax={setMileageMax}
        displacementMin={displacementMin}
        setDisplacementMin={setDisplacementMin}
        displacementMax={displacementMax}
        setDisplacementMax={setDisplacementMax}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        dateRange={dateRange}
        loading={loading}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
        onApplyFilters={() => fetchData(1, false)}
      />

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-6 overflow-auto" style={{ width: '100%', maxWidth: '100%' }}>
        {/* User info - na wysokości zakładek */}
        {user && (
          <div className="mb-4 flex items-center justify-end gap-4">
            <span className="text-sm text-slate-400">
              Zalogowany jako: <strong className="text-slate-200">{user.username}</strong>
              {isAdmin && <span className="ml-2 text-blue-400">(Admin)</span>}
            </span>
            <button
              onClick={logout}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
            >
              Wyloguj
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs mb-4">
          {/* Zakładka Filtry - tylko na mobile */}
          <button
            className={`tab-button mobile-filter-tab ${
              activeTab === "filters" || sidebarOpen ? "tab-button-active" : ""
            }`}
            onClick={() => {
              setActiveTab("filters");
              setSidebarOpen(true);
            }}
          >
            Filtry
          </button>
          <button
            className={`tab-button ${
              activeTab === "overview" ? "tab-button-active" : ""
            }`}
            onClick={() => {
              setActiveTab("overview");
              setSidebarOpen(false);
            }}
          >
            Podgląd cen
          </button>
          <button
            className={`tab-button ${
              activeTab === "analytics" ? "tab-button-active" : ""
            }`}
            onClick={() => {
              setActiveTab("analytics");
              setSidebarOpen(false);
            }}
          >
            Analizy
          </button>
          <button
            className={`tab-button ${
              activeTab === "valuation" ? "tab-button-active" : ""
            }`}
            onClick={() => {
              setActiveTab("valuation");
              setSidebarOpen(false);
            }}
          >
            Wycena pojazdu
          </button>
          <button
            className={`tab-button ${
              activeTab === "compare" ? "tab-button-active" : ""
            }`}
            onClick={() => {
              setActiveTab("compare");
              setSidebarOpen(false);
            }}
          >
            Porównania
          </button>
          {!user && (
            <button
              className={`tab-button ${
                activeTab === "auth" ? "tab-button-active" : ""
              }`}
              onClick={() => {
                setActiveTab("auth");
                setSidebarOpen(false);
              }}
            >
              Logowanie
            </button>
          )}
          {user && (
            <button
              className={`tab-button ${
                activeTab === "saved" ? "tab-button-active" : ""
              }`}
              onClick={() => {
                setActiveTab("saved");
                setSidebarOpen(false);
              }}
            >
              Zapisane
            </button>
          )}
          {isAdmin && (
            <button
              className={`tab-button ${
                activeTab === "admin" ? "tab-button-active" : ""
              }`}
              onClick={() => {
                setActiveTab("admin");
                setSidebarOpen(false);
              }}
            >
              Panel administratora
            </button>
          )}
        </div>

        {/* === ZAKŁADKA: PODGLĄD CEN === */}
        {activeTab === "overview" && (
          <OverviewTab
            analysis={analysis}
            trend={trend}
            filteredListings={filteredListings}
            totalListings={totalListings}
            page={page}
            sortBy={sortBy}
            sortDir={sortDir}
            loading={loading}
            isAdmin={isAdmin}
            onSort={handleSort}
            onPageChange={fetchData}
            onDeleteListing={isAdmin ? handleDeleteListing : undefined}
            searchText={searchText}
            priceMin={priceMin}
            priceMax={priceMax}
            locationFilter={locationFilter}
          />
        )}

        {/* === ZAKŁADKA: ANALIZY === */}
        {activeTab === "analytics" && (
          <AnalyticsTab
            priceMileageData={priceMileageData}
            priceStatsByCategory={priceStatsByCategory}
            priceStatistics={priceStatistics}
            loading={loading}
            errorMsg={errorMsg}
          />
        )}

        {/* === ZAKŁADKA: WYCENA POJAZDU === */}
        {activeTab === "valuation" && (
          <ValuationTab brands={brands} fuelTypes={fuelTypes} transmissions={transmissions} user={user} token={token} />
        )}

        {/* === ZAKŁADKA: PORÓWNANIA === */}
        {activeTab === "compare" && (
          <CompareTab brands={brands} fuelTypes={fuelTypes} transmissions={transmissions} user={user} token={token} />
        )}

        {/* === ZAKŁADKA: ADMIN === */}

        {/* === ZAKŁADKA: ADMIN === */}
        {activeTab === "admin" && isAdmin && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Panel administratora</h2>
            <p className="text-sm text-slate-400 mb-4">
              Zarządzanie bazą danych i aktualizacjami.
            </p>

            <div className="space-y-6">
              <ScraperConfig />
              <DatabaseUpdate />
            </div>
          </section>
        )}

        {/* === ZAKŁADKA: ZAPISANE === */}
        {activeTab === "saved" && user && token && <SavedTab token={token} />}

        {/* === ZAKŁADKA: LOGOWANIE === */}
        {activeTab === "auth" && !user && (
          <section className="auth-section w-full max-w-full md:max-w-[50%]">
            <div className="rounded-lg bg-slate-800 p-4">
              <h2 className="text-lg font-semibold mb-3">Logowanie</h2>
              <p className="text-sm text-slate-400 mb-6">
                Zaloguj się lub utwórz konto, aby zapisywać wyceny i porównania.
              </p>

              {/* Przełącznik logowanie/rejestracja */}
              <div className="mb-6 flex gap-2">
                <button
                  onClick={() => setAuthMode("login")}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    authMode === "login"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-slate-800 text-white hover:bg-slate-700 border border-slate-700"
                  }`}
                  style={{
                    backgroundColor: authMode === "login" ? "#059669" : "#1f2937",
                    color: "#ffffff"
                  }}
                >
                  Logowanie
                </button>
                <button
                  onClick={() => setAuthMode("register")}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    authMode === "register"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-slate-800 text-white hover:bg-slate-700 border border-slate-700"
                  }`}
                  style={{
                    backgroundColor: authMode === "register" ? "#059669" : "#1f2937",
                    color: "#ffffff"
                  }}
                >
                  Rejestracja
                </button>
              </div>

              {/* Formularze */}
              <div>
                {authMode === "login" ? (
                  <LoginForm
                    onSwitchToRegister={() => setAuthMode("register")}
                  />
                ) : (
                  <RegisterForm
                    onSwitchToLogin={() => setAuthMode("login")}
                  />
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modal potwierdzenia usunięcia */}
      {deleteConfirm.show && (
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
          onClick={cancelDeleteListing}
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
            <h3 className="text-lg font-semibold mb-3">Usunąć ofertę?</h3>
            <p className="text-sm text-slate-400 mb-6">
              Ta operacja jest nieodwracalna. Oferta zostanie trwale usunięta z bazy danych.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDeleteListing}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDeleteListing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white transition-colors font-medium"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



export default App;
