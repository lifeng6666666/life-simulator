/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        midnight: {
          950: "#070a14",
          900: "#0a0e1a",
          800: "#0f1424",
          700: "#161d33",
          600: "#1e2742",
          500: "#2a3458",
        },
        amber: {
          DEFAULT: "#d4a574",
          light: "#e8c9a0",
          dark: "#b08850",
        },
        starwhite: "#e8e6e1",
        agent: {
          player: "#3d7a6e",
          playerLight: "#5fa89a",
          coach: "#8b6db5",
          coachLight: "#a88fd0",
          env: "#c4663a",
          envLight: "#e08855",
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "serif"],
        sans: ['"DM Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "star-drift": "starDrift 120s linear infinite",
        "typing": "typing 1.5s steps(30) infinite",
        "timeline-flow": "timelineFlow 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        starDrift: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-1000px)" },
        },
        typing: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        timelineFlow: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
    },
  },
  plugins: [],
};
