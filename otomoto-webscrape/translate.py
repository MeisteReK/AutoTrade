import pandas as pd
import pickle
import re


def load_pkl(name):
    with open(name + ".pkl", "rb") as f:
        return pickle.load(f)


def translate_car_features(features_string):
    car_features_translation = load_pkl(
        "./translation_files/car_features_translation"
    )
    if pd.isna(features_string):
        return []

    # oczekujemy stringa w stylu: "['ABS', 'Airbag']"
    features = re.findall(r"'(.*?)'", str(features_string))

    translated_features = []
    for feature in features:
        if not feature:
            continue
        # na wszelki wypadek zabezpieczenie, gdyby czegoś nie było w słowniku
        translation = car_features_translation.get(feature, feature)
        translated_features.append(translation)

    return translated_features


def translate_pol_eng(dataframe: pd.DataFrame) -> pd.DataFrame:
    """
    Tłumaczy:
    - nazwy kolumn z PL -> EN (ręczne mapowanie)
    - wartości w wybranych kolumnach przy użyciu słowników z plików .pkl
    """
    # --- 1. NAZWY KOLUMN: PL -> EN ---

    column_mapping = {
        "Stan": "Condition",
        "Marka pojazdu": "Vehicle_brand",
        "Model pojazdu": "Vehicle_model",
        "Wersja": "Vehicle_version",
        "Generacja": "Vehicle_generation",
        "Rok produkcji": "Production_year",
        "Przebieg": "Mileage_km",
        "Moc": "Power_HP",
        "Pojemność skokowa": "Displacement_cm3",
        "Rodzaj paliwa": "Fuel_type",
        "Emisja CO2": "CO2_emissions",
        "Napęd": "Drive",
        "Skrzynia biegów": "Transmission",
        "Typ": "Type",
        "Liczba drzwi": "Doors_number",
        "Kolor": "Colour",
        "Kraj pochodzenia": "Origin_country",
        "Pierwszy właściciel": "First_owner",
        "Pierwsza rejestracja": "First_registration_date",
        "date": "Offer_publication_date",
        "Location": "Offer_location",
        # te już są ok, ale dla pewności zostawiamy:
        "Price": "Price",
        "Currency": "Currency",
        "Features": "Features",
    }

    dataframe = dataframe.rename(columns=column_mapping)

    # --- 2. ZAŁADOWANIE SŁOWNIKÓW DO TŁUMACZENIA WARTOŚCI ---

    colour_translation = load_pkl("./translation_files/colour_translation")
    condition_translation = load_pkl("./translation_files/condition_translation")
    drive_translation = load_pkl("./translation_files/drive_translation")
    fuel_type_translation = load_pkl("./translation_files/fuel_type_translation")
    transmission_translation = load_pkl("./translation_files/transmission_translation")
    type_translation = load_pkl("./translation_files/type_translation")
    origin_country_translation = load_pkl(
        "./translation_files/origin_country_translation"
    )

    # --- 3. TŁUMACZENIE WARTOŚCI W KOLUMNACH (jeśli istnieją) ---

    if "Colour" in dataframe.columns:
        dataframe["Colour"].replace(colour_translation, inplace=True)

    if "Condition" in dataframe.columns:
        dataframe["Condition"].replace(condition_translation, inplace=True)

    if "Drive" in dataframe.columns:
        dataframe["Drive"].replace(drive_translation, inplace=True)

    if "Fuel_type" in dataframe.columns:
        dataframe["Fuel_type"].replace(fuel_type_translation, inplace=True)

    if "Vehicle_model" in dataframe.columns:
        dataframe["Vehicle_model"].replace({"Inny": "Other"}, inplace=True)

    if "Vehicle_version" in dataframe.columns:
        dataframe["Vehicle_version"].replace({"Inny": "Other"}, inplace=True)

    if "First_owner" in dataframe.columns:
        dataframe["First_owner"].replace({"Tak": "Yes", "Nie": "No"}, inplace=True)

    if "Transmission" in dataframe.columns:
        dataframe["Transmission"].replace(transmission_translation, inplace=True)

    if "Type" in dataframe.columns:
        dataframe["Type"].replace(type_translation, inplace=True)

    if "Origin_country" in dataframe.columns:
        dataframe["Origin_country"].replace(
            origin_country_translation, inplace=True
        )

    # --- 4. Features -> lista przetłumaczonych cech ---

    if "Features" in dataframe.columns:
        dataframe["Features"] = dataframe["Features"].apply(translate_car_features)

    return dataframe
