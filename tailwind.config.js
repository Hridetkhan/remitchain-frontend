module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bangladesh: {
          green: '#006a4e',
          red: '#f42a41',
        },
      },
      backgroundImage: {
        'flag-gradient': 'linear-gradient(135deg, #006a4e 0%, #004d3a 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
}