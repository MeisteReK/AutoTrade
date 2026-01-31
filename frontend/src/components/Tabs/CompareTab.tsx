import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Line, Scatter } from "react-chartjs-2";
import type { VehicleComparisonData } from "../../types";
import { formatPrice } from "../../utils/formatPrice";
import { SaveComparisonButton } from "../SaveComparisonButton";
import API_URL from "../../config/api";

type CompareTabProps = {
  brands: string[];
  fuelTypes: string[];
  transmissions: string[];
  user: { username: string } | null;
  token: string | null;
};

export const CompareTab: React.FC<CompareTabProps> = ({
  brands,
  fuelTypes,
  transmissions,
  user,
  token,
}) => {
  // ====== STAN PORÓWNAŃ ======
  // Formularze pojazdów A i B
  const [compareBrandA, setCompareBrandA] = useState<string>("");
  const [compareModelA, setCompareModelA] = useState<string>("");
  const [compareGenerationA, setCompareGenerationA] = useState<string>("");
  const [compareDisplacementMinA, setCompareDisplacementMinA] = useState<string>("");
  const [compareDisplacementMaxA, setCompareDisplacementMaxA] = useState<string>("");
  const [compareYearMinA, setCompareYearMinA] = useState<string>("");
  const [compareYearMaxA, setCompareYearMaxA] = useState<string>("");
  const [compareFuelA, setCompareFuelA] = useState<string>("");
  const [compareTransmissionA, setCompareTransmissionA] = useState<string>("");

  const [compareBrandB, setCompareBrandB] = useState<string>("");
  const [compareModelB, setCompareModelB] = useState<string>("");
  const [compareGenerationB, setCompareGenerationB] = useState<string>("");
  const [compareDisplacementMinB, setCompareDisplacementMinB] = useState<string>("");
  const [compareDisplacementMaxB, setCompareDisplacementMaxB] = useState<string>("");
  const [compareYearMinB, setCompareYearMinB] = useState<string>("");
  const [compareYearMaxB, setCompareYearMaxB] = useState<string>("");
  const [compareFuelB, setCompareFuelB] = useState<string>("");
  const [compareTransmissionB, setCompareTransmissionB] = useState<string>("");

  const [compareModelsA, setCompareModelsA] = useState<string[]>([]);
  const [compareGenerationsA, setCompareGenerationsA] = useState<string[]>([]);
  const [compareDisplacementsA, setCompareDisplacementsA] = useState<number[]>([]);
  const [compareModelsB, setCompareModelsB] = useState<string[]>([]);
  const [compareGenerationsB, setCompareGenerationsB] = useState<string[]>([]);
  const [compareDisplacementsB, setCompareDisplacementsB] = useState<number[]>([]);

  const [comparisonData, setComparisonData] = useState<VehicleComparisonData | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string>("");

  // Stany dla tabeli porównawczej
  const comparisonTableRef = useRef<HTMLDivElement | null>(null);
  const [isComparisonDragging, setIsComparisonDragging] = useState(false);
  const [comparisonStartX, setComparisonStartX] = useState(0);
  const [comparisonScrollLeft, setComparisonScrollLeft] = useState(0);

  // Pobierz listę generacji dla pojazdu A (porównania)
  useEffect(() => {
    const fetchGenerationsA = async () => {
      if (!compareBrandA || !compareModelA) {
        setCompareGenerationsA([]);
        setCompareGenerationA("");
        return;
      }
      try {
        const res = await axios.get<string[]>(`${API_URL}/generations`, {
          params: { brand: compareBrandA, model: compareModelA },
        });
        setCompareGenerationsA(res.data);
        setCompareGenerationA("");
      } catch (err) {
        console.error(err);
      }
    };
    fetchGenerationsA();
  }, [compareBrandA, compareModelA]);

  // Pobierz listę modeli dla pojazdu A (porównania)
  useEffect(() => {
    const fetchModelsA = async () => {
      if (!compareBrandA) {
        setCompareModelsA([]);
        setCompareModelA("");
        setCompareGenerationsA([]);
        setCompareGenerationA("");
        return;
      }
      try {
        const res = await axios.get<string[]>(`${API_URL}/models`, {
          params: { brand: compareBrandA },
        });
        setCompareModelsA(res.data);
        setCompareModelA("");
        setCompareGenerationsA([]);
        setCompareGenerationA("");
      } catch (err) {
        console.error(err);
      }
    };
    fetchModelsA();
  }, [compareBrandA]);

  // Pobierz listę modeli dla pojazdu B (porównania)
  useEffect(() => {
    const fetchModelsB = async () => {
      if (!compareBrandB) {
        setCompareModelsB([]);
        setCompareModelB("");
        setCompareGenerationsB([]);
        setCompareGenerationB("");
        return;
      }
      try {
        const res = await axios.get<string[]>(`${API_URL}/models`, {
          params: { brand: compareBrandB },
        });
        setCompareModelsB(res.data);
        setCompareModelB("");
        setCompareGenerationsB([]);
        setCompareGenerationB("");
      } catch (err) {
        console.error(err);
      }
    };
    fetchModelsB();
  }, [compareBrandB]);

  // Pobierz listę generacji dla pojazdu B (porównania)
  useEffect(() => {
    const fetchGenerationsB = async () => {
      if (!compareBrandB || !compareModelB) {
        setCompareGenerationsB([]);
        setCompareGenerationB("");
        return;
      }
      try {
        const res = await axios.get<string[]>(`${API_URL}/generations`, {
          params: { brand: compareBrandB, model: compareModelB },
        });
        setCompareGenerationsB(res.data);
        setCompareGenerationB("");
      } catch (err) {
        console.error(err);
      }
    };
    fetchGenerationsB();
  }, [compareBrandB, compareModelB]);

  // Pobierz listę pojemności dla pojazdu A, gdy zmieni się marka lub model
  useEffect(() => {
    const fetchDisplacementsA = async () => {
      if (!compareBrandA || !compareModelA) {
        setCompareDisplacementsA([]);
        setCompareDisplacementMinA("");
        setCompareDisplacementMaxA("");
        return;
      }
      try {
        const res = await axios.get<number[]>(`${API_URL}/displacements`, {
          params: { brand: compareBrandA, model: compareModelA },
        });
        setCompareDisplacementsA(res.data);
        if (compareDisplacementMinA && !res.data.includes(Number(compareDisplacementMinA))) {
          setCompareDisplacementMinA("");
        }
        if (compareDisplacementMaxA && !res.data.includes(Number(compareDisplacementMaxA))) {
          setCompareDisplacementMaxA("");
        }
      } catch (err) {
        console.error(err);
        setCompareDisplacementsA([]);
        setCompareDisplacementMinA("");
        setCompareDisplacementMaxA("");
      }
    };

    fetchDisplacementsA();
  }, [compareBrandA, compareModelA, compareDisplacementMinA, compareDisplacementMaxA]);

  // Pobierz listę pojemności dla pojazdu B, gdy zmieni się marka lub model
  useEffect(() => {
    const fetchDisplacementsB = async () => {
      if (!compareBrandB || !compareModelB) {
        setCompareDisplacementsB([]);
        setCompareDisplacementMinB("");
        setCompareDisplacementMaxB("");
        return;
      }
      try {
        const res = await axios.get<number[]>(`${API_URL}/displacements`, {
          params: { brand: compareBrandB, model: compareModelB },
        });
        setCompareDisplacementsB(res.data);
        if (compareDisplacementMinB && !res.data.includes(Number(compareDisplacementMinB))) {
          setCompareDisplacementMinB("");
        }
        if (compareDisplacementMaxB && !res.data.includes(Number(compareDisplacementMaxB))) {
          setCompareDisplacementMaxB("");
        }
      } catch (err) {
        console.error(err);
        setCompareDisplacementsB([]);
        setCompareDisplacementMinB("");
        setCompareDisplacementMaxB("");
      }
    };

    fetchDisplacementsB();
  }, [compareBrandB, compareModelB, compareDisplacementMinB, compareDisplacementMaxB]);

  const handleCompareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setComparisonError("");
    setComparisonData(null);

    // Walidacja wymaganych pól
    if (!compareBrandA) {
      setComparisonError("Wybierz markę dla pojazdu A.");
      return;
    }
    
    if (!compareModelA) {
      setComparisonError("Wybierz model dla pojazdu A.");
      return;
    }
    
    if (!compareBrandB) {
      setComparisonError("Wybierz markę dla pojazdu B.");
      return;
    }
    
    if (!compareModelB) {
      setComparisonError("Wybierz model dla pojazdu B.");
      return;
    }

    // Walidacja zakresów roku dla pojazdu A
    if (compareYearMinA) {
      const yearMinA = Number(compareYearMinA);
      if (isNaN(yearMinA) || yearMinA < 1990 || yearMinA > 2025) {
        setComparisonError("Rok 'od' dla pojazdu A musi być w zakresie 1990-2025.");
        return;
      }
    }
    
    if (compareYearMaxA) {
      const yearMaxA = Number(compareYearMaxA);
      if (isNaN(yearMaxA) || yearMaxA < 1990 || yearMaxA > 2025) {
        setComparisonError("Rok 'do' dla pojazdu A musi być w zakresie 1990-2025.");
        return;
      }
    }
    
    if (compareYearMinA && compareYearMaxA) {
      const yearMinA = Number(compareYearMinA);
      const yearMaxA = Number(compareYearMaxA);
      if (!isNaN(yearMinA) && !isNaN(yearMaxA) && yearMinA > yearMaxA) {
        setComparisonError("Rok 'od' nie może być większy niż rok 'do' dla pojazdu A.");
        return;
      }
    }
    
    // Walidacja zakresów roku dla pojazdu B
    if (compareYearMinB) {
      const yearMinB = Number(compareYearMinB);
      if (isNaN(yearMinB) || yearMinB < 1990 || yearMinB > 2025) {
        setComparisonError("Rok 'od' dla pojazdu B musi być w zakresie 1990-2025.");
        return;
      }
    }
    
    if (compareYearMaxB) {
      const yearMaxB = Number(compareYearMaxB);
      if (isNaN(yearMaxB) || yearMaxB < 1990 || yearMaxB > 2025) {
        setComparisonError("Rok 'do' dla pojazdu B musi być w zakresie 1990-2025.");
        return;
      }
    }
    
    if (compareYearMinB && compareYearMaxB) {
      const yearMinB = Number(compareYearMinB);
      const yearMaxB = Number(compareYearMaxB);
      if (!isNaN(yearMinB) && !isNaN(yearMaxB) && yearMinB > yearMaxB) {
        setComparisonError("Rok 'od' nie może być większy niż rok 'do' dla pojazdu B.");
        return;
      }
    }
    
    // Walidacja pojemności silnika
    if (compareDisplacementMinA && compareDisplacementMaxA) {
      const dispMinA = Number(compareDisplacementMinA);
      const dispMaxA = Number(compareDisplacementMaxA);
      if (!isNaN(dispMinA) && !isNaN(dispMaxA) && dispMinA > dispMaxA) {
        setComparisonError("Pojemność 'od' nie może być większa niż pojemność 'do' dla pojazdu A.");
        return;
      }
    }
    
    if (compareDisplacementMinB && compareDisplacementMaxB) {
      const dispMinB = Number(compareDisplacementMinB);
      const dispMaxB = Number(compareDisplacementMaxB);
      if (!isNaN(dispMinB) && !isNaN(dispMaxB) && dispMinB > dispMaxB) {
        setComparisonError("Pojemność 'od' nie może być większa niż pojemność 'do' dla pojazdu B.");
        return;
      }
    }

    try {
      setComparisonLoading(true);
      const payload = {
        vehicle_a: {
          brand: compareBrandA,
          model: compareModelA,
          generation: compareGenerationA || null,
          displacement_min: compareDisplacementMinA ? Number(compareDisplacementMinA) : null,
          displacement_max: compareDisplacementMaxA ? Number(compareDisplacementMaxA) : null,
          year_min: compareYearMinA ? Number(compareYearMinA) : null,
          year_max: compareYearMaxA ? Number(compareYearMaxA) : null,
          fuel_type: compareFuelA || null,
          transmission: compareTransmissionA || null,
        },
        vehicle_b: {
          brand: compareBrandB,
          model: compareModelB,
          generation: compareGenerationB || null,
          displacement_min: compareDisplacementMinB ? Number(compareDisplacementMinB) : null,
          displacement_max: compareDisplacementMaxB ? Number(compareDisplacementMaxB) : null,
          year_min: compareYearMinB ? Number(compareYearMinB) : null,
          year_max: compareYearMaxB ? Number(compareYearMaxB) : null,
          fuel_type: compareFuelB || null,
          transmission: compareTransmissionB || null,
        },
      };

      const res = await axios.post<VehicleComparisonData>(`${API_URL}/compare/vehicles`, payload);
      setComparisonData(res.data);
    } catch (err: any) {
      console.error(err);
      setComparisonError(err.response?.data?.detail || "Błąd podczas porównywania pojazdów.");
    } finally {
      setComparisonLoading(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Porównania pojazdów</h2>
      <p className="text-sm text-slate-400 mb-4">
        Porównaj dwa pojazdy pod kątem średnich cen, przebiegów oraz trendów cenowych.
      </p>

      {/* Formularze wyboru pojazdów */}
      <form onSubmit={handleCompareSubmit} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Pojazd A */}
          <div className="rounded-lg bg-slate-800 p-4 border-2 border-blue-500">
            <h3 className="text-md font-semibold mb-3 text-blue-400">Pojazd A</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1">Marka *</label>
                <select
                  className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                  value={compareBrandA}
                  onChange={(e) => setCompareBrandA(e.target.value)}
                  required
                >
                  <option value="">— wybierz —</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Model *</label>
                <select
                  className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                  value={compareModelA}
                  onChange={(e) => setCompareModelA(e.target.value)}
                  disabled={!compareModelsA.length}
                  required
                >
                  <option value="">— wybierz —</option>
                  {compareModelsA.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {compareGenerationsA.length > 0 && (
                <div>
                  <label className="block text-xs mb-1">Generacja</label>
                  <select
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareGenerationA}
                    onChange={(e) => setCompareGenerationA(e.target.value)}
                  >
                    <option value="">— wszystkie —</option>
                    {compareGenerationsA.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {compareDisplacementsA.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1">Pojemność od (cm³)</label>
                    <select
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                      value={compareDisplacementMinA}
                      onChange={(e) => setCompareDisplacementMinA(e.target.value)}
                    >
                      <option value="">— dowolna —</option>
                      {compareDisplacementsA.map((d) => (
                        <option key={`min-a-${d}`} value={d.toString()}>
                          {Math.round(d)} cm³
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Pojemność do (cm³)</label>
                    <select
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                      value={compareDisplacementMaxA}
                      onChange={(e) => setCompareDisplacementMaxA(e.target.value)}
                    >
                      <option value="">— dowolna —</option>
                      {compareDisplacementsA.map((d) => (
                        <option key={`max-a-${d}`} value={d.toString()}>
                          {Math.round(d)} cm³
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1">Rok od</label>
                  <input
                    type="number"
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareYearMinA}
                    onChange={(e) => setCompareYearMinA(e.target.value)}
                    placeholder="np. 2015"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Rok do</label>
                  <input
                    type="number"
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareYearMaxA}
                    onChange={(e) => setCompareYearMaxA(e.target.value)}
                    placeholder="np. 2020"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1">Paliwo</label>
                  <select
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareFuelA}
                    onChange={(e) => setCompareFuelA(e.target.value)}
                  >
                    <option value="">— wszystkie —</option>
                    {fuelTypes.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Skrzynia</label>
                  <select
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareTransmissionA}
                    onChange={(e) => setCompareTransmissionA(e.target.value)}
                  >
                    <option value="">— wszystkie —</option>
                    {transmissions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Pojazd B */}
          <div className="rounded-lg bg-slate-800 p-4 border-2 border-orange-500">
            <h3 className="text-md font-semibold mb-3 text-orange-400">Pojazd B</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1">Marka *</label>
                <select
                  className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                  value={compareBrandB}
                  onChange={(e) => setCompareBrandB(e.target.value)}
                  required
                >
                  <option value="">— wybierz —</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Model *</label>
                <select
                  className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                  value={compareModelB}
                  onChange={(e) => setCompareModelB(e.target.value)}
                  disabled={!compareModelsB.length}
                  required
                >
                  <option value="">— wybierz —</option>
                  {compareModelsB.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {compareGenerationsB.length > 0 && (
                <div>
                  <label className="block text-xs mb-1">Generacja</label>
                  <select
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareGenerationB}
                    onChange={(e) => setCompareGenerationB(e.target.value)}
                  >
                    <option value="">— wszystkie —</option>
                    {compareGenerationsB.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {compareDisplacementsB.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1">Pojemność od (cm³)</label>
                    <select
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                      value={compareDisplacementMinB}
                      onChange={(e) => setCompareDisplacementMinB(e.target.value)}
                    >
                      <option value="">— dowolna —</option>
                      {compareDisplacementsB.map((d) => (
                        <option key={`min-b-${d}`} value={d.toString()}>
                          {Math.round(d)} cm³
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Pojemność do (cm³)</label>
                    <select
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                      value={compareDisplacementMaxB}
                      onChange={(e) => setCompareDisplacementMaxB(e.target.value)}
                    >
                      <option value="">— dowolna —</option>
                      {compareDisplacementsB.map((d) => (
                        <option key={`max-b-${d}`} value={d.toString()}>
                          {Math.round(d)} cm³
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1">Rok od</label>
                  <input
                    type="number"
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareYearMinB}
                    onChange={(e) => setCompareYearMinB(e.target.value)}
                    placeholder="np. 2015"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Rok do</label>
                  <input
                    type="number"
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareYearMaxB}
                    onChange={(e) => setCompareYearMaxB(e.target.value)}
                    placeholder="np. 2020"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1">Paliwo</label>
                  <select
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareFuelB}
                    onChange={(e) => setCompareFuelB(e.target.value)}
                  >
                    <option value="">— wszystkie —</option>
                    {fuelTypes.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Skrzynia</label>
                  <select
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
                    value={compareTransmissionB}
                    onChange={(e) => setCompareTransmissionB(e.target.value)}
                  >
                    <option value="">— wszystkie —</option>
                    {transmissions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={comparisonLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {comparisonLoading ? "Porównywanie..." : "Porównaj pojazdy"}
        </button>

        {comparisonError && <p className="text-red-400 text-sm mt-2">{comparisonError}</p>}
      </form>

      {/* Wyniki porównania */}
      {comparisonData && (
        <div className="space-y-6">
          {/* Tabela porównawcza */}
          <div className="rounded-lg bg-slate-800 p-4 mb-8 chart-help-container">
            <div className="chart-help-icon">?</div>
            <div className="chart-help-tooltip">
              Tabela porównawcza przedstawia kluczowe metryki dla obu pojazdów, w tym średnie ceny, mediany, średnie
              przebiegi, moc silnika i pojemność. Pozwala to na szybkie porównanie podstawowych parametrów obu pojazdów
              w jednym miejscu.
            </div>
            <div className="mb-3">
              <h3 className="text-md font-semibold">Tabela porównawcza</h3>
            </div>
            <div
              ref={comparisonTableRef}
              className="table-container"
              style={{ cursor: isComparisonDragging ? "grabbing" : "grab" }}
              onMouseDown={(e) => {
                setIsComparisonDragging(true);
                setComparisonStartX(e.pageX - (comparisonTableRef.current?.offsetLeft || 0));
                setComparisonScrollLeft(comparisonTableRef.current?.scrollLeft || 0);
              }}
              onMouseLeave={() => setIsComparisonDragging(false)}
              onMouseUp={() => setIsComparisonDragging(false)}
              onMouseMove={(e) => {
                if (!isComparisonDragging) return;
                e.preventDefault();
                const x = e.pageX - (comparisonTableRef.current?.offsetLeft || 0);
                const walk = (x - comparisonStartX) * 2; // szybkość przesuwania
                if (comparisonTableRef.current) {
                  comparisonTableRef.current.scrollLeft = comparisonScrollLeft - walk;
                }
              }}
            >
              <table
                className="w-full text-xs sm:text-sm comparison-table"
                style={{ borderCollapse: "collapse", borderSpacing: 0 }}
              >
                <thead>
                  <tr style={{ borderBottom: "2px solid #4b5563" }}>
                    <th
                      className="px-2 sm:px-3 py-2 text-left whitespace-nowrap"
                      style={{ borderRight: "1px solid #374151", minWidth: "120px" }}
                    >
                      Metryka
                    </th>
                    <th
                      className="px-2 sm:px-3 py-2 text-center text-blue-400 whitespace-nowrap"
                      style={{ borderRight: "1px solid #374151", minWidth: "100px" }}
                    >
                      {comparisonData.vehicle_a_label}
                    </th>
                    <th
                      className="px-2 sm:px-3 py-2 text-center text-orange-400 whitespace-nowrap"
                      style={{ borderRight: "1px solid #374151", minWidth: "100px" }}
                    >
                      {comparisonData.vehicle_b_label}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-center whitespace-nowrap" style={{ minWidth: "80px" }}>
                      Różnica
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #374151" }}>
                    <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: "1px solid #374151" }}>
                      Liczba ofert
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_a.n_offers}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_b.n_offers}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center">
                      {comparisonData.metrics_b.n_offers - comparisonData.metrics_a.n_offers > 0 ? "+" : ""}
                      {comparisonData.metrics_b.n_offers - comparisonData.metrics_a.n_offers}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #374151" }}>
                    <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: "1px solid #374151" }}>
                      Średnia cena
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_a.avg_price ? formatPrice(comparisonData.metrics_a.avg_price) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_b.avg_price ? formatPrice(comparisonData.metrics_b.avg_price) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center">
                      {comparisonData.metrics_a.avg_price && comparisonData.metrics_b.avg_price
                        ? `${comparisonData.metrics_b.avg_price - comparisonData.metrics_a.avg_price > 0 ? "+" : ""}${formatPrice(comparisonData.metrics_b.avg_price - comparisonData.metrics_a.avg_price)}`
                        : "-"}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #374151" }}>
                    <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: "1px solid #374151" }}>
                      Mediana ceny
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_a.median_price ? formatPrice(comparisonData.metrics_a.median_price) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_b.median_price ? formatPrice(comparisonData.metrics_b.median_price) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center">
                      {comparisonData.metrics_a.median_price && comparisonData.metrics_b.median_price
                        ? `${comparisonData.metrics_b.median_price - comparisonData.metrics_a.median_price > 0 ? "+" : ""}${formatPrice(comparisonData.metrics_b.median_price - comparisonData.metrics_a.median_price)}`
                        : "-"}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #374151" }}>
                    <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: "1px solid #374151" }}>
                      Min cena
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_a.min_price ? formatPrice(comparisonData.metrics_a.min_price) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_b.min_price ? formatPrice(comparisonData.metrics_b.min_price) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center">-</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #374151" }}>
                    <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: "1px solid #374151" }}>
                      Max cena
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_a.max_price ? formatPrice(comparisonData.metrics_a.max_price) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_b.max_price ? formatPrice(comparisonData.metrics_b.max_price) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center">-</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #374151" }}>
                    <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: "1px solid #374151" }}>
                      Średni przebieg (km)
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_a.avg_mileage
                        ? new Intl.NumberFormat("pl-PL").format(Math.round(comparisonData.metrics_a.avg_mileage))
                        : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_b.avg_mileage
                        ? new Intl.NumberFormat("pl-PL").format(Math.round(comparisonData.metrics_b.avg_mileage))
                        : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center">
                      {comparisonData.metrics_a.avg_mileage && comparisonData.metrics_b.avg_mileage
                        ? `${comparisonData.metrics_b.avg_mileage - comparisonData.metrics_a.avg_mileage > 0 ? "+" : ""}${new Intl.NumberFormat("pl-PL").format(Math.round(comparisonData.metrics_b.avg_mileage! - comparisonData.metrics_a.avg_mileage!))} km`
                        : "-"}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #374151" }}>
                    <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: "1px solid #374151" }}>
                      Średnia moc (HP)
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_a.avg_power_hp ? Math.round(comparisonData.metrics_a.avg_power_hp) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_b.avg_power_hp ? Math.round(comparisonData.metrics_b.avg_power_hp) : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center">
                      {comparisonData.metrics_a.avg_power_hp && comparisonData.metrics_b.avg_power_hp
                        ? `${comparisonData.metrics_b.avg_power_hp - comparisonData.metrics_a.avg_power_hp > 0 ? "+" : ""}${Math.round(comparisonData.metrics_b.avg_power_hp - comparisonData.metrics_a.avg_power_hp)} HP`
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: "1px solid #374151" }}>
                      Średnia pojemność (cm³)
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_a.avg_displacement_cm3
                        ? Math.round(comparisonData.metrics_a.avg_displacement_cm3)
                        : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: "1px solid #374151" }}>
                      {comparisonData.metrics_b.avg_displacement_cm3
                        ? Math.round(comparisonData.metrics_b.avg_displacement_cm3)
                        : "-"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center">
                      {comparisonData.metrics_a.avg_displacement_cm3 && comparisonData.metrics_b.avg_displacement_cm3
                        ? `${comparisonData.metrics_b.avg_displacement_cm3 - comparisonData.metrics_a.avg_displacement_cm3 > 0 ? "+" : ""}${Math.round(comparisonData.metrics_b.avg_displacement_cm3 - comparisonData.metrics_a.avg_displacement_cm3)} cm³`
                        : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Wykres trendu cenowego */}
          {comparisonData.trend_by_year.length > 0 && (
            <div className="rounded-lg bg-slate-800 p-4 mb-8 chart-help-container">
              <div className="chart-help-icon">?</div>
              <div className="chart-help-tooltip">
                Wykres liniowy porównuje średnią cenę dwóch pojazdów w zależności od roku produkcji. Pozwala zobaczyć,
                jak ceny obu pojazdów zmieniały się w czasie oraz które roczniki są szczególnie wartościowe dla każdego
                z porównywanych modeli. Linia jest ciągła nawet przy braku danych dla niektórych lat.
              </div>
              <h3 className="text-md font-semibold mb-3">Trend cenowy wg roku</h3>
              <div className="w-full" style={{ minHeight: "300px", height: "400px", maxHeight: "600px" }}>
                <Line
                  data={{
                    labels: comparisonData.trend_by_year.map((p) => p.year.toString()),
                    datasets: [
                      {
                        label: comparisonData.vehicle_a_label,
                        data: comparisonData.trend_by_year.map((p) => p.avg_price_a ?? null),
                        borderColor: "rgb(59, 130, 246)",
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        tension: 0.1,
                        spanGaps: true,
                      },
                      {
                        label: comparisonData.vehicle_b_label,
                        data: comparisonData.trend_by_year.map((p) => p.avg_price_b ?? null),
                        borderColor: "rgb(249, 115, 22)",
                        backgroundColor: "rgba(249, 115, 22, 0.1)",
                        tension: 0.1,
                        spanGaps: true,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "top" as const,
                        labels: {
                          color: "#cbd5e1",
                        },
                      },
                      tooltip: {
                        mode: "index",
                        intersect: false,
                      },
                    },
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: "Rok produkcji",
                          color: "#cbd5e1",
                        },
                        ticks: {
                          color: "#94a3b8",
                        },
                        grid: {
                          color: "rgba(148, 163, 184, 0.1)",
                        },
                      },
                      y: {
                        title: {
                          display: true,
                          text: "Średnia cena (PLN)",
                          color: "#cbd5e1",
                        },
                        ticks: {
                          color: "#94a3b8",
                          callback: function (value) {
                            return new Intl.NumberFormat("pl-PL").format(Number(value));
                          },
                        },
                        grid: {
                          color: "rgba(148, 163, 184, 0.1)",
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {/* Wykres cena vs przebieg */}
          {(comparisonData.price_mileage_a.length > 0 || comparisonData.price_mileage_b.length > 0) &&
            (() => {
              // Funkcja obliczająca linię średniej dla danego pojazdu
              const calculateAverageLine = (data: any[]) => {
                if (!data || data.length === 0) return [];

                const minMileage = Math.min(...data.map((p: any) => p.mileage_km));
                const maxMileage = Math.max(...data.map((p: any) => p.mileage_km));
                const range = maxMileage - minMileage;
                if (range === 0) return [];

                const numBins = Math.min(15, Math.max(5, Math.ceil(data.length / 100))); // 5-15 przedziałów
                const binSize = range / numBins;

                const bins: { mileage: number; prices: number[] }[] = [];

                // Inicjalizuj przedziały
                for (let i = 0; i < numBins; i++) {
                  const binMileage = minMileage + (i + 0.5) * binSize;
                  bins.push({ mileage: binMileage, prices: [] });
                }

                // Przypisz punkty do przedziałów
                data.forEach((point: any) => {
                  const binIndex = Math.min(
                    Math.floor((point.mileage_km - minMileage) / binSize),
                    numBins - 1
                  );
                  if (binIndex >= 0 && binIndex < bins.length) {
                    bins[binIndex].prices.push(point.price_pln);
                  }
                });

                // Oblicz średnie i zwróć tylko przedziały z danymi
                return bins
                  .filter((bin) => bin.prices.length > 0)
                  .map((bin) => ({
                    x: bin.mileage,
                    y: bin.prices.reduce((sum: number, p: number) => sum + p, 0) / bin.prices.length,
                  }))
                  .sort((a, b) => a.x - b.x);
              };

              const priceMileageA = comparisonData.price_mileage_a || [];
              const priceMileageB = comparisonData.price_mileage_b || [];
              const averageLineA = calculateAverageLine(priceMileageA);
              const averageLineB = calculateAverageLine(priceMileageB);

              // Buduj dataset'y - najpierw punkty, potem linie średniej (linie będą na wierzchu)
              const datasets: any[] = [
                {
                  label: comparisonData.vehicle_a_label,
                  data: priceMileageA.map((p: any) => ({
                    x: p.mileage_km,
                    y: p.price_pln,
                  })),
                  backgroundColor: "rgba(59, 130, 246, 0.5)",
                  borderColor: "rgb(59, 130, 246)",
                  pointRadius: 3,
                  pointHoverRadius: 5,
                  order: 4, // Rysuj najpierw (niżej)
                },
                {
                  label: comparisonData.vehicle_b_label,
                  data: priceMileageB.map((p: any) => ({
                    x: p.mileage_km,
                    y: p.price_pln,
                  })),
                  backgroundColor: "rgba(249, 115, 22, 0.5)",
                  borderColor: "rgb(249, 115, 22)",
                  pointRadius: 3,
                  pointHoverRadius: 5,
                  order: 3, // Rysuj po pojazdzie A
                },
              ];

              // Dodaj linię średniej dla pojazdu A
              if (averageLineA.length >= 2) {
                datasets.push({
                  type: "line" as const,
                  label: `Średnia - ${comparisonData.vehicle_a_label}`,
                  data: averageLineA,
                  borderColor: "rgba(234, 179, 8, 1)", // Żółty
                  backgroundColor: "rgba(234, 179, 8, 0.1)",
                  borderWidth: 3,
                  pointRadius: 5,
                  pointHoverRadius: 8,
                  pointBackgroundColor: "rgba(234, 179, 8, 1)",
                  pointBorderColor: "rgba(59, 130, 246, 1)",
                  pointBorderWidth: 2,
                  fill: false,
                  tension: 0.3,
                  spanGaps: false,
                  order: 2, // Rysuj wyżej niż punkty
                });
              }

              // Dodaj linię średniej dla pojazdu B
              if (averageLineB.length >= 2) {
                datasets.push({
                  type: "line" as const,
                  label: `Średnia - ${comparisonData.vehicle_b_label}`,
                  data: averageLineB,
                  borderColor: "rgba(236, 72, 153, 1)", // Różowy
                  backgroundColor: "rgba(236, 72, 153, 0.1)",
                  borderWidth: 3,
                  pointRadius: 5,
                  pointHoverRadius: 8,
                  pointBackgroundColor: "rgba(236, 72, 153, 1)",
                  pointBorderColor: "rgba(249, 115, 22, 1)",
                  pointBorderWidth: 2,
                  fill: false,
                  tension: 0.3,
                  spanGaps: false,
                  order: 1, // Rysuj najwyżej
                });
              }

              return (
                <div className="rounded-lg bg-slate-800 p-4 chart-help-container">
                  <div className="chart-help-icon">?</div>
                  <div className="chart-help-tooltip">
                    Wykres punktowy porównuje zależność między ceną a przebiegiem dla obu pojazdów. Każdy punkt
                    reprezentuje jedną ofertę. Różne kolory oznaczają różne pojazdy (A i B). Żółta i różowa linia
                    przedstawiają średnią cenę w przedziałach przebiegu dla każdego pojazdu, co pozwala zobaczyć ogólny
                    trend. Wykres pomaga zidentyfikować różnice w cenach przy podobnym przebiegu oraz zobaczyć, jak
                    przebieg wpływa na cenę dla każdego z pojazdów.
                  </div>
                  <h3 className="text-md font-semibold mb-3">Cena vs Przebieg</h3>
                  <div className="w-full" style={{ minHeight: "300px", height: "400px", maxHeight: "600px" }}>
                    <Scatter
                      data={{
                        datasets: datasets,
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                          mode: "point" as const,
                        },
                        plugins: {
                          legend: {
                            position: "top" as const,
                            labels: {
                              color: "#cbd5e1",
                              usePointStyle: true,
                              padding: 15,
                              font: {
                                size: 12,
                              },
                            },
                          },
                          tooltip: {
                            callbacks: {
                              label: function (context) {
                                const x = typeof context.parsed.x === "number" ? context.parsed.x : 0;
                                const y = typeof context.parsed.y === "number" ? context.parsed.y : 0;
                                if ((context.dataset as any).type === "line") {
                                  return `${context.dataset.label}: ${formatPrice(y)} (średnia przy ${new Intl.NumberFormat("pl-PL").format(x)} km)`;
                                }
                                return `${context.dataset.label}: ${formatPrice(y)} (${new Intl.NumberFormat("pl-PL").format(x)} km)`;
                              },
                            },
                          },
                        },
                        scales: {
                          x: {
                            title: {
                              display: true,
                              text: "Przebieg (km)",
                              color: "#cbd5e1",
                            },
                            ticks: {
                              color: "#94a3b8",
                              callback: function (value) {
                                return new Intl.NumberFormat("pl-PL").format(Number(value));
                              },
                            },
                            grid: {
                              color: "rgba(148, 163, 184, 0.1)",
                            },
                          },
                          y: {
                            title: {
                              display: true,
                              text: "Cena (PLN)",
                              color: "#cbd5e1",
                            },
                            ticks: {
                              color: "#94a3b8",
                              callback: function (value) {
                                return new Intl.NumberFormat("pl-PL").format(Number(value));
                              },
                            },
                            grid: {
                              color: "rgba(148, 163, 184, 0.1)",
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              );
            })()}

          {/* Przycisk zapisz porównanie - na dole */}
          {user && token && (
            <div className="mt-6">
              <SaveComparisonButton
                comparisonData={comparisonData}
                token={token}
                onSaved={() => {
                  // Komunikat jest już wyświetlany w komponencie
                }}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
};

