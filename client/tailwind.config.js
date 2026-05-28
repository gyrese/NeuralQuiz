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

                // GeoTrackr Colors from Stitch (Pop Culture / Vivid Pulse)
                "background": "#fbf8ff",
                "inverse-on-surface": "#f0efff",
                "surface-bright": "#fbf8ff",
                "tertiary-fixed": "#ffd8e6",
                "surface-variant": "#dee0ff",
                "on-secondary-fixed": "#2f004c",
                "secondary-fixed": "#f3daff",
                "secondary": "#8d00d9",
                "primary-container": "#ffd700",
                "outline-variant": "#d0c6ab",
                "on-primary-fixed": "#221b00",
                "on-tertiary-container": "#ad2571",
                "on-primary-container": "#705e00",
                "on-tertiary-fixed-variant": "#8c0058",
                "on-tertiary": "#ffffff",
                "surface-dim": "#d5d8fa",
                "surface-container-low": "#f4f2ff",
                "secondary-container": "#aa30fa",
                "on-error": "#ffffff",
                "tertiary-container": "#ffccdf",
                "error-container": "#ffdad6",
                "surface-tint": "#705d00",
                "on-primary": "#ffffff",
                "surface-container-lowest": "#ffffff",
                "inverse-primary": "#e9c400",
                "surface-container": "#edecff",
                "on-error-container": "#93000a",
                "error": "#ba1a1a",
                "tertiary-fixed-dim": "#ffb0d0",
                "on-primary-fixed-variant": "#544600",
                "on-background": "#161a33",
                "outline": "#7e775f",
                "on-secondary-container": "#fffbff",
                "surface": "#fbf8ff",
                "on-surface-variant": "#4d4732",
                "tertiary": "#ac2471",
                "on-secondary": "#ffffff",
                "secondary-fixed-dim": "#e3b5ff",
                "surface-container-highest": "#dee0ff",
                "primary-fixed": "#ffe16d",
                "on-tertiary-fixed": "#3d0024",
                "inverse-surface": "#2b2f49",
                "primary-fixed-dim": "#e9c400",
                "on-surface": "#161a33",
                "surface-container-high": "#e6e6ff",
                "primary": "#705d00",
                "on-secondary-fixed-variant": "#6e00ab",
                gold: "#FFD700",
                silver: "#C0C0C0",
                bronze: "#CD7F32"
            },
            borderRadius: {
                DEFAULT: "0.25rem",
                lg: "0.5rem",
                xl: "0.75rem",
                full: "9999px",
                "2xl": "1.5rem"
            },
            spacing: {
                "gutter-desktop": "40px",
                "stack-xl": "32px",
                "stack-xs": "4px",
                "gutter-mobile": "16px",
                "safe-area-tv": "80px",
                "unit": "4px",
                "stack-md": "16px",

                // Stitch Pop Culture spacings
                "base": "4px",
                "container-max": "1280px",
                "gutter": "16px",
                "lg": "24px",
                "xl": "32px",
                "md": "16px",
                "sm": "8px",
                "xs": "4px",
                "margin-mobile": "16px",
                "margin-desktop": "40px"
            },
            fontFamily: {
                // Stitch Pop Culture families mapped to both new and old keys for compatibility
                "title-md": ["Space Grotesk", "sans-serif"],
                "headline-lg": ["Space Grotesk", "sans-serif"],
                "display-xl": ["Space Grotesk", "sans-serif"],
                "body-sm": ["Plus Jakarta Sans", "sans-serif"],
                "body-lg": ["Plus Jakarta Sans", "sans-serif"],
                "label-caps": ["Space Grotesk", "sans-serif"],
                "headline-lg-mobile": ["Space Grotesk", "sans-serif"],
                headline: ["Space Grotesk", "sans-serif"],
                display: ["Space Grotesk", "sans-serif"],
                body: ["Plus Jakarta Sans", "sans-serif"],
                label: ["Space Grotesk", "sans-serif"],

                "headline-md": ["Space Grotesk", "sans-serif"],
                "headline-sm": ["Space Grotesk", "sans-serif"],
                "headline-xl": ["Space Grotesk", "sans-serif"],
                "label-md": ["Space Grotesk", "sans-serif"],
                "label-lg": ["Space Grotesk", "sans-serif"],
                "display-lg": ["Space Grotesk", "sans-serif"],
                "body-md": ["Plus Jakarta Sans", "sans-serif"],
                "code-data": ["Plus Jakarta Sans", "sans-serif"]
            },
            fontSize: {
                "headline-sm": ["20px", { "lineHeight": "24px", "fontWeight": "700" }],
                "headline-md": ["24px", { "lineHeight": "28px", "fontWeight": "700" }],
                "headline-lg": ["32px", { "lineHeight": "36px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
                "label-md": ["12px", { "lineHeight": "14px", "fontWeight": "700" }],
                "headline-xl": ["48px", { "lineHeight": "52px", "letterSpacing": "-0.02em", "fontWeight": "900" }],
                "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "500" }],
                "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
                "label-lg": ["14px", { "lineHeight": "16px", "fontWeight": "700" }],
                "headline-lg-mobile": ["28px", { "lineHeight": "32px", "fontWeight": "700" }],
                "label-caps": ["12px", { "lineHeight": "1", "letterSpacing": "0.1em", "fontWeight": "700" }],
                "code-data": ["14px", { "lineHeight": "1.4", "letterSpacing": "0.02em", "fontWeight": "500" }],
                "display-lg": ["48px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700" }],
                "body-sm": ["14px", { "lineHeight": "1.4", "fontWeight": "400" }]
            }
        },
    },
    plugins: [],
}
