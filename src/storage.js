// Simple localStorage adapter that mimics the original window.storage API
// This allows multiple browser tabs to play together locally

const storage = {
  // Get data from localStorage
  get: async (key, parse = false) => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;
      return parse ? { value } : value;
    } catch (err) {
      console.error('Storage get error:', err);
      return null;
    }
  },

  // Set data to localStorage
  set: async (key, value, stringify = false) => {
    try {
      localStorage.setItem(key, value);
      // Trigger storage event for other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: value
      }));
      return true;
    } catch (err) {
      console.error('Storage set error:', err);
      return false;
    }
  },

  // Delete data
  delete: async (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error('Storage delete error:', err);
      return false;
    }
  }
};

// Make it available globally to match original API
window.storage = storage;

export default storage;
