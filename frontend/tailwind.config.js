/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'card-red': '#dc2626',
        'card-black': '#1f2937',
        'card-gold': '#f59e0b',
        'card-back': '#1e40af',
      },
      animation: {
        'flip': 'flip 0.6s ease-in-out',
        'deal': 'deal 0.8s ease-in-out',
        'win': 'win 1s ease-in-out',
      },
    },
  },
  plugins: [],
}
