// Simple wrapper for LocalStorage to act as our "Database"
export const load = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.error(`Error loading ${key}`, e);
    return defaultValue;
  }
};

export const save = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e: any) {
    // Handle Quota Exceeded Errors (Storage Full)
    if (
      e instanceof DOMException && 
      (e.name === 'QuotaExceededError' || 
       e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
       e.code === 22)
    ) {
      alert("⚠️ SYSTEM STORAGE FULL!\n\nYour data cannot be saved because the browser storage is full. Please go to Settings > Data Management and 'Download Backup', then 'Factory Reset' to clear space.");
    }
    console.error(`Error saving ${key}`, e);
  }
};