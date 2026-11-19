const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AQ.Ab8RN6Ks-lzGP7seewJsEaFvGzPoZCP0tBzgxX1drDkVTYgmKA'
export const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`
