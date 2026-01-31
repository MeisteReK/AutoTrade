import React, { useEffect, useState } from "react";
import axios from "axios";
import { ComparisonDetails } from "./ComparisonDetails";
import API_URL from "../config/api";

export const SavedTab: React.FC<{ token: string }> = ({ token }) => {
  const [valuations, setValuations] = useState<any[]>([]);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"valuations" | "comparisons">("valuations");
  const [selectedComparisonId, setSelectedComparisonId] = useState<number | null>(null);
  const [deleteValuationConfirm, setDeleteValuationConfirm] = useState<{ show: boolean; id: number | null }>({ show: false, id: null });
  const [deleteComparisonConfirm, setDeleteComparisonConfirm] = useState<{ show: boolean; id: number | null }>({ show: false, id: null });

  useEffect(() => {
    fetchSaved();
  }, []);

  const fetchSaved = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [valsRes, compRes] = await Promise.all([
        axios.get(`${API_URL}/saved/valuations`, { headers }),
        axios.get(`${API_URL}/saved/comparisons`, { headers }),
      ]);
      setValuations(valsRes.data);
      setComparisons(compRes.data);
    } catch (error) {
      console.error("Error fetching saved items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteValuation = (id: number) => {
    setDeleteValuationConfirm({ show: true, id });
  };

  const confirmDeleteValuation = async () => {
    if (!deleteValuationConfirm.id) return;
    try {
      await axios.delete(`${API_URL}/saved/valuations/${deleteValuationConfirm.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSaved();
      setDeleteValuationConfirm({ show: false, id: null });
    } catch (error) {
      console.error("Error deleting valuation:", error);
      setDeleteValuationConfirm({ show: false, id: null });
    }
  };

  const cancelDeleteValuation = () => {
    setDeleteValuationConfirm({ show: false, id: null });
  };

  const handleDeleteComparison = (id: number) => {
    setDeleteComparisonConfirm({ show: true, id });
  };

  const confirmDeleteComparison = async () => {
    if (!deleteComparisonConfirm.id) return;
    try {
      await axios.delete(`${API_URL}/saved/comparisons/${deleteComparisonConfirm.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSaved();
      setDeleteComparisonConfirm({ show: false, id: null });
    } catch (error) {
      console.error("Error deleting comparison:", error);
      setDeleteComparisonConfirm({ show: false, id: null });
    }
  };

  const cancelDeleteComparison = () => {
    setDeleteComparisonConfirm({ show: false, id: null });
  };

  if (loading) {
    return <div className="text-slate-400">Ładowanie...</div>;
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Zapisane</h2>

      <div className="mb-4 flex gap-2">
        <button
          className={`px-4 py-2 rounded ${
            activeSubTab === "valuations"
              ? "bg-blue-600"
              : "bg-slate-700 hover:bg-slate-600"
          }`}
          onClick={() => setActiveSubTab("valuations")}
        >
          Wyceny ({valuations.length})
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeSubTab === "comparisons"
              ? "bg-blue-600"
              : "bg-slate-700 hover:bg-slate-600"
          }`}
          onClick={() => setActiveSubTab("comparisons")}
        >
          Porównania ({comparisons.length})
        </button>
      </div>

      {activeSubTab === "valuations" && (
        <div className="space-y-6">
          {valuations.length === 0 ? (
            <p className="text-slate-400">Brak zapisanych wycen.</p>
          ) : (
            valuations.map((v) => (
              <div key={v.id} className="rounded-lg bg-slate-800 p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{v.title}</h3>
                  <button
                    onClick={() => handleDeleteValuation(v.id)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs text-white transition-colors font-medium"
                    title="Usuń zapisaną wycenę"
                  >
                    Usuń
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-slate-400">Marka/Model:</span>{" "}
                    {v.brand} {v.model}
                  </div>
                  <div>
                    <span className="text-slate-400">Rok:</span> {v.year}
                  </div>
                  <div>
                    <span className="text-slate-400">Przebieg:</span>{" "}
                    {v.mileage_km.toLocaleString()} km
                  </div>
                  <div>
                    <span className="text-slate-400">Cena:</span>{" "}
                    {v.predicted_price.toLocaleString()} PLN
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Zapisano: {new Date(v.created_at).toLocaleString("pl-PL")}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeSubTab === "comparisons" && (
        <div className="space-y-6">
          {selectedComparisonId === null ? (
            <>
              {comparisons.length === 0 ? (
                <p className="text-slate-400">Brak zapisanych porównań.</p>
              ) : (
                comparisons.map((c) => (
                  <div key={c.id} className="rounded-lg bg-slate-800 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{c.title}</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedComparisonId(c.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white transition-colors font-medium"
                          title="Pokaż szczegóły porównania"
                        >
                          Pokaż szczegóły
                        </button>
                        <button
                          onClick={() => handleDeleteComparison(c.id)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs text-white transition-colors font-medium"
                          title="Usuń zapisane porównanie"
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">
                      {c.comparison_data.vehicle_a_label} vs{" "}
                      {c.comparison_data.vehicle_b_label}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Zapisano: {new Date(c.created_at).toLocaleString("pl-PL")}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <ComparisonDetails
              comparison={comparisons.find((c) => c.id === selectedComparisonId)!}
              onBack={() => setSelectedComparisonId(null)}
            />
          )}
        </div>
      )}

      {/* Modal potwierdzenia usunięcia wyceny */}
      {deleteValuationConfirm.show && (
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
          onClick={cancelDeleteValuation}
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
            <h3 className="text-lg font-semibold mb-3">Usunąć zapisaną wycenę?</h3>
            <p className="text-sm text-slate-400 mb-6">
              Ta operacja jest nieodwracalna. Zapisana wycena zostanie trwale usunięta.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDeleteValuation}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDeleteValuation}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white transition-colors font-medium"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal potwierdzenia usunięcia porównania */}
      {deleteComparisonConfirm.show && (
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
          onClick={cancelDeleteComparison}
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
            <h3 className="text-lg font-semibold mb-3">Usunąć zapisane porównanie?</h3>
            <p className="text-sm text-slate-400 mb-6">
              Ta operacja jest nieodwracalna. Zapisane porównanie zostanie trwale usunięte.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDeleteComparison}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDeleteComparison}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white transition-colors font-medium"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

