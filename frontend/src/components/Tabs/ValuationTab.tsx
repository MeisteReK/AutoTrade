import React, { useState, useEffect } from "react";
import axios from "axios";
import type { ValuationRequestPayload, ValuationResponse } from "../../types";
import { formatPrice } from "../../utils/formatPrice";
import { SaveValuationButton } from "../SaveValuationButton";
import API_URL from "../../config/api";

type ValuationTabProps = {
  brands: string[];
  fuelTypes: string[];
  transmissions: string[];
  user: { username: string } | null;
  token: string | null;
};

export const ValuationTab: React.FC<ValuationTabProps> = ({
  brands,
  fuelTypes,
  transmissions,
  user,
  token,
}) => {
  // ====== STAN WYCENY ======
  const [valuationBrand, setValuationBrand] = useState<string>("");
  const [valuationModels, setValuationModels] = useState<string[]>([]);
  const [valuationModel, setValuationModel] = useState<string>("");
  const [valuationGenerations, setValuationGenerations] = useState<string[]>([]);
  const [valuationGeneration, setValuationGeneration] = useState<string>("");
  const [valuationYear, setValuationYear] = useState<string>("");
  const [valuationMileage, setValuationMileage] = useState<string>("");
  const [valuationFuel, setValuationFuel] = useState<string>("");
  const [valuationTransmission, setValuationTransmission] = useState<string>("");
  const [valuationEngine, setValuationEngine] = useState<string>("");

  const [valuationResult, setValuationResult] = useState<ValuationResponse | null>(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState<string>("");

  // Konfiguracja danych do treningu (marka i model są automatycznie z formularza wyceny)
  const [valuationTrainingYearMin, setValuationTrainingYearMin] = useState<string>("");
  const [valuationTrainingYearMax, setValuationTrainingYearMax] = useState<string>("");
  const [valuationTrainingMileageMax, _setValuationTrainingMileageMax] = useState<string>("");
  const [valuationTrainingFuel, _setValuationTrainingFuel] = useState<string>("");
  const [valuationTrainingDateFrom, _setValuationTrainingDateFrom] = useState<string>("");
  const [valuationTrainingDateTo, _setValuationTrainingDateTo] = useState<string>("");

  // Features
  const [valuationFeaturesNumeric, setValuationFeaturesNumeric] = useState<string[]>([
    "year",
    "mileage_km",
    "engine_capacity_cm3",
  ]);
  const [valuationFeaturesCategorical, setValuationFeaturesCategorical] = useState<string[]>([
    "generation",
    "fuel_type",
    "transmission",
  ]);

  // Parametry modelu Random Forest
  const [valuationTestSize, setValuationTestSize] = useState<string>("0.2");
  const [valuationRandomState, setValuationRandomState] = useState<string>("42");
  const [valuationNEstimators, setValuationNEstimators] = useState<string>("50");
  const [valuationMaxDepth, setValuationMaxDepth] = useState<string>("");
  const [valuationMinSamplesSplit, setValuationMinSamplesSplit] = useState<string>("2");
  const [valuationMinSamplesLeaf, setValuationMinSamplesLeaf] = useState<string>("1");

  // Pobierz modele dla formularza wyceny, gdy zmieni się marka w formularzu
  useEffect(() => {
    const fetchValuationModels = async () => {
      if (!valuationBrand) {
        setValuationModels([]);
        setValuationModel("");
        setValuationGenerations([]);
        setValuationGeneration("");
        return;
      }
      try {
        const res = await axios.get<string[]>(`${API_URL}/models`, {
          params: { brand: valuationBrand },
        });
        setValuationModels(res.data);
        setValuationGenerations([]);
        setValuationGeneration("");
      } catch (err) {
        console.error(err);
      }
    };

    fetchValuationModels();
  }, [valuationBrand]);

  // Pobierz generacje dla formularza wyceny, gdy zmieni się marka lub model w formularzu
  useEffect(() => {
    const fetchValuationGenerations = async () => {
      if (!valuationBrand || !valuationModel) {
        setValuationGenerations([]);
        setValuationGeneration("");
        return;
      }
      try {
        const res = await axios.get<string[]>(`${API_URL}/generations`, {
          params: { brand: valuationBrand, model: valuationModel },
        });
        setValuationGenerations(res.data);
        // Jeśli wybrana generacja nie jest już dostępna, wyczyść ją
        if (valuationGeneration && !res.data.includes(valuationGeneration)) {
          setValuationGeneration("");
        }
      } catch (err) {
        console.error(err);
        setValuationGenerations([]);
        setValuationGeneration("");
      }
    };

    fetchValuationGenerations();
  }, [valuationBrand, valuationModel, valuationGeneration]);

  const handleValuationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValuationError("");
    setValuationResult(null);

    // Walidacja wymaganych pól
    if (!valuationBrand) {
      setValuationError("Wybierz markę pojazdu.");
      return;
    }
    
    if (!valuationModel) {
      setValuationError("Wybierz model pojazdu.");
      return;
    }
    
    if (!valuationYear || !valuationYear.trim()) {
      setValuationError("Podaj rok produkcji.");
      return;
    }
    
    if (!valuationMileage || !valuationMileage.trim()) {
      setValuationError("Podaj przebieg pojazdu.");
      return;
    }
    
    if (!valuationFuel) {
      setValuationError("Wybierz rodzaj paliwa.");
      return;
    }
    
    if (!valuationTransmission) {
      setValuationError("Wybierz typ skrzyni biegów.");
      return;
    }
    
    if (!valuationEngine || !valuationEngine.trim()) {
      setValuationError("Podaj pojemność silnika.");
      return;
    }

    // Walidacja zakresów wartości
    const year = Number(valuationYear);
    const mileage = Number(valuationMileage);
    const engine = Number(valuationEngine);

    if (isNaN(year) || year < 1950 || year > 2025) {
      setValuationError("Rok produkcji musi być w zakresie 1950-2025.");
      return;
    }

    if (isNaN(mileage) || mileage < 0 || mileage > 1000000) {
      setValuationError("Przebieg musi być w zakresie 0-1 000 000 km.");
      return;
    }

    if (isNaN(engine) || engine < 500 || engine > 8000) {
      setValuationError("Pojemność silnika musi być w zakresie 500-8000 cm³.");
      return;
    }
    
    // Walidacja opcjonalnych pól treningowych
    if (valuationTrainingYearMin && valuationTrainingYearMax) {
      const yearMin = Number(valuationTrainingYearMin);
      const yearMax = Number(valuationTrainingYearMax);
      if (!isNaN(yearMin) && !isNaN(yearMax) && yearMin > yearMax) {
        setValuationError("Rok 'od' w filtrach treningowych nie może być większy niż rok 'do'.");
        return;
      }
    }

    const payload: ValuationRequestPayload = {
      brand: valuationBrand,
      model: valuationModel,
      generation: valuationGeneration || null,
      year: Number(valuationYear),
      mileage_km: Number(valuationMileage),
      fuel_type: valuationFuel,
      transmission: valuationTransmission,
      engine_capacity_cm3: Number(valuationEngine),
      // ZAWSZE używamy custom modelu trenowanego dla konkretnej marki/modelu
      training_filters: {
        brand: valuationBrand,
        model: valuationModel,
        year_min: valuationTrainingYearMin ? Number(valuationTrainingYearMin) : null,
        year_max: valuationTrainingYearMax ? Number(valuationTrainingYearMax) : null,
        mileage_max: valuationTrainingMileageMax ? Number(valuationTrainingMileageMax) : null,
        fuel_type: valuationTrainingFuel || null,
        date_from: valuationTrainingDateFrom || null,
        date_to: valuationTrainingDateTo || null,
      },
      // ZAWSZE Random Forest
      valuation_model_config: {
        model_type: "random_forest",
        features_numeric: valuationFeaturesNumeric,
        features_categorical: valuationFeaturesCategorical,
        n_estimators: Number(valuationNEstimators),
        max_depth: valuationMaxDepth ? Number(valuationMaxDepth) : null,
        min_samples_split: Number(valuationMinSamplesSplit),
        min_samples_leaf: Number(valuationMinSamplesLeaf),
        test_size: Number(valuationTestSize),
        random_state: Number(valuationRandomState),
      },
    };

    try {
      setValuationLoading(true);
      const res = await axios.post<ValuationResponse>(`${API_URL}/valuation`, payload);
      setValuationResult(res.data);
    } catch (err: any) {
      console.error(err);
      if (err.response?.data?.detail) {
        setValuationError(`Błąd wyceny: ${JSON.stringify(err.response.data.detail)}`);
      } else {
        setValuationError("Nie udało się obliczyć wyceny.");
      }
    } finally {
      setValuationLoading(false);
    }
  };

  return (
    <section style={{ width: "100%", maxWidth: "100%" }}>
      <h2 className="text-lg font-semibold mb-3">Wycena pojazdu</h2>
      <p className="text-sm text-slate-400 mb-4">
        Podaj parametry samochodu, aby oszacować jego wartość na podstawie danych historycznych.
      </p>

      {/* Info o automatycznym trenowaniu modelu */}
      <div className="mb-4 rounded-lg bg-blue-900/20 p-3 border border-blue-700/30">
        <p className="text-xs text-blue-300">
          ⚡ Model Random Forest jest trenowany automatycznie dla{" "}
          <span className="font-semibold">
            {valuationBrand || "wybranej marki"} {valuationModel || "modelu"}
          </span>
          . Proces zajmuje 5-20 sekund i zapewnia najwyższą dokładność wyceny.
        </p>
      </div>

      {/* Sekcja konfiguracji - zawsze widoczna */}
      <div className="mb-6 space-y-4">
        {/* Filtry danych treningowych */}
        <div className="rounded-lg bg-slate-800 p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-500 rounded"></span>
            Filtry danych do treningu
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            <span className="text-green-400">✓ Automatycznie:</span> Model trenowany wyłącznie na danych dla{" "}
            <span className="font-medium text-blue-400">
              {valuationBrand || "wybranej marki"} {valuationModel || "modelu"}
            </span>
            .
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Możesz dodatkowo ograniczyć dane według roku produkcji. Inne filtry pozostaw puste dla najlepszych wyników.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rok produkcji od</label>
              <input
                type="number"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={valuationTrainingYearMin}
                onChange={(e) => setValuationTrainingYearMin(e.target.value)}
                placeholder="Opcjonalnie"
                min="1950"
                max="2025"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Rok produkcji do</label>
              <input
                type="number"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={valuationTrainingYearMax}
                onChange={(e) => setValuationTrainingYearMax(e.target.value)}
                placeholder="Opcjonalnie"
                min="1990"
                max="2025"
              />
            </div>
          </div>
        </div>

        {/* Wybór cech - uproszczony */}
        <div className="rounded-lg bg-slate-800 p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-green-500 rounded"></span>
            Cechy do analizy
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Model analizuje poniższe cechy pojazdu. Domyślnie wszystkie są zaznaczone (zalecane).
          </p>
          <p className="text-xs text-slate-500 mb-3">
            <span className="text-blue-400">ℹ️ Uwaga:</span> Marka i model są automatycznie wykluczane z cech, ponieważ
            trenujemy model wyłącznie dla {valuationBrand || "wybranej marki"} {valuationModel || "modelu"}.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { value: "year", label: "Rok produkcji", group: "numeric" },
              { value: "mileage_km", label: "Przebieg (km)", group: "numeric" },
              { value: "engine_capacity_cm3", label: "Pojemność silnika", group: "numeric" },
              { value: "generation", label: "Generacja", group: "categorical" },
              { value: "fuel_type", label: "Rodzaj paliwa", group: "categorical" },
              { value: "transmission", label: "Skrzynia biegów", group: "categorical" },
            ].map((feat) => {
              const isNumeric = feat.group === "numeric";
              const isChecked = isNumeric
                ? valuationFeaturesNumeric.includes(feat.value)
                : valuationFeaturesCategorical.includes(feat.value);

              return (
                <label
                  key={feat.value}
                  className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (isNumeric) {
                        if (e.target.checked) {
                          setValuationFeaturesNumeric([...valuationFeaturesNumeric, feat.value]);
                        } else {
                          setValuationFeaturesNumeric(valuationFeaturesNumeric.filter((f) => f !== feat.value));
                        }
                      } else {
                        if (e.target.checked) {
                          setValuationFeaturesCategorical([...valuationFeaturesCategorical, feat.value]);
                        } else {
                          setValuationFeaturesCategorical(valuationFeaturesCategorical.filter((f) => f !== feat.value));
                        }
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-300">{feat.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Parametry modelu Random Forest */}
        <div className="rounded-lg bg-slate-800 p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-500 rounded"></span>
            Parametry modelu Random Forest
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Dostosuj ustawienia algorytmu do swoich potrzeb. Domyślne wartości są zalecane dla większości przypadków.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Liczba drzew */}
            <div className="p-3 rounded bg-slate-900/60 border border-slate-700/50 relative">
              <div className="chart-help-container" style={{ position: "relative" }}>
                <div className="chart-help-icon" style={{ top: "0.5rem", right: "0.5rem" }}>
                  ?
                </div>
                <div
                  className="chart-help-tooltip"
                  style={{
                    top: "2.5rem",
                    right: "0",
                    width: "320px",
                    fontSize: "0.75rem",
                    padding: "0.75rem",
                    zIndex: 10000,
                  }}
                >
                  <strong className="text-green-300">Liczba drzew (n_estimators)</strong>
                  <br />
                  Określa, ile drzew decyzyjnych będzie użytych w modelu. Więcej drzew zazwyczaj oznacza wyższą
                  dokładność, ale również dłuższy czas treningu. Model uśrednia przewidywania ze wszystkich drzew, więc
                  większa liczba drzew może prowadzić do bardziej stabilnych i dokładnych wyników.
                  <br />
                  <br />
                  <strong>Zalecane wartości:</strong> 100-300 dla dobrego balansu między dokładnością a czasem.
                </div>
              </div>
              <label className="block text-xs text-slate-400 mb-2">Liczba drzew</label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="range"
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                  min="25"
                  max="200"
                  step="25"
                  value={valuationNEstimators}
                  onChange={(e) => setValuationNEstimators(e.target.value)}
                />
                <span className="text-sm font-semibold text-green-400 bg-green-900/30 px-2 py-1 rounded min-w-[60px] text-center">
                  {valuationNEstimators}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>25 (szybkie)</span>
                <span>200 (dokładne)</span>
              </div>
            </div>

            {/* Maksymalna głębokość drzew */}
            <div className="p-3 rounded bg-slate-900/60 border border-slate-700/50 relative">
              <div className="chart-help-container" style={{ position: "relative" }}>
                <div className="chart-help-icon" style={{ top: "0.5rem", right: "0.5rem" }}>
                  ?
                </div>
                <div
                  className="chart-help-tooltip"
                  style={{
                    top: "2.5rem",
                    right: "0",
                    width: "320px",
                    fontSize: "0.75rem",
                    padding: "0.75rem",
                    zIndex: 10000,
                  }}
                >
                  <strong className="text-blue-300">Maksymalna głębokość drzew (max_depth)</strong>
                  <br />
                  Określa, jak głęboko każde drzewo może się rozwijać. Głębsze drzewa mogą uchwycić bardziej złożone
                  wzorce, ale mogą też prowadzić do przeuczenia (overfitting) - model zapamięta dane treningowe zamiast
                  się uczyć ogólnych wzorców. Płytsze drzewa są prostsze i szybsze, ale mogą być mniej dokładne.
                  <br />
                  <br />
                  <strong>Zalecane:</strong> Zostaw puste, aby model sam wybrał optymalną głębokość.
                </div>
              </div>
              <label className="block text-xs text-slate-400 mb-2">Maksymalna głębokość drzew</label>
              <input
                type="number"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mt-6"
                value={valuationMaxDepth}
                onChange={(e) => setValuationMaxDepth(e.target.value)}
                placeholder="Auto"
                min="1"
              />
              <p className="text-xs text-slate-500 mt-1.5">Zostaw puste dla automatycznego wyboru</p>
            </div>

            {/* Proporcja danych testowych */}
            <div className="p-3 rounded bg-slate-900/60 border border-slate-700/50 relative">
              <div className="chart-help-container" style={{ position: "relative" }}>
                <div className="chart-help-icon" style={{ top: "0.5rem", right: "0.5rem" }}>
                  ?
                </div>
                <div
                  className="chart-help-tooltip"
                  style={{
                    top: "2.5rem",
                    right: "0",
                    width: "320px",
                    fontSize: "0.75rem",
                    padding: "0.75rem",
                    zIndex: 10000,
                  }}
                >
                  <strong className="text-cyan-300">Proporcja danych testowych (test_size)</strong>
                  <br />
                  Określa, jaki procent danych zostanie użyty do testowania modelu (reszta idzie na trening). Dane
                  testowe nie są używane podczas treningu - służą do oceny, jak dobrze model radzi sobie z nowymi,
                  nieznanymi danymi.
                  <br />
                  <br />
                  <strong>Typowe wartości:</strong> 0.2 (20% na test) lub 0.3 (30% na test). Większy zbiór testowy daje
                  bardziej wiarygodną ocenę, ale mniejszy zbiór treningowy może obniżyć dokładność modelu.
                </div>
              </div>
              <label className="block text-xs text-slate-400 mb-2">Proporcja danych testowych</label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="range"
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                  min="0.1"
                  max="0.5"
                  step="0.05"
                  value={valuationTestSize}
                  onChange={(e) => setValuationTestSize(e.target.value)}
                />
                <span className="text-sm font-semibold text-blue-400 bg-blue-900/30 px-2 py-1 rounded min-w-[60px] text-center">
                  {(Number(valuationTestSize) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>10%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Ziarno losowe */}
            <div className="p-3 rounded bg-slate-900/60 border border-slate-700/50 relative">
              <div className="chart-help-container" style={{ position: "relative" }}>
                <div className="chart-help-icon" style={{ top: "0.5rem", right: "0.5rem" }}>
                  ?
                </div>
                <div
                  className="chart-help-tooltip"
                  style={{
                    top: "2.5rem",
                    right: "0",
                    width: "320px",
                    fontSize: "0.75rem",
                    padding: "0.75rem",
                    zIndex: 10000,
                  }}
                >
                  <strong className="text-purple-300">Ziarno losowe (random_state)</strong>
                  <br />
                  Kontroluje losowość w procesie treningu modelu. Ustawienie tej samej wartości ziarna daje powtarzalne
                  wyniki - za każdym razem, gdy trenujesz model z tym samym ziarnem, otrzymasz identyczne rezultaty. To
                  jest przydatne do porównywania różnych ustawień modelu.
                  <br />
                  <br />
                  <strong>Zalecane:</strong> Zostaw domyślną wartość (42) dla powtarzalności. Różne wartości ziarna mogą
                  dać nieco różne wyniki, ale ogólna dokładność powinna być podobna.
                </div>
              </div>
              <label className="block text-xs text-slate-400 mb-2">Ziarno losowe</label>
              <input
                type="number"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 mt-6"
                value={valuationRandomState}
                onChange={(e) => setValuationRandomState(e.target.value)}
                placeholder="42"
                min="0"
              />
              <p className="text-xs text-slate-500 mt-1.5">Ta sama wartość = powtarzalne wyniki</p>
            </div>

            {/* Minimalna liczba próbek do podziału */}
            <div className="p-3 rounded bg-slate-900/60 border border-slate-700/50 relative">
              <div className="chart-help-container" style={{ position: "relative" }}>
                <div className="chart-help-icon" style={{ top: "0.5rem", right: "0.5rem" }}>
                  ?
                </div>
                <div
                  className="chart-help-tooltip"
                  style={{
                    top: "2.5rem",
                    right: "0",
                    width: "320px",
                    fontSize: "0.75rem",
                    padding: "0.75rem",
                    zIndex: 10000,
                  }}
                >
                  <strong className="text-yellow-300">Minimalna liczba próbek do podziału (min_samples_split)</strong>
                  <br />
                  Określa minimalną liczbę próbek wymaganą do podziału węzła w drzewie. Większe wartości zapobiegają
                  przeuczeniu, ale mogą prowadzić do zbyt prostych modeli. Mniejsze wartości pozwalają na bardziej
                  szczegółowe drzewa, ale mogą prowadzić do przeuczenia.
                  <br />
                  <br />
                  <strong>Zalecane:</strong> 2-10. Wartość 2 oznacza, że każdy węzeł może być podzielony, jeśli ma co
                  najmniej 2 próbki.
                </div>
              </div>
              <label className="block text-xs text-slate-400 mb-2">Min. próbek do podziału</label>
              <input
                type="number"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 mt-6"
                value={valuationMinSamplesSplit}
                onChange={(e) => setValuationMinSamplesSplit(e.target.value)}
                placeholder="2"
                min="2"
              />
              <p className="text-xs text-slate-500 mt-1.5">Większe wartości = prostsze drzewa</p>
            </div>

            {/* Minimalna liczba próbek w liściu */}
            <div className="p-3 rounded bg-slate-900/60 border border-slate-700/50 relative">
              <div className="chart-help-container" style={{ position: "relative" }}>
                <div className="chart-help-icon" style={{ top: "0.5rem", right: "0.5rem" }}>
                  ?
                </div>
                <div
                  className="chart-help-tooltip"
                  style={{
                    top: "2.5rem",
                    right: "0",
                    width: "320px",
                    fontSize: "0.75rem",
                    padding: "0.75rem",
                    zIndex: 10000,
                  }}
                >
                  <strong className="text-orange-300">Minimalna liczba próbek w liściu (min_samples_leaf)</strong>
                  <br />
                  Określa minimalną liczbę próbek wymaganą w liściu drzewa. Większe wartości zapobiegają przeuczeniu i
                  tworzą bardziej stabilne modele, ale mogą być zbyt konserwatywne. Mniejsze wartości pozwalają na bardziej
                  szczegółowe liście.
                  <br />
                  <br />
                  <strong>Zalecane:</strong> 1-5. Wartość 1 oznacza, że liść może zawierać tylko jedną próbkę.
                </div>
              </div>
              <label className="block text-xs text-slate-400 mb-2">Min. próbek w liściu</label>
              <input
                type="number"
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 mt-6"
                value={valuationMinSamplesLeaf}
                onChange={(e) => setValuationMinSamplesLeaf(e.target.value)}
                placeholder="1"
                min="1"
              />
              <p className="text-xs text-slate-500 mt-1.5">Większe wartości = stabilniejsze modele</p>
            </div>
          </div>
        </div>
      </div>

      <div className="valuation-blocks">
        {/* FORMULARZ WYCENY */}
        <form onSubmit={handleValuationSubmit} className="valuation-form rounded-lg bg-slate-800 p-4">
          <div className="valuation-grid">
            {/* Marka */}
            <div>
              <label className="block text-sm mb-1">Marka</label>
              <select
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                value={valuationBrand}
                onChange={(e) => setValuationBrand(e.target.value)}
              >
                <option value="">— wybierz —</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm mb-1">Model</label>
              <select
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                value={valuationModel}
                onChange={(e) => {
                  setValuationModel(e.target.value);
                  setValuationGeneration("");
                }}
                disabled={!valuationModels.length}
              >
                <option value="">— wybierz —</option>
                {valuationModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Generacja - tylko jeśli są dostępne generacje */}
            {valuationGenerations.length > 0 && (
              <div>
                <label className="block text-sm mb-1">Generacja</label>
                <select
                  className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                  value={valuationGeneration}
                  onChange={(e) => setValuationGeneration(e.target.value)}
                >
                  <option value="">— dowolna —</option>
                  {valuationGenerations.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Rok */}
            <div>
              <label className="block text-sm mb-1">Rok produkcji *</label>
              <input
                type="number"
                className={`w-full rounded bg-slate-900 border px-2 py-1 text-sm ${
                  valuationYear && (Number(valuationYear) < 1950 || Number(valuationYear) > 2025)
                    ? "border-red-500"
                    : "border-slate-700"
                }`}
                value={valuationYear}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || (!isNaN(Number(val)) && Number(val) >= 0)) {
                    setValuationYear(val);
                  }
                }}
                min="1950"
                max="2025"
                required
                placeholder="1950-2025"
              />
              {valuationYear && (Number(valuationYear) < 1950 || Number(valuationYear) > 2025) && (
                <p className="text-xs text-red-400 mt-1">Rok musi być w zakresie 1950-2025</p>
              )}
            </div>

            {/* Przebieg */}
            <div>
              <label className="block text-sm mb-1">Przebieg (km) *</label>
              <input
                type="number"
                className={`w-full rounded bg-slate-900 border px-2 py-1 text-sm ${
                  valuationMileage && (Number(valuationMileage) < 0 || Number(valuationMileage) > 1000000)
                    ? "border-red-500"
                    : "border-slate-700"
                }`}
                value={valuationMileage}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || (!isNaN(Number(val)) && Number(val) >= 0)) {
                    setValuationMileage(val);
                  }
                }}
                min="0"
                max="1000000"
                step="1000"
                required
                placeholder="0-1 000 000"
              />
              {valuationMileage && (Number(valuationMileage) < 0 || Number(valuationMileage) > 1000000) && (
                <p className="text-xs text-red-400 mt-1">Przebieg musi być w zakresie 0-1 000 000 km</p>
              )}
            </div>

            {/* Paliwo */}
            <div>
              <label className="block text-sm mb-1">Paliwo</label>
              <select
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                value={valuationFuel}
                onChange={(e) => setValuationFuel(e.target.value)}
              >
                <option value="">— wybierz —</option>
                {fuelTypes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Skrzynia */}
            <div>
              <label className="block text-sm mb-1">Skrzynia biegów</label>
              <select
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                value={valuationTransmission}
                onChange={(e) => setValuationTransmission(e.target.value)}
              >
                <option value="">— wybierz —</option>
                {transmissions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Pojemność */}
            <div>
              <label className="block text-sm mb-1">Pojemność silnika (cm³) *</label>
              <input
                type="number"
                className={`w-full rounded bg-slate-900 border px-2 py-1 text-sm ${
                  valuationEngine && (Number(valuationEngine) < 500 || Number(valuationEngine) > 8000)
                    ? "border-red-500"
                    : "border-slate-700"
                }`}
                value={valuationEngine}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || (!isNaN(Number(val)) && Number(val) >= 0)) {
                    setValuationEngine(val);
                  }
                }}
                min="500"
                max="8000"
                step="1"
                required
                placeholder="np. 1781"
              />
              {valuationEngine && (Number(valuationEngine) < 500 || Number(valuationEngine) > 8000) && (
                <p className="text-xs text-red-400 mt-1">Pojemność musi być w zakresie 500-8000 cm³</p>
              )}
            </div>
          </div>

          {valuationError && <p className="mt-3 text-sm text-red-400">{valuationError}</p>}

          <div className="mt-6">
            <button
              type="submit"
              className="rounded bg-emerald-600 hover:bg-emerald-500 transition px-4 py-2 text-sm font-semibold"
              disabled={valuationLoading}
            >
              {valuationLoading ? "Obliczam..." : "Wyceń pojazd"}
            </button>
          </div>
        </form>

        {/* Wynik wyceny */}
        {valuationResult && (
          <div className="valuation-result-card rounded-lg bg-slate-800 p-4">
            {/* Szacowana cena */}
            <div className="valuation-price mb-4 chart-help-container">
              <div className="chart-help-icon">?</div>
              <div className="chart-help-tooltip">
                Szacowana cena jest obliczana na podstawie modelu regresji liniowej, który analizuje historyczne dane z
                ofert samochodów. Model uwzględnia parametry pojazdu takie jak marka, model, rok produkcji, przebieg, typ
                paliwa, skrzynia biegów i pojemność silnika. Cena jest estymowana na podstawie podobnych pojazdów w bazie
                danych.
              </div>
              <div className="text-xs text-slate-400 mb-1" style={{ position: "relative" }}>
                Szacowana cena
              </div>
              <div className="text-2xl md:text-3xl font-semibold">{formatPrice(valuationResult.predicted_price)}</div>
            </div>

            {/* Metryki w kafelkach */}
            <div>
              <div className="text-xs text-slate-400 mb-2">Metryki modelu regresji</div>
              <div className="metrics-grid">
                <div className="metric-card chart-help-container">
                  <div className="chart-help-icon">?</div>
                  <div className="chart-help-tooltip">
                    <strong>R² (Współczynnik determinacji)</strong>
                    <br />
                    Mierzy, jak dobrze model pasuje do danych. Wartość od 0 do 1, gdzie:
                    <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                      <li>
                        <strong>1.0</strong> = model idealnie przewiduje ceny
                      </li>
                      <li>
                        <strong>0.8-0.9</strong> = bardzo dobry model
                      </li>
                      <li>
                        <strong>0.6-0.8</strong> = dobry model
                      </li>
                      <li>
                        <strong>&lt;0.6</strong> = model wymaga poprawy
                      </li>
                    </ul>
                  </div>
                  <div className="metric-label">R²</div>
                  <div className="metric-value">{valuationResult.model_metrics.r2.toFixed(3)}</div>
                </div>
                <div className="metric-card chart-help-container">
                  <div className="chart-help-icon">?</div>
                  <div className="chart-help-tooltip">
                    <strong>RMSE (Root Mean Square Error)</strong>
                    <br />
                    Średni błąd przewidywania modelu wyrażony w PLN. Im niższa wartość, tym lepiej. Przykład: RMSE =
                    10,000 PLN oznacza, że średnio model myli się o ±10,000 PLN.
                  </div>
                  <div className="metric-label">RMSE</div>
                  <div className="metric-value">
                    {new Intl.NumberFormat("pl-PL", {
                      maximumFractionDigits: 0,
                    }).format(valuationResult.model_metrics.rmse)}{" "}
                    PLN
                  </div>
                </div>
                <div className="metric-card chart-help-container">
                  <div className="chart-help-icon">?</div>
                  <div className="chart-help-tooltip">
                    <strong>MAE (Mean Absolute Error)</strong>
                    <br />
                    Średni bezwzględny błąd przewidywania w PLN. Podobnie jak RMSE, im niższa wartość, tym lepiej. MAE
                    jest bardziej odporna na wartości odstające niż RMSE.
                  </div>
                  <div className="metric-label">MAE</div>
                  <div className="metric-value">
                    {new Intl.NumberFormat("pl-PL", {
                      maximumFractionDigits: 0,
                    }).format(valuationResult.model_metrics.mae)}{" "}
                    PLN
                  </div>
                </div>
                <div className="metric-card chart-help-container">
                  <div className="chart-help-icon">?</div>
                  <div className="chart-help-tooltip">
                    <strong>Próbka (n_samples)</strong>
                    <br />
                    Liczba ofert pojazdów użytych do trenowania modelu. Im więcej próbek, tym bardziej wiarygodny model.
                    Minimum zalecane: 1000+ ofert dla dobrej jakości modelu.
                  </div>
                  <div className="metric-label">Próbka</div>
                  <div className="metric-value">{valuationResult.model_metrics.n_samples}</div>
                </div>
              </div>
            </div>

            {/* Przycisk zapisz */}
            {user && token && (
              <div className="mt-4">
                <SaveValuationButton
                  valuationResult={valuationResult}
                  valuationForm={{
                    brand: valuationBrand,
                    model: valuationModel,
                    generation: valuationGeneration || null,
                    year: Number(valuationYear),
                    mileage_km: Number(valuationMileage),
                    fuel_type: valuationFuel,
                    transmission: valuationTransmission,
                    engine_capacity_cm3: Number(valuationEngine),
                  }}
                  token={token}
                  onSaved={() => {
                    // Komunikat jest już wyświetlany w komponencie
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

