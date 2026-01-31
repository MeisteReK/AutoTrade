import React from "react";
import { Line, Scatter } from "react-chartjs-2";
import { formatPrice } from "../utils/formatPrice";
import type { VehicleComparisonData } from "../types";

export const ComparisonDetails: React.FC<{
  comparison: {
    title: string;
    comparison_data: VehicleComparisonData;
  };
  onBack: () => void;
}> = ({ comparison, onBack }) => {
  const comparisonData = comparison.comparison_data;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{comparison.title}</h3>
          <p className="text-sm text-slate-400 mt-1">
            {comparisonData.vehicle_a_label} vs {comparisonData.vehicle_b_label}
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
        >
          ← Powrót do listy
        </button>
      </div>

      {/* Tabela porównawcza */}
      <div className="rounded-lg bg-slate-800 p-4 mb-8 chart-help-container">
        <div className="chart-help-icon">?</div>
        <div className="chart-help-tooltip">
          Tabela porównawcza przedstawia kluczowe metryki dla obu pojazdów, w tym średnie ceny, mediany, średnie przebiegi, moc silnika i pojemność. Pozwala to na szybkie porównanie podstawowych parametrów obu pojazdów w jednym miejscu.
        </div>
        <div className="mb-3">
          <h3 className="text-md font-semibold">Tabela porównawcza</h3>
        </div>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="min-w-full text-xs sm:text-sm" style={{ borderCollapse: 'collapse', borderSpacing: 0 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #4b5563' }}>
                <th className="px-2 sm:px-3 py-2 text-left whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>Metryka</th>
                <th className="px-2 sm:px-3 py-2 text-center text-blue-400 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>{comparisonData.vehicle_a_label}</th>
                <th className="px-2 sm:px-3 py-2 text-center text-orange-400 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>{comparisonData.vehicle_b_label}</th>
                <th className="px-2 sm:px-3 py-2 text-center whitespace-nowrap">Różnica</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>Liczba ofert</td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>{comparisonData.metrics_a.n_offers}</td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>{comparisonData.metrics_b.n_offers}</td>
                <td className="px-2 sm:px-3 py-2 text-center">
                  {comparisonData.metrics_b.n_offers - comparisonData.metrics_a.n_offers > 0 ? "+" : ""}
                  {comparisonData.metrics_b.n_offers - comparisonData.metrics_a.n_offers}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>Średnia cena</td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_a.avg_price
                    ? formatPrice(comparisonData.metrics_a.avg_price)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_b.avg_price
                    ? formatPrice(comparisonData.metrics_b.avg_price)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center">
                  {comparisonData.metrics_a.avg_price && comparisonData.metrics_b.avg_price
                    ? `${comparisonData.metrics_b.avg_price - comparisonData.metrics_a.avg_price > 0 ? "+" : ""}${formatPrice(comparisonData.metrics_b.avg_price - comparisonData.metrics_a.avg_price)}`
                    : "-"}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>Mediana ceny</td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_a.median_price
                    ? formatPrice(comparisonData.metrics_a.median_price)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_b.median_price
                    ? formatPrice(comparisonData.metrics_b.median_price)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center">
                  {comparisonData.metrics_a.median_price && comparisonData.metrics_b.median_price
                    ? `${comparisonData.metrics_b.median_price - comparisonData.metrics_a.median_price > 0 ? "+" : ""}${formatPrice(comparisonData.metrics_b.median_price - comparisonData.metrics_a.median_price)}`
                    : "-"}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>Min cena</td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_a.min_price
                    ? formatPrice(comparisonData.metrics_a.min_price)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_b.min_price
                    ? formatPrice(comparisonData.metrics_b.min_price)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center">-</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>Max cena</td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_a.max_price
                    ? formatPrice(comparisonData.metrics_a.max_price)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_b.max_price
                    ? formatPrice(comparisonData.metrics_b.max_price)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center">-</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>Średni przebieg (km)</td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_a.avg_mileage
                    ? new Intl.NumberFormat("pl-PL").format(Math.round(comparisonData.metrics_a.avg_mileage))
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
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
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>Średnia moc (HP)</td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_a.avg_power_hp
                    ? Math.round(comparisonData.metrics_a.avg_power_hp)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_b.avg_power_hp
                    ? Math.round(comparisonData.metrics_b.avg_power_hp)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center">
                  {comparisonData.metrics_a.avg_power_hp && comparisonData.metrics_b.avg_power_hp
                    ? `${comparisonData.metrics_b.avg_power_hp - comparisonData.metrics_a.avg_power_hp > 0 ? "+" : ""}${Math.round(comparisonData.metrics_b.avg_power_hp - comparisonData.metrics_a.avg_power_hp)} HP`
                    : "-"}
                </td>
              </tr>
              <tr>
                <td className="px-2 sm:px-3 py-2 whitespace-nowrap" style={{ borderRight: '1px solid #374151' }}>Średnia pojemność (cm³)</td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
                  {comparisonData.metrics_a.avg_displacement_cm3
                    ? Math.round(comparisonData.metrics_a.avg_displacement_cm3)
                    : "-"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-center" style={{ borderRight: '1px solid #374151' }}>
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
      {comparisonData.trend_by_year && comparisonData.trend_by_year.length > 0 && (
        <div className="rounded-lg bg-slate-800 p-4 mb-8 chart-help-container">
          <div className="chart-help-icon">?</div>
          <div className="chart-help-tooltip">
            Wykres liniowy porównuje średnią cenę dwóch pojazdów w zależności od roku produkcji. Pozwala zobaczyć, jak ceny obu pojazdów zmieniały się w czasie oraz które roczniki są szczególnie wartościowe dla każdego z porównywanych modeli. Linia jest ciągła nawet przy braku danych dla niektórych lat.
          </div>
          <h3 className="text-md font-semibold mb-3">Trend cenowy wg roku</h3>
          <div className="w-full" style={{ minHeight: '300px', height: '400px', maxHeight: '600px' }}>
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
      {((comparisonData.price_mileage_a && comparisonData.price_mileage_a.length > 0) || 
        (comparisonData.price_mileage_b && comparisonData.price_mileage_b.length > 0)) && (() => {
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
            .filter(bin => bin.prices.length > 0)
            .map(bin => ({
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
            type: 'line' as const,
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
            type: 'line' as const,
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
              Wykres punktowy porównuje zależność między ceną a przebiegiem dla obu pojazdów. Każdy punkt reprezentuje jedną ofertę. Różne kolory oznaczają różne pojazdy (A i B). Zielone linie przedstawiają średnią cenę w przedziałach przebiegu dla każdego pojazdu, co pozwala zobaczyć ogólny trend. Wykres pomaga zidentyfikować różnice w cenach przy podobnym przebiegu oraz zobaczyć, jak przebieg wpływa na cenę dla każdego z pojazdów.
            </div>
            <h3 className="text-md font-semibold mb-3">Cena vs Przebieg</h3>
            <div className="w-full" style={{ minHeight: '300px', height: '400px', maxHeight: '600px' }}>
              <Scatter
                data={{
                  datasets: datasets,
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'point' as const,
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
                          const x = typeof context.parsed.x === 'number' ? context.parsed.x : 0;
                          const y = typeof context.parsed.y === 'number' ? context.parsed.y : 0;
                          if ((context.dataset as any).type === 'line') {
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
    </div>
  );
};

