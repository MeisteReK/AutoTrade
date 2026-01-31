import React, { useState } from "react";
import axios from "axios";
import type { VehicleComparisonData } from "../types";
import API_URL from "../config/api";

export const SaveComparisonButton: React.FC<{
  comparisonData: VehicleComparisonData;
  token: string;
  onSaved: () => void;
}> = ({ comparisonData, token, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(
    `${comparisonData.vehicle_a_label} vs ${comparisonData.vehicle_b_label}`
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
        `${API_URL}/saved/comparisons`,
        {
          title: title.trim(),
          comparison_data: comparisonData,
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
        placeholder="Tytuł porównania"
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
        {saving ? "Zapisywanie..." : saved ? "✓ Zapisano!" : "Zapisz porównanie"}
      </button>
      {error && (
        <div className="px-3 py-2 bg-red-900/30 border border-red-700 rounded text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

