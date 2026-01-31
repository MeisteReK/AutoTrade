import React, { useState } from "react";
import { Scatter, Bar } from "react-chartjs-2";
import { AnalyticsErrorBoundary } from "../AnalyticsErrorBoundary";
import { formatPrice } from "../../utils/formatPrice";
import type {
  PriceMileagePoint,
  PriceStatsByCategoryResponse,
  PriceStatistics,
} from "../../types";

type AnalyticsTabProps = {
  priceMileageData: PriceMileagePoint[];
  priceStatsByCategory: PriceStatsByCategoryResponse | null;
  priceStatistics: PriceStatistics | null;
  loading: boolean;
  errorMsg: string;
};

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  priceMileageData,
  priceStatsByCategory,
  priceStatistics,
  loading,
  errorMsg,
}) => {
  const [histogramBinWidth, setHistogramBinWidth] = useState<number>(10000);
  const [histogramMin, setHistogramMin] = useState<number | null>(null);
  const [histogramMax, setHistogramMax] = useState<number | null>(null);

  return (
    <AnalyticsErrorBoundary>
      {(() => {
        try {
          return (
            <section>
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Analizy zaawansowane</h2>
                <p className="text-sm text-slate-400 mb-4">
                  Wykresy eksploracyjne pomagające zrozumieć czynniki cenotwórcze.
                </p>
              </div>
              {errorMsg && errorMsg.includes("analitycznych") && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
                  {errorMsg}
                </div>
              )}
              {loading && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded text-sm text-blue-300">
                  Ładowanie danych analitycznych...
                </div>
              )}

              {/* Wykres punktowy: Cena vs Przebieg */}
              <div className="rounded-lg bg-slate-800 p-4 mb-6 chart-help-container">
                <div className="chart-help-icon">?</div>
                <div className="chart-help-tooltip">
                  Wykres punktowy pokazuje zależność między ceną a przebiegiem pojazdów. Każdy punkt reprezentuje jedną ofertę. Zielona linia przedstawia średnią cenę w przedziałach przebiegu, co pozwala zobaczyć ogólny trend. Dla wydajności wykres wyświetla maksymalnie 5000 losowo wybranych punktów (jeśli jest więcej ofert), ale linia średniej jest obliczana na podstawie wszystkich dostępnych danych. Wykres pomaga zidentyfikować, czy wyższy przebieg wpływa na obniżenie ceny oraz jak rozproszone są ceny w zależności od przebiegu.
                </div>
                <h3 className="text-md font-semibold mb-3 text-slate-200">
                  Cena vs. Przebieg
                </h3>
                {(() => {
                  // Sprawdź czy dane są dostępne
                  if (!priceMileageData || !Array.isArray(priceMileageData) || priceMileageData.length === 0) {
                    return (
                      <p className="text-slate-400 text-sm">
                        Brak danych do wyświetlenia. Ustaw filtry i kliknij "Zastosuj filtry".
                      </p>
                    );
                  }

                  try {
                    // Maksymalna liczba punktów do wyświetlenia na wykresie scatter (dla wydajności)
                    // Zmniejszono z 5000 do 3000 dla lepszej wydajności przy dużych zbiorach danych
                    const MAX_SCATTER_POINTS = 3000;
                    
                    // Ostrzeżenie jeśli mamy dużo danych
                    const dataCount = priceMileageData.length;
                    const showWarning = dataCount > 10000;
                    
                    // Próbkowanie danych dla wykresu scatter (zachowaj wszystkie dane dla obliczenia średniej)
                    const sampleDataForScatter = (data: PriceMileagePoint[], maxPoints: number): PriceMileagePoint[] => {
                      if (!data || data.length === 0) return [];
                      
                      // Filtruj tylko poprawne dane
                      const validData = data.filter(p => p && typeof p.mileage_km === 'number' && typeof p.price_pln === 'number' && !isNaN(p.mileage_km) && !isNaN(p.price_pln));
                      if (validData.length === 0) return [];
                      
                      if (validData.length <= maxPoints) return validData;
                      
                      // Równomierne próbkowanie - co n-ty punkt
                      const step = Math.ceil(validData.length / maxPoints);
                      const sampled: PriceMileagePoint[] = [];
                      
                      for (let i = 0; i < validData.length; i += step) {
                        if (validData[i]) {
                          sampled.push(validData[i]);
                          if (sampled.length >= maxPoints) break;
                        }
                      }
                      
                      return sampled;
                    };
                    
                    const scatterData = sampleDataForScatter(priceMileageData, MAX_SCATTER_POINTS);
                    if (scatterData.length === 0) {
                      return (
                        <p className="text-slate-400 text-sm">
                          Brak poprawnych danych do wyświetlenia. Ustaw filtry i kliknij "Zastosuj filtry".
                        </p>
                      );
                    }
                    
                    // Ostrzeżenie dla dużych zbiorów danych
                    const warningMessage = showWarning ? (
                      <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded text-sm text-yellow-300">
                        <p className="font-semibold mb-1">⚠️ Duży zbiór danych ({dataCount.toLocaleString('pl-PL')} punktów)</p>
                        <p className="text-xs">
                          Wykres wyświetla próbkę {scatterData.length.toLocaleString('pl-PL')} punktów dla lepszej wydajności. 
                          Linia średniej jest obliczana na podstawie wszystkich {dataCount.toLocaleString('pl-PL')} punktów.
                        </p>
                        <p className="text-xs mt-2 text-yellow-400">
                          💡 Wskazówka: Zawęź filtry (np. wybierz konkretną markę/model) dla szybszego działania i pełnych danych.
                        </p>
                      </div>
                    ) : null;
                    
                    // Oblicz średnią cenę w przedziałach przebiegu (użyj WSZYSTKICH danych)
                    const calculateAverageLine = () => {
                      if (!priceMileageData || priceMileageData.length === 0) return [];
                      
                      // Sprawdź czy wszystkie punkty mają wymagane właściwości
                      const validData = priceMileageData.filter(p => p && typeof p.mileage_km === 'number' && typeof p.price_pln === 'number');
                      if (validData.length === 0) return [];
                      
                      const minMileage = Math.min(...validData.map(p => p.mileage_km));
                      const maxMileage = Math.max(...validData.map(p => p.mileage_km));
                      const range = maxMileage - minMileage;
                      if (range <= 0) return [];
                      
                      const numBins = Math.min(15, Math.max(5, Math.ceil(validData.length / 100))); // 5-15 przedziałów
                      const binSize = range / numBins;
                      if (binSize <= 0) return [];
                      
                      const bins: { mileage: number; prices: number[] }[] = [];
                      
                      // Inicjalizuj przedziały
                      for (let i = 0; i < numBins; i++) {
                        const binMileage = minMileage + (i + 0.5) * binSize;
                        bins.push({ mileage: binMileage, prices: [] });
                      }
                      
                      // Przypisz punkty do przedziałów (użyj WSZYSTKICH danych)
                      validData.forEach(point => {
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
                        .filter(bin => bin.prices.length > 0)
                        .map(bin => ({
                          x: bin.mileage,
                          y: bin.prices.reduce((sum, p) => sum + p, 0) / bin.prices.length,
                        }))
                        .sort((a, b) => a.x - b.x);
                    };
                    
                    const averageLineData = calculateAverageLine();
                    
                    // Buduj dataset - najpierw punkty (próbkowane), potem linia (linia będzie na wierzchu)
                    const datasets: any[] = [];
                    
                    // Dodaj punkty tylko jeśli są poprawne dane
                    if (scatterData && scatterData.length > 0) {
                      const validScatterPoints = scatterData
                        .filter(p => p && typeof p.mileage_km === 'number' && typeof p.price_pln === 'number' && !isNaN(p.mileage_km) && !isNaN(p.price_pln))
                        .map((p) => ({
                          x: p.mileage_km,
                          y: p.price_pln,
                        }));
                      
                      if (validScatterPoints.length > 0) {
                        datasets.push({
                          label: `Oferty${priceMileageData.length > MAX_SCATTER_POINTS ? ` (próbka ${scatterData.length.toLocaleString('pl-PL')} z ${priceMileageData.length.toLocaleString('pl-PL')})` : ''}`,
                          data: validScatterPoints,
                          backgroundColor: "rgba(59, 130, 246, 0.5)",
                          borderColor: "rgba(59, 130, 246, 1)",
                          pointRadius: 3,
                          pointHoverRadius: 5,
                          order: 2, // Rysuj najpierw (niżej)
                        });
                      }
                    }
                    
                    // Dodaj linię średniej tylko jeśli są dane - będzie rysowana na końcu (na wierzchu)
                    if (averageLineData.length >= 2) {
                      datasets.push({
                        type: 'line' as const,
                        label: "Średnia cena",
                        data: averageLineData,
                        borderColor: "rgba(16, 185, 129, 1)",
                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                        borderWidth: 4,
                        pointRadius: 6,
                        pointHoverRadius: 9,
                        pointBackgroundColor: "rgba(16, 185, 129, 1)",
                        pointBorderColor: "rgba(255, 255, 255, 1)",
                        pointBorderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        spanGaps: false,
                        order: 1, // Rysuj na końcu (wyżej)
                      });
                    }
                    
                    const commonOptions = {
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: {
                        mode: 'point' as const,
                      },
                      plugins: {
                        legend: {
                          display: true,
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
                            label: (context: any) => {
                              if (context.datasetIndex === 0) {
                                const point = context.raw as { x: number; y: number };
                                return [
                                  `Przebieg: ${new Intl.NumberFormat("pl-PL").format(point.x)} km`,
                                  `Cena: ${formatPrice(point.y)}`,
                                ];
                              } else {
                                const point = context.raw as { x: number; y: number };
                                return [
                                  `Przebieg: ${new Intl.NumberFormat("pl-PL").format(point.x)} km`,
                                  `Średnia cena: ${formatPrice(point.y)}`,
                                ];
                              }
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          type: 'linear' as const,
                          title: {
                            display: true,
                            text: "Przebieg (km)",
                            color: "#cbd5e1",
                          },
                          ticks: {
                            color: "#94a3b8",
                            callback: function (value: any) {
                              return new Intl.NumberFormat("pl-PL").format(Number(value));
                            },
                          },
                          grid: {
                            color: "rgba(148, 163, 184, 0.1)",
                          },
                        },
                        y: {
                          type: 'linear' as const,
                          title: {
                            display: true,
                            text: "Cena (PLN)",
                            color: "#cbd5e1",
                            padding: {
                              top: 0,
                              bottom: 20,
                            },
                          },
                          ticks: {
                            color: "#94a3b8",
                            padding: 10,
                            callback: function (value: any) {
                              return new Intl.NumberFormat("pl-PL", {
                                style: "currency",
                                currency: "PLN",
                                maximumFractionDigits: 0,
                              }).format(Number(value));
                            },
                          },
                          grid: {
                            color: "rgba(148, 163, 184, 0.1)",
                          },
                        },
                      },
                    };
                    
                    // Sprawdź czy są dane do wyświetlenia
                    if (!datasets || datasets.length === 0) {
                      return (
                        <p className="text-slate-400 text-sm">
                          Brak poprawnych danych do wyświetlenia. Ustaw filtry i kliknij "Zastosuj filtry".
                        </p>
                      );
                    }
                    
                    return (
                      <>
                        {warningMessage}
                        <div className="w-full" style={{ minHeight: '300px', height: '400px', maxHeight: '600px' }}>
                          <Scatter
                            data={{
                              datasets: datasets,
                            }}
                            options={commonOptions}
                          />
                        </div>
                      </>
                    );
                  } catch (error) {
                    console.error("Błąd podczas renderowania wykresu:", error);
                    return (
                      <div className="p-4 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
                        Wystąpił błąd podczas renderowania wykresu. Spróbuj odświeżyć stronę.
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Histogram rozkładu cen */}
              <div className="rounded-lg bg-slate-800 p-4 mb-6 chart-help-container">
                <div className="chart-help-icon">?</div>
                <div className="chart-help-tooltip">
                  Histogram przedstawia rozkład cen pojazdów - pokazuje, ile ofert znajduje się w poszczególnych przedziałach cenowych. Wysokość słupka oznacza liczbę ofert w danym przedziale. Histogram jest tworzony na podstawie wszystkich dostępnych danych (zgodnie z ustawionymi filtrami). Pozwala zidentyfikować najpopularniejsze przedziały cenowe oraz zauważyć, czy rozkład jest symetryczny czy skośny. Możesz dostosować szerokość przedziałów (koszyków) oraz zakres cenowy (początek i koniec przedziału) za pomocą kontrolek poniżej. Ustawienie zakresu cenowego pozwala skupić się na konkretnym przedziale cenowym i dokładniej analizować rozkład w tym zakresie.
                </div>
                <div className="mb-4">
                  <h3 className="text-md font-semibold text-slate-200 mb-4">
                    Rozkład cen
                  </h3>
                  
                  {/* Sekcja kontrolek */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Zakres cenowy */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-slate-200">
                          Zakres cenowy
                        </label>
                        {(histogramMin !== null || histogramMax !== null) && (
                          <button
                            onClick={() => {
                              setHistogramMin(null);
                              setHistogramMax(null);
                            }}
                            className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors"
                          >
                            Resetuj
                          </button>
                        )}
                      </div>
                      {priceMileageData && priceMileageData.length > 0 && (() => {
                        const prices = priceMileageData.map((p) => p.price_pln);
                        const dataMin = prices.length > 0 ? Math.min(...prices) : 0;
                        const dataMax = prices.length > 0 ? Math.max(...prices) : 0;
                        return (
                          <div className="mb-2">
                            <p className="text-xs text-slate-400 mb-2">
                              Dostępny zakres: {new Intl.NumberFormat("pl-PL").format(dataMin)} - {new Intl.NumberFormat("pl-PL").format(dataMax)} PLN
                            </p>
                          </div>
                        );
                      })()}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">
                            Od (PLN)
                          </label>
                          <input
                            type="number"
                            value={histogramMin ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : Number(e.target.value);
                              setHistogramMin(val);
                              if (val !== null && histogramMax !== null && val >= histogramMax) {
                                setHistogramMax(val + 1000);
                              }
                            }}
                            placeholder="Auto"
                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">
                            Do (PLN)
                          </label>
                          <input
                            type="number"
                            value={histogramMax ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : Number(e.target.value);
                              setHistogramMax(val);
                              if (val !== null && histogramMin !== null && val <= histogramMin) {
                                setHistogramMin(val - 1000);
                              }
                            }}
                            placeholder="Auto"
                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Szerokość koszyka */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-slate-200">
                          Szerokość koszyka
                        </label>
                        <span className="text-sm text-slate-200 font-semibold bg-blue-500/20 px-2 py-1 rounded">
                          {new Intl.NumberFormat("pl-PL").format(histogramBinWidth)} PLN
                        </span>
                      </div>
                      <div className="flex items-center gap-2 w-full pt-2">
                        <input
                          type="range"
                          min="1000"
                          max="100000"
                          step="1000"
                          value={histogramBinWidth}
                          onChange={(e) => setHistogramBinWidth(Number(e.target.value))}
                          className="slider flex-1"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                        <span>1 000 PLN</span>
                        <span>100 000 PLN</span>
                      </div>
                    </div>
                  </div>
                </div>
                {priceMileageData && priceMileageData.length > 0 ? (() => {
                  try {
                    const prices = priceMileageData.map((p) => p.price_pln).filter(p => typeof p === 'number' && !isNaN(p));
                    if (prices.length === 0) {
                      return (
                        <p className="text-slate-400 text-sm">
                          Brak poprawnych danych do wyświetlenia.
                        </p>
                      );
                    }
                    
                    const dataMin = Math.min(...prices);
                    const dataMax = Math.max(...prices);
                    const min = histogramMin !== null ? histogramMin : dataMin;
                    const max = histogramMax !== null ? histogramMax : dataMax;
                    
                    // Filtruj dane do zakresu
                    const filteredPrices = prices.filter(p => p >= min && p <= max);
                    
                    if (filteredPrices.length === 0) {
                      return (
                        <p className="text-slate-400 text-sm">
                          Brak danych w wybranym zakresie cenowym. Dostępny zakres: {new Intl.NumberFormat("pl-PL").format(dataMin)} - {new Intl.NumberFormat("pl-PL").format(dataMax)} PLN
                        </p>
                      );
                    }
                    
                    // Oblicz etykiety przedziałów
                    const bins: string[] = [];
                    for (let i = min; i < max; i += histogramBinWidth) {
                      const binEnd = Math.min(i + histogramBinWidth, max);
                      bins.push(
                        `${new Intl.NumberFormat("pl-PL", {
                          maximumFractionDigits: 0,
                        }).format(i)} - ${new Intl.NumberFormat("pl-PL", {
                          maximumFractionDigits: 0,
                        }).format(binEnd)}`
                      );
                    }
                    
                    // Oblicz dane dla histogramu
                    const binCount = Math.ceil((max - min) / histogramBinWidth);
                    const binsData: number[] = new Array(binCount).fill(0);
                    
                    filteredPrices.forEach((price) => {
                      const binIndex = Math.floor((price - min) / histogramBinWidth);
                      if (binIndex >= 0 && binIndex < binsData.length) {
                        binsData[binIndex]++;
                      }
                    });
                    
                    return (
                      <div className="w-full" style={{ minHeight: '300px', height: '400px', maxHeight: '600px' }}>
                        <Bar
                          data={{
                            labels: bins,
                            datasets: [
                              {
                                label: "Liczba ofert",
                                data: binsData,
                                backgroundColor: "rgba(59, 130, 246, 0.7)",
                                borderColor: "rgba(59, 130, 246, 1)",
                                borderWidth: 1,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: {
                              padding: {
                                bottom: -30,
                              },
                            },
                            plugins: {
                              legend: {
                                display: false,
                              },
                              tooltip: {
                                callbacks: {
                                  label: (context) => {
                                    return `Liczba ofert: ${context.parsed.y}`;
                                  },
                                },
                              },
                            },
                            scales: {
                              x: {
                                title: {
                                  display: true,
                                  text: "Zakres cen (PLN)",
                                  color: "#cbd5e1",
                                  padding: {
                                    top: 10,
                                  },
                                },
                                ticks: {
                                  color: "#94a3b8",
                                  maxRotation: 45,
                                  minRotation: 45,
                                  padding: 5,
                                },
                                grid: {
                                  color: "rgba(148, 163, 184, 0.1)",
                                },
                              },
                              y: {
                                title: {
                                  display: true,
                                  text: "Liczba ofert",
                                  color: "#cbd5e1",
                                  padding: {
                                    top: 0,
                                    bottom: 10,
                                  },
                                },
                                beginAtZero: true,
                                ticks: {
                                  color: "#94a3b8",
                                  stepSize: 1,
                                  padding: 5,
                                },
                                grid: {
                                  color: "rgba(148, 163, 184, 0.1)",
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    );
                  } catch (error) {
                    console.error("Błąd podczas renderowania histogramu:", error);
                    return (
                      <div className="p-4 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
                        Wystąpił błąd podczas renderowania histogramu. Spróbuj odświeżyć stronę.
                      </div>
                    );
                  }
                })() : (
                  <p className="text-slate-400 text-sm">
                    Brak danych do wyświetlenia. Ustaw filtry i kliknij "Zastosuj filtry".
                  </p>
                )}
              </div>

              {/* Statystyki wg paliwa i skrzyni */}
              {priceStatsByCategory && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ minWidth: 0 }}>
                  {/* Wg paliwa */}
                  <div className="rounded-lg bg-slate-800 p-4 chart-help-container" style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                    <div className="chart-help-icon">?</div>
                    <div className="chart-help-tooltip">
                      Wykres słupkowy porównuje średnią cenę pojazdów w zależności od rodzaju paliwa (benzyna, diesel, hybryda, elektryczny itp.). Pozwala zobaczyć, które typy napędu są droższe, a które tańsze na rynku wtórnym.
                    </div>
                    <h3 className="text-md font-semibold mb-3 text-slate-200">
                      Średnia cena wg paliwa
                    </h3>
                    {priceStatsByCategory && priceStatsByCategory.by_fuel_type && priceStatsByCategory.by_fuel_type.length > 0 ? (
                      <div className="w-full" style={{ minHeight: '250px', height: '320px', maxHeight: '500px', maxWidth: '100%', overflow: 'hidden' }}>
                        <div style={{ width: '100%', maxWidth: '100%', height: '100%' }}>
                          <Bar
                            data={{
                              labels: priceStatsByCategory.by_fuel_type.map((s) => s.category),
                              datasets: [
                                {
                                  label: "Średnia cena",
                                  data: priceStatsByCategory.by_fuel_type.map((s) => s.avg_price),
                                  backgroundColor: "rgba(34, 197, 94, 0.7)",
                                  borderColor: "rgba(34, 197, 94, 1)",
                                  borderWidth: 1,
                                },
                                ...(priceStatsByCategory.by_fuel_type.some((s) => s.median_price !== null)
                                  ? [
                                      {
                                        label: "Mediana ceny",
                                        data: priceStatsByCategory.by_fuel_type.map((s) =>
                                          s.median_price ?? 0
                                        ),
                                        backgroundColor: "rgba(234, 179, 8, 0.7)",
                                        borderColor: "rgba(234, 179, 8, 1)",
                                        borderWidth: 1,
                                      },
                                    ]
                                  : []),
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              resizeDelay: 0,
                              layout: {
                                padding: {
                                  left: 5,
                                  right: 5,
                                  top: 5,
                                  bottom: 5,
                                },
                              },
                              plugins: {
                                legend: {
                                  display: true,
                                  labels: {
                                    color: "#cbd5e1",
                                  },
                                },
                                tooltip: {
                                  callbacks: {
                                    label: (context) => {
                                      const datasetLabel = context.dataset.label || "";
                                      const value = context.parsed.y;
                                      const index = context.dataIndex;
                                      const item = priceStatsByCategory.by_fuel_type[index];
                                      return [
                                        `${datasetLabel}: ${formatPrice(value)}`,
                                        `Liczba ofert: ${item.n_offers}`,
                                      ];
                                    },
                                  },
                                },
                              },
                              scales: {
                                x: {
                                  ticks: {
                                    color: "#94a3b8",
                                    maxRotation: 45,
                                    minRotation: 0,
                                    autoSkip: true,
                                    maxTicksLimit: 10,
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
                                      return new Intl.NumberFormat("pl-PL", {
                                        style: "currency",
                                        currency: "PLN",
                                        maximumFractionDigits: 0,
                                      }).format(Number(value));
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
                    ) : (
                      <p className="text-slate-400 text-sm">Brak danych</p>
                    )}
                  </div>

                  {/* Wg skrzyni biegów */}
                  <div className="rounded-lg bg-slate-800 p-4 mb-6 chart-help-container" style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                    <div className="chart-help-icon">?</div>
                    <div className="chart-help-tooltip">
                      Wykres słupkowy porównuje średnią cenę pojazdów w zależności od typu skrzyni biegów (manualna, automatyczna, CVT itp.). Pomaga zrozumieć, czy automatyczna skrzynia biegów wpływa na wyższą cenę pojazdu. Wykres pokazuje zarówno średnią, jak i medianę ceny dla każdego typu skrzyni.
                    </div>
                    <h3 className="text-md font-semibold mb-3 text-slate-200">
                      Średnia cena wg skrzyni biegów
                    </h3>
                    {priceStatsByCategory && priceStatsByCategory.by_transmission && priceStatsByCategory.by_transmission.length > 0 ? (
                      <div className="w-full" style={{ minHeight: '250px', height: '320px', maxHeight: '500px', maxWidth: '100%', overflow: 'hidden' }}>
                        <div style={{ width: '100%', maxWidth: '100%', height: '100%' }}>
                          <Bar
                            data={{
                              labels: priceStatsByCategory.by_transmission.map((s) => s.category),
                              datasets: [
                                {
                                  label: "Średnia cena",
                                  data: priceStatsByCategory.by_transmission.map((s) => s.avg_price),
                                  backgroundColor: "rgba(59, 130, 246, 0.7)",
                                  borderColor: "rgba(59, 130, 246, 1)",
                                  borderWidth: 1,
                                },
                                ...(priceStatsByCategory.by_transmission.some((s) => s.median_price !== null)
                                  ? [
                                      {
                                        label: "Mediana ceny",
                                        data: priceStatsByCategory.by_transmission.map((s) =>
                                          s.median_price ?? 0
                                        ),
                                        backgroundColor: "rgba(234, 179, 8, 0.7)",
                                        borderColor: "rgba(234, 179, 8, 1)",
                                        borderWidth: 1,
                                      },
                                    ]
                                  : []),
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              resizeDelay: 0,
                              layout: {
                                padding: {
                                  left: 5,
                                  right: 5,
                                  top: 5,
                                  bottom: 5,
                                },
                              },
                              plugins: {
                                legend: {
                                  display: true,
                                  labels: {
                                    color: "#cbd5e1",
                                  },
                                },
                                tooltip: {
                                  callbacks: {
                                    label: (context) => {
                                      const datasetLabel = context.dataset.label || "";
                                      const value = context.parsed.y;
                                      const index = context.dataIndex;
                                      const item = priceStatsByCategory.by_transmission[index];
                                      return [
                                        `${datasetLabel}: ${formatPrice(value)}`,
                                        `Liczba ofert: ${item.n_offers}`,
                                      ];
                                    },
                                  },
                                },
                              },
                              scales: {
                                x: {
                                  ticks: {
                                    color: "#94a3b8",
                                    maxRotation: 45,
                                    minRotation: 0,
                                    autoSkip: true,
                                    maxTicksLimit: 10,
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
                                      return new Intl.NumberFormat("pl-PL", {
                                        style: "currency",
                                        currency: "PLN",
                                        maximumFractionDigits: 0,
                                      }).format(Number(value));
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
                    ) : (
                      <p className="text-slate-400 text-sm">Brak danych</p>
                    )}
                  </div>
                </div>
              )}

              {/* Statystyki szczegółowe */}
              {priceStatistics && priceStatistics.n_offers > 0 && (
                <div className="rounded-lg bg-slate-800 p-4 mb-6 chart-help-container">
                  <div className="chart-help-icon">?</div>
                  <div className="chart-help-tooltip">
                    Szczegółowe statystyki cenowe: <strong>Średnia</strong> - średnia arytmetyczna wszystkich cen; <strong>Mediana</strong> - wartość środkowa (50% ofert ma cenę poniżej, 50% powyżej); <strong>Odchylenie standardowe</strong> - miara rozproszenia cen (im wyższe, tym większe zróżnicowanie); <strong>Q1 (25%)</strong> - pierwszy kwartyl (25% ofert ma cenę poniżej tej wartości); <strong>Q3 (75%)</strong> - trzeci kwartyl (75% ofert ma cenę poniżej tej wartości); <strong>Min/Max</strong> - najniższa i najwyższa cena; <strong>IQR</strong> - rozstęp międzykwartylowy (różnica między Q3 a Q1), pokazuje rozproszenie środkowych 50% ofert.
                  </div>
                  <h3 className="text-md font-semibold mb-3 text-slate-200">
                    Statystyki szczegółowe
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ borderCollapse: 'collapse', borderSpacing: 0 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #4b5563' }}>
                          <th className="px-3 py-2 text-left" style={{ borderRight: '1px solid #374151' }}>Metryka</th>
                          <th className="px-3 py-2 text-center">Wartość</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          <td className="px-3 py-2 text-slate-400" style={{ borderRight: '1px solid #374151' }}>Średnia</td>
                          <td className="px-3 py-2 text-center font-semibold">{formatPrice(priceStatistics.mean)}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          <td className="px-3 py-2 text-slate-400" style={{ borderRight: '1px solid #374151' }}>Mediana</td>
                          <td className="px-3 py-2 text-center font-semibold">{formatPrice(priceStatistics.median)}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          <td className="px-3 py-2 text-slate-400" style={{ borderRight: '1px solid #374151' }}>Odchylenie std.</td>
                          <td className="px-3 py-2 text-center font-semibold">{formatPrice(priceStatistics.std_dev)}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          <td className="px-3 py-2 text-slate-400" style={{ borderRight: '1px solid #374151' }}>Min</td>
                          <td className="px-3 py-2 text-center font-semibold">{formatPrice(priceStatistics.min)}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          <td className="px-3 py-2 text-slate-400" style={{ borderRight: '1px solid #374151' }}>Q1 (25%)</td>
                          <td className="px-3 py-2 text-center font-semibold">{formatPrice(priceStatistics.q1)}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          <td className="px-3 py-2 text-slate-400" style={{ borderRight: '1px solid #374151' }}>Q3 (75%)</td>
                          <td className="px-3 py-2 text-center font-semibold">{formatPrice(priceStatistics.q3)}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          <td className="px-3 py-2 text-slate-400" style={{ borderRight: '1px solid #374151' }}>IQR</td>
                          <td className="px-3 py-2 text-center font-semibold">
                            {priceStatistics.q1 && priceStatistics.q3
                              ? formatPrice(priceStatistics.q3 - priceStatistics.q1)
                              : "-"}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #374151' }}>
                          <td className="px-3 py-2 text-slate-400" style={{ borderRight: '1px solid #374151' }}>Max</td>
                          <td className="px-3 py-2 text-center font-semibold">{formatPrice(priceStatistics.max)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Boxplot */}
              {priceStatistics && priceStatistics.n_offers > 0 && (
                <div className="rounded-lg bg-slate-800 p-4 chart-help-container">
                  <div className="chart-help-icon">?</div>
                  <div className="chart-help-tooltip">
                    Wykres pudełkowy (boxplot) wizualizuje rozkład cen: pokazuje minimum, pierwszy kwartyl (Q1), medianę, trzeci kwartyl (Q3) oraz maksimum. Pozwala szybko zobaczyć rozproszenie cen, wartości odstające oraz symetrię rozkładu. Im dłuższe "pudełko", tym większe rozproszenie cen w środkowych 50% ofert.
                  </div>
                  <h3 className="text-md font-semibold mb-3 text-slate-200">
                    Rozkład cen (Boxplot)
                  </h3>
                  {priceMileageData && priceMileageData.length > 0 ? (
                    <div className="w-full" style={{ minHeight: '300px', height: '400px', maxHeight: '600px' }}>
                      <Bar
                        data={{
                          labels: ["Rozkład cen"],
                          datasets: [
                            {
                              label: "Min",
                              data: [priceStatistics.min || 0],
                              backgroundColor: "rgba(34, 197, 94, 0.5)",
                              borderColor: "rgba(34, 197, 94, 1)",
                              borderWidth: 2,
                            },
                            {
                              label: "Q1",
                              data: [priceStatistics.q1 || 0],
                              backgroundColor: "rgba(59, 130, 246, 0.5)",
                              borderColor: "rgba(59, 130, 246, 1)",
                              borderWidth: 2,
                            },
                            {
                              label: "Mediana",
                              data: [priceStatistics.median || 0],
                              backgroundColor: "rgba(249, 115, 22, 0.5)",
                              borderColor: "rgba(249, 115, 22, 1)",
                              borderWidth: 2,
                            },
                            {
                              label: "Q3",
                              data: [priceStatistics.q3 || 0],
                              backgroundColor: "rgba(59, 130, 246, 0.5)",
                              borderColor: "rgba(59, 130, 246, 1)",
                              borderWidth: 2,
                            },
                            {
                              label: "Max",
                              data: [priceStatistics.max || 0],
                              backgroundColor: "rgba(239, 68, 68, 0.5)",
                              borderColor: "rgba(239, 68, 68, 1)",
                              borderWidth: 2,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          indexAxis: "y",
                          plugins: {
                            legend: {
                              display: true,
                              position: "top",
                              labels: {
                                color: "#cbd5e1",
                              },
                            },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  return `${context.dataset.label}: ${formatPrice(context.parsed.x)}`;
                                },
                              },
                            },
                          },
                          scales: {
                            x: {
                              title: {
                                display: true,
                                text: "Cena (PLN)",
                                color: "#cbd5e1",
                              },
                              ticks: {
                                color: "#94a3b8",
                                callback: function (value) {
                                  return new Intl.NumberFormat("pl-PL", {
                                    style: "currency",
                                    currency: "PLN",
                                    maximumFractionDigits: 0,
                                  }).format(Number(value));
                                },
                              },
                              grid: {
                                color: "rgba(148, 163, 184, 0.1)",
                              },
                            },
                            y: {
                              ticks: {
                                color: "#94a3b8",
                              },
                              grid: {
                                color: "rgba(148, 163, 184, 0.1)",
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">Brak danych do wykresu</p>
                  )}
                </div>
              )}
            </section>
          );
        } catch (error) {
          console.error("Błąd podczas renderowania zakładki Analizy:", error);
          return (
            <section>
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Analizy zaawansowane</h2>
                <div className="p-4 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
                  <p className="font-semibold mb-2">Wystąpił błąd podczas ładowania analiz.</p>
                  <p className="mb-3">Spróbuj odświeżyć stronę lub sprawdź konsolę przeglądarki.</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
                  >
                    Odśwież stronę
                  </button>
                </div>
              </div>
            </section>
          );
        }
      })()}
    </AnalyticsErrorBoundary>
  );
};

