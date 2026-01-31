import React, { useState } from "react";
import axios from "axios";
import type { ValuationResponse } from "../types";
import API_URL from "../config/api";

export const SaveValuationButton: React.FC<{
  valuationResult: ValuationResponse;
  valuationForm: {
    brand: string;
    model: string;
    generation: string | null;
    year: number;
    mileage_km: number;
    fuel_type: string;
    transmission: string;
    engine_capacity_cm3: number;
  };
  token: string;
  onSaved: () => void;
}> = ({ valuationResult, valuationForm, token, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(
    `${valuationForm.brand} ${valuationForm.model} ${valuationForm.year}`
  );

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Podaj tytuł");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      await axios.post(
        `${API_URL}/saved/valuations`,
        {
          title: title.trim(),
          brand: valuationForm.brand,
          model: valuationForm.model,
          generation: valuationForm.generation,
          year: valuationForm.year,
          mileage_km: valuationForm.mileage_km,
          fuel_type: valuationForm.fuel_type,
          transmission: valuationForm.transmission,
          engine_capacity_cm3: valuationForm.engine_capacity_cm3,
          predicted_price: valuationResult.predicted_price,
          model_metrics: valuationResult.model_metrics,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Błąd podczas zapisywania");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setError(null);
        }}
        placeholder="Tytuł wyceny"
        className="w-full px-3 py-2 bg-slate-700 rounded text-slate-200 text-sm"
        maxLength={200}
      />
      <button
        onClick={handleSave}
        disabled={saving || !title.trim()}
        className={`w-full px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors ${
          saved
            ? "bg-emerald-600 hover:bg-emerald-600 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {saving ? "Zapisywanie..." : saved ? "✓ Zapisano!" : "Zapisz wycenę"}
      </button>
      {error && (
        <div className="px-3 py-2 bg-red-900/30 border border-red-700 rounded text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

