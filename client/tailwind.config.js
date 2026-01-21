/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'apero-dark': '#0f172a',    // Background principal (Slate 900)
                'apero-panel': '#1e293b',   // Panels (Slate 800)
                'apero-border': '#334155',  // Borders (Slate 700)
                'apero-primary': '#8b5cf6', // Violet
                'apero-accent': '#06b6d4',  // Cyan
            }
        },
    },
    plugins: [],
}
