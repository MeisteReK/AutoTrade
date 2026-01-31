// ====== Typy dopasowane do backendu ======
export type AnalysisResult = {
  filters: Record<string, unknown>;
  n_offers: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
};

export type PriceStatistics = {
  filters: Record<string, unknown>;
  n_offers: number;
  mean: number | null;
  median: number | null;
  std_dev: number | null;
  q1: number | null;
  q3: number | null;
  min: number | null;
  max: number | null;
};

export type Listing = {
  id: number;
  price_pln: number;
  currency: string;
  condition?: string | null;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_version?: string | null;
  vehicle_generation?: string | null;
  production_year: number;
  mileage_km?: number | null;
  power_hp?: number | null;
  displacement_cm3?: number | null;
  fuel_type?: string | null;
  co2_emissions?: number | null;
  drive?: string | null;
  transmission?: string | null;
  type?: string | null;
  doors_number?: number | null;
  colour?: string | null;
  origin_country?: string | null;
  first_owner?: boolean | null;
  first_registration_date?: string | null;
  offer_publication_date?: string | null;
  offer_location?: string | null;
  features?: string | null;
};

export type ListingsResponse = {
  filters: Record<string, unknown>;
  limit: number;
  offset: number;
  total: number;
  items: Listing[];
};

export type TrendPoint = {
  year: number;
  n_offers: number;
  avg_price: number;
  median_price?: number | null;
};

export type TrendResponse = {
  filters: Record<string, unknown>;
  points: TrendPoint[];
};

// ====== Typy do wyceny ======
export type ValuationRequestPayload = {
  brand: string;
  model: string;
  generation?: string | null;
  year: number;
  mileage_km: number;
  fuel_type: string;
  transmission: string;
  engine_capacity_cm3: number;
  // Konfiguracja danych do treningu
  training_filters?: {
    brand?: string | null;
    model?: string | null;
    generation?: string | null;
    year_min?: number | null;
    year_max?: number | null;
    mileage_max?: number | null;
    displacement_min?: number | null;
    displacement_max?: number | null;
    fuel_type?: string | null;
    date_from?: string | null;
    date_to?: string | null;
  };
  // Konfiguracja modelu
  valuation_model_config: {
    model_type: "linear" | "ridge" | "lasso" | "random_forest";
    features_numeric?: string[];
    features_categorical?: string[];
    alpha?: number;
    n_estimators?: number;
    max_depth?: number | null;
    min_samples_split?: number;
    min_samples_leaf?: number;
    test_size?: number;
    random_state?: number;
  };
};

export type ValuationModelMetrics = {
  r2: number;
  rmse: number;
  mae: number;
  n_samples: number;
  test_size: number;
  features_numeric: string[];
  features_categorical: string[];
  target: string;
};

export type ValuationResponse = {
  predicted_price: number;
  model_metrics: ValuationModelMetrics;
};

// ====== Typy do analiz zaawansowanych ======
export type PriceMileagePoint = {
  price_pln: number;
  mileage_km: number;
};

export type PriceMileageResponse = {
  filters: Record<string, unknown>;
  points: PriceMileagePoint[];
};

export type PriceStatsByCategory = {
  category: string;
  avg_price: number;
  median_price: number | null;
  n_offers: number;
};

export type PriceStatsByCategoryResponse = {
  filters: Record<string, unknown>;
  by_fuel_type: PriceStatsByCategory[];
  by_transmission: PriceStatsByCategory[];
};

// ====== Typy do porównań ======
export type VehicleComparisonData = {
  vehicle_a_label: string;
  vehicle_b_label: string;
  metrics_a: {
    avg_price: number | null;
    median_price: number | null;
    min_price: number | null;
    max_price: number | null;
    avg_mileage: number | null;
    avg_power_hp: number | null;
    avg_displacement_cm3: number | null;
    n_offers: number;
  };
  metrics_b: {
    avg_price: number | null;
    median_price: number | null;
    min_price: number | null;
    max_price: number | null;
    avg_mileage: number | null;
    avg_power_hp: number | null;
    avg_displacement_cm3: number | null;
    n_offers: number;
  };
  trend_by_year: Array<{
    year: number;
    avg_price_a: number | null;
    avg_price_b: number | null;
    n_offers_a: number;
    n_offers_b: number;
  }>;
  price_mileage_a: PriceMileagePoint[];
  price_mileage_b: PriceMileagePoint[];
};

