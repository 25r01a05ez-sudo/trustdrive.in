/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Palette sampled directly from the approved TrustDrive logo, so
        // the site matches the brand mark exactly rather than just being
        // "close" to it.
        paper: "#F6F4EE",
        ink: "#12241D",
        primary: {
          DEFAULT: "#1A3A30",
          light: "#2A5245",
          dark: "#102820",
        },
        gold: {
          DEFAULT: "#B49054",
          light: "#CBAD79",
          dark: "#8A6D3D",
        },
        muted: "#5F6B63",
        line: "#DEDBD0",
        danger: "#B23A2E",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
