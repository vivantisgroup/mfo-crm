import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
    // Parent node_modules search path specifically for monorepos handling @tremor/react
    '../../node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Shadcn UI generic mappings
        border: 'var(--border-subtle)',
        input: 'var(--border-subtle)',
        ring: 'var(--brand-primary)',
        background: 'var(--bg-background)',
        foreground: 'var(--text-primary)',
        primary: {
          DEFAULT: 'var(--brand-primary)',
          foreground: 'var(--text-inverted)',
        },
        secondary: {
          DEFAULT: 'var(--bg-elevated)',
          foreground: 'var(--text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--color-red)',
          foreground: 'var(--text-inverted)',
        },
        muted: {
          DEFAULT: 'var(--bg-muted)',
          foreground: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--bg-elevated)',
          foreground: 'var(--text-primary)',
        },
        popover: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-primary)',
        },
        card: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-primary)',
        },

        // Tremor UI mapped natively to our theme variables
        tremor: {
          brand: {
            faint: 'var(--brand-faint)',
            muted: 'var(--brand-muted)',
            subtle: 'var(--brand-subtle)',
            DEFAULT: 'var(--brand-primary)',
            emphasis: 'var(--brand-emphasis)',
            inverted: 'var(--text-inverted)',
          },
          background: {
            muted: 'var(--bg-muted)',
            subtle: 'var(--bg-elevated)',
            DEFAULT: 'var(--bg-surface)',
            emphasis: 'var(--text-primary)',
          },
          border: {
            DEFAULT: 'var(--border-subtle)',
          },
          ring: {
            DEFAULT: 'var(--border-subtle)',
          },
          content: {
            subtle: 'var(--text-muted)',
            DEFAULT: 'var(--text-secondary)',
            emphasis: 'var(--text-primary)',
            strong: 'var(--text-primary)',
            inverted: 'var(--text-inverted)',
          },
        },
        
        // Tremor UI dark mode mapped to exactly the same CSS variables!
        // Our DOM [data-theme] architecture handles the actual color values natively.
        "dark-tremor": {
          brand: {
            faint: 'var(--brand-faint)',
            muted: 'var(--brand-muted)',
            subtle: 'var(--brand-subtle)',
            DEFAULT: 'var(--brand-primary)',
            emphasis: 'var(--brand-emphasis)',
            inverted: 'var(--text-inverted)',
          },
          background: {
            muted: 'var(--bg-muted)',
            subtle: 'var(--bg-elevated)',
            DEFAULT: 'var(--bg-surface)',
            emphasis: 'var(--text-primary)',
          },
          border: {
            DEFAULT: 'var(--border-subtle)',
          },
          ring: {
            DEFAULT: 'var(--border-subtle)',
          },
          content: {
            subtle: 'var(--text-muted)',
            DEFAULT: 'var(--text-secondary)',
            emphasis: 'var(--text-primary)',
            strong: 'var(--text-primary)',
            inverted: 'var(--text-inverted)',
          },
        },
      },
      
      // Tremor Custom Shadows
      boxShadow: {
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "dark-tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "dark-tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "dark-tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      
      // Tremor Custom Borders
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },

      // Tremor Typography
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },

      // Existing animations
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  
  // Required Tremor safelists to dynamically resolve colors inside components
  safelist: [
    {
      pattern:
        /^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern:
        /^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern:
        /^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
  ],
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
} satisfies Config;

export default config;
