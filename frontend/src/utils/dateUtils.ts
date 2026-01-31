// Funkcja pomocnicza do parsowania daty DD.MM.YYYY
export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // miesiące są 0-indexowane
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
};

// Konwersja DD.MM.YYYY -> YYYY-MM-DD (dla HTML5 date picker)
export const convertToDateInputFormat = (dateStr: string): string => {
  if (!dateStr) return "";
  const date = parseDate(dateStr);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Konwersja YYYY-MM-DD -> DD.MM.YYYY (z HTML5 date picker)
export const convertFromDateInputFormat = (dateStr: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00"); // dodajemy czas, żeby uniknąć problemów z timezone
  if (isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

