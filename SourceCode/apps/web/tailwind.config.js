/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5",
        secondary: "#06B6D4",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        neutral: "#F8FAFC",
        surface: "#FFFFFF",
        border: "#E2E8F0",
        text: {
          primary: "#0F172A",
          secondary: "#64748B",
          muted: "#94A3B8"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        hover: "0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)",
        modal: "0 20px 25px rgba(0,0,0,0.15)",
        qr: "0 8px 32px rgba(79,70,229,0.15)"
      }
    }
  },
  plugins: []
};
