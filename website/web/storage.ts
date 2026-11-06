const storage = {
 async getItem(key: string) { try { return localStorage.getItem(key); } catch { return null; } },
 async setItem(key: string, value: string) { try { localStorage.setItem(key,value); } catch { /* Optional browser persistence. */ } },
 async removeItem(key: string) { try { localStorage.removeItem(key); } catch {} }
};
export default storage;
