import React, { useRef, useState, useMemo, useEffect } from "react";
import { Line } from "react-chartjs-2";
import type { AnalysisResult, TrendPoint, Listing } from "../../types";
import { formatPrice } from "../../utils/formatPrice";

const PAGE_SIZE = 50;

type OverviewTabProps = {
  analysis: AnalysisResult | null;
  trend: TrendPoint[];
  filteredListings: Listing[];
  totalListings: number;
  page: number;
  sortBy: "year" | "mileage" | "price" | "brand" | "model" | null;
  sortDir: "asc" | "desc";
  loading: boolean;
  isAdmin: boolean;
  onSort: (column: "year" | "mileage" | "price" | "brand" | "model") => void;
  onPageChange: (page: number, scrollToTable: boolean) => void;
  onDeleteListing?: (listingId: number) => void;
  searchText?: string;
  priceMin?: string;
  priceMax?: string;
  locationFilter?: string;
};

export const OverviewTab: React.FC<OverviewTabProps> = ({
  analysis,
  trend,
  filteredListings,
  totalListings,
  page,
  sortBy,
  sortDir,
  loading,
  isAdmin,
  onSort,
  onPageChange,
  onDeleteListing,
  searchText = "",
  priceMin = "",
  priceMax = "",
  locationFilter = "",
}) => {
  const tableSectionRef = useRef<HTMLElement>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [shouldScroll, setShouldScroll] = useState(false);

  // Scroll do tabeli po zmianie strony
  useEffect(() => {
    if (shouldScroll && tableSectionRef.current) {
      tableSectionRef.current.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
      setShouldScroll(false);
    }
  }, [shouldScroll, page]);

  const handlePageChange = (newPage: number, scrollToTable: boolean) => {
    if (scrollToTable) {
      setShouldScroll(true);
    }
    onPageChange(newPage, scrollToTable);
  };

  const totalPages = totalListings > 0 ? Math.ceil(totalListings / PAGE_SIZE) : 1;

  const trendChartData = useMemo(() => ({
    labels: trend.map((p) => p.year.toString()),
    datasets: [
      {
        label: "Średnia cena (PLN)",
        data: trend.map((p) => p.avg_price),
        borderWidth: 2,
        tension: 0.2,
        borderColor: "rgba(16, 185, 129, 1)",
        backgroundColor: "rgba(16, 185, 129, 0.15)",
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: "Mediana ceny (PLN)",
        data: trend.map((p) => p.median_price ?? null),
        borderWidth: 2,
        tension: 0.2,
        borderColor: "rgba(59, 130, 246, 1)",
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  }), [trend]);

  const trendChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: "#e5e7eb",
        },
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: function (contexts: any) {
            const context = contexts[0];
            const yearIndex = context.dataIndex;
            const year = trend[yearIndex]?.year;
            const nOffers = trend[yearIndex]?.n_offers;
            return `Rok produkcji: ${year} • ${nOffers} ofert`;
          },
          label: function (context: any) {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';
            return `${context.dataset.label}: ${formatPrice(value)}`;
          },
          footer: function (contexts: any) {
            const context = contexts[0];
            const yearIndex = context.dataIndex;
            const point = trend[yearIndex];
            if (!point) return '';
            
            const parts: string[] = [];
            if (point.avg_price != null && point.median_price != null) {
              const diff = point.avg_price - point.median_price;
              const diffPercent = ((diff / point.median_price) * 100).toFixed(1);
              if (Math.abs(diff) > 1000) {
                parts.push(`Różnica: ${formatPrice(Math.abs(diff))} (${diffPercent}%)`);
              }
            }
            return parts;
          },
        },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#e5e7eb',
        titleFont: { size: 14, weight: 'bold' as const },
        bodyColor: '#cbd5e1',
        bodyFont: { size: 13 },
        footerColor: '#94a3b8',
        footerFont: { size: 12 },
        borderColor: 'rgba(148, 163, 184, 0.3)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        boxPadding: 6,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#9ca3af",
        },
        grid: {
          color: "rgba(55, 65, 81, 0.4)",
        },
      },
      y: {
        ticks: {
          color: "#9ca3af",
        },
        grid: {
          color: "rgba(55, 65, 81, 0.4)",
        },
      },
    },
  }), [trend]);

  return (
    <>
      {/* Statystyki */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Podgląd cen</h2>

        {analysis ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Liczba ofert</div>
              <div className="text-xl font-semibold">
                {analysis.n_offers}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Średnia cena</div>
              <div className="text-lg font-semibold">
                {formatPrice(analysis.avg_price)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Min cena</div>
              <div className="text-lg font-semibold">
                {formatPrice(analysis.min_price)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Max cena</div>
              <div className="text-lg font-semibold">
                {formatPrice(analysis.max_price)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Ustaw filtry i kliknij „Zastosuj filtry", aby zobaczyć
            statystyki.
          </p>
        )}
      </section>

      {/* Wykres trendu */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">
          Trend ceny wg roku produkcji
        </h2>
        <div className="chart-container rounded-lg bg-slate-800 p-3 chart-help-container">
          <div className="chart-help-icon">?</div>
          <div className="chart-help-tooltip">
            Wykres przedstawia średnią i medianę ceny pojazdów w zależności od roku produkcji. Średnia (zielona linia) pokazuje przeciętną cenę, podczas gdy mediana (niebieska linia) wskazuje wartość środkową, która jest mniej podatna na skrajne wartości. Pozwala to zobaczyć trendy cenowe - czy starsze modele są tańsze, czy może niektóre roczniki są szczególnie wartościowe. Różnica między średnią a medianą może wskazywać na asymetrię rozkładu cen.
          </div>
          {trend.length ? (
            <Line data={trendChartData} options={trendChartOptions} />
          ) : (
            <p className="text-sm text-slate-400">
              Brak danych do wykresu. Spróbuj zmienić filtry.
            </p>
          )}
        </div>
      </section>

      {/* Tabela ofert */}
      <section ref={tableSectionRef}>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Oferty ({totalListings})
          </h2>
          <span className="text-xs text-slate-400">
            Strona {page} z {totalPages} (po {PAGE_SIZE} rekordów)
          </span>
        </div>
        <div 
          ref={tableContainerRef}
          className="rounded-lg bg-slate-800 table-container"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            setIsDragging(true);
            setStartX(e.pageX - (tableContainerRef.current?.offsetLeft || 0));
            setScrollLeft(tableContainerRef.current?.scrollLeft || 0);
          }}
          onMouseLeave={() => setIsDragging(false)}
          onMouseUp={() => setIsDragging(false)}
          onMouseMove={(e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - (tableContainerRef.current?.offsetLeft || 0);
            const walk = (x - startX) * 2; // szybkość przesuwania
            if (tableContainerRef.current) {
              tableContainerRef.current.scrollLeft = scrollLeft - walk;
            }
          }}
        >
          <table className="min-w-full text-sm fixed-table">
            <thead className="bg-slate-900 sticky-header">
              <tr>
                <th
                  className="px-3 py-2 text-center sortable"
                  onClick={() => onSort("brand")}
                >
                  Marka
                  {sortBy === "brand" && (
                    <span className="sort-arrow">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
                <th
                  className="px-3 py-2 text-center sortable"
                  onClick={() => onSort("model")}
                >
                  Model
                  {sortBy === "model" && (
                    <span className="sort-arrow">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
                <th className="px-3 py-2 text-center">Generacja</th>
                <th
                  className="px-3 py-2 text-center sortable"
                  onClick={() => onSort("year")}
                >
                  Rok
                  {sortBy === "year" && (
                    <span className="sort-arrow">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
                <th
                  className="px-3 py-2 text-center sortable"
                  onClick={() => onSort("mileage")}
                >
                  Przebieg (km)
                  {sortBy === "mileage" && (
                    <span className="sort-arrow">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
                <th className="px-3 py-2 text-center">Silnik (cm³)</th>
                <th className="px-3 py-2 text-center">Paliwo</th>
                <th className="px-3 py-2 text-center">Skrzynia</th>
                <th
                  className="px-3 py-2 text-center sortable"
                  onClick={() => onSort("price")}
                >
                  Cena
                  {sortBy === "price" && (
                    <span className="sort-arrow">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
                {isAdmin && (
                  <th className="px-3 py-2 text-center font-semibold text-xs">
                    Akcje
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredListings.length ? (
                filteredListings.map((l) => (
                  <tr key={l.id} className="table-row">
                    <td className="px-3 py-1 text-center">{l.vehicle_brand}</td>
                    <td className="px-3 py-1 text-center">{l.vehicle_model}</td>
                    <td className="px-3 py-1 text-center">{l.vehicle_generation ?? "-"}</td>
                    <td className="px-3 py-1 text-center">{l.production_year}</td>
                    <td className="px-3 py-1 text-center">
                      {l.mileage_km
                        ? new Intl.NumberFormat("pl-PL").format(
                            l.mileage_km
                          )
                        : "-"}
                    </td>
                    <td className="px-3 py-1 text-center">
                      {l.displacement_cm3
                        ? new Intl.NumberFormat("pl-PL").format(
                            l.displacement_cm3
                          )
                        : "-"}
                    </td>
                    <td className="px-3 py-1 text-center">{l.fuel_type ?? "-"}</td>
                    <td className="px-3 py-1 text-center">{l.transmission ?? "-"}</td>
                    <td className="px-3 py-1 text-center">
                      {formatPrice(l.price_pln)}
                    </td>
                    {isAdmin && onDeleteListing && (
                      <td className="px-3 py-1 text-center">
                        <button
                          onClick={() => onDeleteListing(l.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white transition-colors"
                          title="Usuń ofertę"
                        >
                          Usuń
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={isAdmin ? 10 : 9}
                    className="px-3 py-2 text-center text-slate-400"
                  >
                    {searchText || priceMin || priceMax || locationFilter
                      ? "Brak ofert spełniających kryteria wyszukiwania."
                      : "Brak ofert do wyświetlenia. Ustaw filtry i kliknij \"Zastosuj filtry\"."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginacja */}
        {totalListings > PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <button
              className="rounded bg-slate-800 border border-slate-700 px-3 py-1 text-xs"
              onClick={() => page > 1 && handlePageChange(page - 1, true)}
              disabled={page <= 1 || loading}
            >
              ◀ Poprzednia
            </button>
            <span>
              Strona {page} z {totalPages}
            </span>
            <button
              className="rounded bg-slate-800 border border-slate-700 px-3 py-1 text-xs"
              onClick={() =>
                page < totalPages && handlePageChange(page + 1, true)
              }
              disabled={page >= totalPages || loading}
            >
              Następna ▶
            </button>
          </div>
        )}
      </section>
    </>
  );
};

