/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta del catàleg CONNECT Christmas Experience 2026 + Brand Book IMPAUSA
        pine: { 950: '#0F1E18', 900: '#14261F', 800: '#1D3A2E', 700: '#2A5040', 600: '#3B6A55', 300: '#A7C6A1', 200: '#C9DCC5' },
        cream: { DEFAULT: '#FAF6F1', 200: '#F3ECE2', 300: '#E6DED3' },
        ember: { DEFAULT: '#D9733F', light: '#F2A06B', dark: '#B65A2C' },
        gold: { DEFAULT: '#D4A44A', light: '#E8C77F' },
        ink: { DEFAULT: '#2C2C2A', muted: '#5E5E58' },
        disc: { d: '#D64545', i: '#E6B43C', s: '#2E9E62', c: '#2E78C2' },
      },
      fontFamily: {
        head: ['Montserrat', 'system-ui', 'sans-serif'],
        body: ['Lato', 'system-ui', 'sans-serif'],
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
      },
      boxShadow: { soft: '0 10px 30px -12px rgba(20,38,31,.25)' },
    },
  },
  plugins: [],
};
