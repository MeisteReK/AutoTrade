import React from "react";
import { parseDate, convertToDateInputFormat, convertFromDateInputFormat } from "../utils/dateUtils";

type TabType = "overview" | "analytics" | "valuation" | "compare" | "admin" | "saved" | "auth" | "filters";

type FiltersSidebarProps = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: TabType;
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>;
  brands: string[];
  models: string[];
  generations: string[];
  displacements: number[];
  fuelTypesByModel: string[];
  selectedBrand: string;
  setSelectedBrand: (brand: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  selectedGeneration: string;
  setSelectedGeneration: (generation: string) => void;
  selectedFuelType: string;
  setSelectedFuelType: (fuelType: string) => void;
  yearMin: string;
  setYearMin: (year: string) => void;
  yearMax: string;
  setYearMax: (year: string) => void;
  mileageMax: string;
  setMileageMax: (mileage: string) => void;
  displacementMin: string;
  setDisplacementMin: (displacement: string) => void;
  displacementMax: string;
  setDisplacementMax: (displacement: string) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  dateRange: { min_date: string | null; max_date: string | null } | null;
  loading: boolean;
  errorMsg: string;
  setErrorMsg: (msg: string) => void;
  onApplyFilters: () => void;
};

export const FiltersSidebar: React.FC<FiltersSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  activeTab,
  setActiveTab,
  brands,
  models,
  generations,
  displacements,
  fuelTypesByModel,
  selectedBrand,
  setSelectedBrand,
  selectedModel,
  setSelectedModel,
  selectedGeneration,
  setSelectedGeneration,
  selectedFuelType,
  setSelectedFuelType,
  yearMin,
  setYearMin,
  yearMax,
  setYearMax,
  mileageMax,
  setMileageMax,
  displacementMin,
  setDisplacementMin,
  displacementMax,
  setDisplacementMax,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  dateRange,
  loading,
  errorMsg,
  setErrorMsg,
  onApplyFilters,
}) => {
  return (
    <aside className={`sidebar-filters ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Przycisk zamknij na mobile */}
      <button
        className="sidebar-close-button"
        onClick={() => {
          setSidebarOpen(false);
          setActiveTab(activeTab === "filters" ? "overview" : activeTab);
        }}
        aria-label="Close sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <h1 className="text-xl font-semibold mb-4">AutoTrade Analytics</h1>
      <p className="text-slate-400 text-sm mb-4">
        Ustaw filtry (marka, model, rocznik, przebieg) i kliknij{" "}
        <span className="font-semibold">„Zastosuj filtry”</span>.
      </p>

      {/* Marka */}
      <div className="mb-3">
        <label className="block text-sm mb-1">Marka</label>
        <select
          className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
          value={selectedBrand}
          onChange={(e) => {
            setSelectedBrand(e.target.value);
            setSelectedModel("");
            setSelectedGeneration("");
          }}
        >
          <option value="">— dowolna —</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Model */}
      <div className="mb-3">
        <label className="block text-sm mb-1">Model</label>
        <select
          className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
          value={selectedModel}
          onChange={(e) => {
            setSelectedModel(e.target.value);
            setSelectedGeneration("");
          }}
          disabled={!models.length}
        >
          <option value="">— dowolny —</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Generacja - tylko jeśli są dostępne generacje */}
      {generations.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm mb-1">Generacja</label>
          <select
            className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
            value={selectedGeneration}
            onChange={(e) => setSelectedGeneration(e.target.value)}
          >
            <option value="">— dowolna —</option>
            {generations.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rok od / do */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className="block text-sm mb-1">Rok od</label>
          <input
            type="number"
            className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
            value={yearMin}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || (!isNaN(Number(val)) && Number(val) >= 0)) {
                setYearMin(val);
                setErrorMsg("");
              }
            }}
            min="1950"
            max="2025"
            placeholder="1950-2025"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm mb-1">Rok do</label>
          <input
            type="number"
            className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
            value={yearMax}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || (!isNaN(Number(val)) && Number(val) >= 0)) {
                setYearMax(val);
                setErrorMsg("");
              }
            }}
            min="1950"
            max="2025"
            placeholder="1950-2025"
          />
        </div>
      </div>

      {/* Przebieg max */}
      <div className="mb-3">
        <label className="block text-sm mb-1">Przebieg max (km)</label>
        <input
          type="number"
          className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
          value={mileageMax}
          onChange={(e) => setMileageMax(e.target.value)}
        />
      </div>

      {/* Pojemność silnika od / do */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className="block text-sm mb-1">Pojemność od (cm³)</label>
          <select
            className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            value={displacementMin}
            onChange={(e) => setDisplacementMin(e.target.value)}
            disabled={!selectedBrand || !selectedModel || !displacements.length}
          >
            <option value="">— dowolna —</option>
            {displacements.map((d) => (
              <option key={`min-${d}`} value={d.toString()}>
                {Math.round(d)} cm³
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm mb-1">Pojemność do (cm³)</label>
          <select
            className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            value={displacementMax}
            onChange={(e) => setDisplacementMax(e.target.value)}
            disabled={!selectedBrand || !selectedModel || !displacements.length}
          >
            <option value="">— dowolna —</option>
            {displacements.map((d) => (
              <option key={`max-${d}`} value={d.toString()}>
                {Math.round(d)} cm³
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rodzaj paliwa */}
      <div className="mb-3">
        <label className="block text-sm mb-1">Rodzaj paliwa</label>
        <select
          className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          value={selectedFuelType}
          onChange={(e) => setSelectedFuelType(e.target.value)}
          disabled={!selectedBrand || !selectedModel || !fuelTypesByModel.length}
        >
          <option value="">— dowolny —</option>
          {fuelTypesByModel.map((ft) => (
            <option key={ft} value={ft}>
              {ft}
            </option>
          ))}
        </select>
      </div>

      {/* Data publikacji od / do */}
      {dateRange && (
        <div className="mb-3">
          <label className="block text-sm mb-1">Data publikacji</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Od</label>
              <input
                type="date"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-slate-200"
                value={dateFrom ? convertToDateInputFormat(dateFrom) : ""}
                min={dateRange.min_date ? convertToDateInputFormat(dateRange.min_date) : undefined}
                max={dateRange.max_date ? convertToDateInputFormat(dateRange.max_date) : undefined}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    setDateFrom("");
                    setErrorMsg("");
                    return;
                  }
                  
                  const convertedValue = convertFromDateInputFormat(value);
                  setDateFrom(convertedValue);
                  
                  // Walidacja
                  const inputDate = parseDate(convertedValue);
                  if (inputDate) {
                    // Walidacja: sprawdź czy data "od" nie jest nowsza niż data "do"
                    if (dateTo) {
                      const toDate = parseDate(dateTo);
                      if (toDate && inputDate > toDate) {
                        setErrorMsg(`Data "od" nie może być nowsza niż data "do"`);
                        return;
                      }
                    }
                    
                    // Jeśli wszystkie walidacje przeszły, wyczyść błąd
                    setErrorMsg("");
                  }
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Do</label>
              <input
                type="date"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-slate-200"
                value={dateTo ? convertToDateInputFormat(dateTo) : ""}
                min={dateRange.min_date ? convertToDateInputFormat(dateRange.min_date) : undefined}
                max={dateRange.max_date ? convertToDateInputFormat(dateRange.max_date) : undefined}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    setDateTo("");
                    setErrorMsg("");
                    return;
                  }
                  
                  const convertedValue = convertFromDateInputFormat(value);
                  setDateTo(convertedValue);
                  
                  // Walidacja
                  const inputDate = parseDate(convertedValue);
                  if (inputDate) {
                    // Walidacja: sprawdź czy data "do" nie jest starsza niż data "od"
                    if (dateFrom) {
                      const fromDate = parseDate(dateFrom);
                      if (fromDate && inputDate < fromDate) {
                        setErrorMsg(`Data "do" nie może być starsza niż data "od"`);
                        return;
                      }
                    }
                    
                    // Jeśli wszystkie walidacje przeszły, wyczyść błąd
                    setErrorMsg("");
                  }
                }}
              />
            </div>
          </div>
          {dateRange.min_date && (
            <p className="text-xs text-slate-500 mt-1">
              Zakres dostępny: {dateRange.min_date} - {dateRange.max_date || "obecnie"}
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => {
          // Walidacja przed zastosowaniem filtrów
          let validationError = "";
          
          // Walidacja zakresów roku
          if (yearMin && yearMax) {
            const yearMinNum = Number(yearMin);
            const yearMaxNum = Number(yearMax);
            if (!isNaN(yearMinNum) && !isNaN(yearMaxNum)) {
              if (yearMinNum < 1950 || yearMinNum > 2025) {
                validationError = "Rok 'od' musi być w zakresie 1950-2025.";
              } else if (yearMaxNum < 1950 || yearMaxNum > 2025) {
                validationError = "Rok 'do' musi być w zakresie 1950-2025.";
              } else if (yearMinNum > yearMaxNum) {
                validationError = "Rok 'od' nie może być większy niż rok 'do'.";
              }
            }
          } else if (yearMin) {
            const yearMinNum = Number(yearMin);
            if (!isNaN(yearMinNum) && (yearMinNum < 1950 || yearMinNum > 2025)) {
              validationError = "Rok 'od' musi być w zakresie 1950-2025.";
            }
          } else if (yearMax) {
            const yearMaxNum = Number(yearMax);
            if (!isNaN(yearMaxNum) && (yearMaxNum < 1950 || yearMaxNum > 2025)) {
              validationError = "Rok 'do' musi być w zakresie 1950-2025.";
            }
          }
          
          // Walidacja przebiegu
          if (mileageMax) {
            const mileageMaxNum = Number(mileageMax);
            if (!isNaN(mileageMaxNum) && (mileageMaxNum < 0 || mileageMaxNum > 10000000)) {
              validationError = "Przebieg maksymalny musi być w zakresie 0-10 000 000 km.";
            }
          }
          
          // Walidacja pojemności
          if (displacementMin && displacementMax) {
            const dispMin = Number(displacementMin);
            const dispMax = Number(displacementMax);
            if (!isNaN(dispMin) && !isNaN(dispMax) && dispMin > dispMax) {
              validationError = "Pojemność 'od' nie może być większa niż pojemność 'do'.";
            }
          }
          
          if (validationError) {
            setErrorMsg(validationError);
            return;
          }
          
          setErrorMsg("");
          onApplyFilters();
          setSidebarOpen(false);
          if (activeTab === "filters") {
            setActiveTab("overview");
          }
        }}
        className="w-full rounded bg-emerald-600 hover:bg-emerald-500 transition px-3 py-2 text-sm font-semibold"
        disabled={loading}
      >
        {loading ? "Ładowanie..." : "Zastosuj filtry"}
      </button>

      {errorMsg && (
        <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
      )}
    </aside>
  );
};

