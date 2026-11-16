import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        goodhand: {
          primary: '#0e2378',
          secondary: '#193893',
          red: '#D60000',
          yellow: '#ffc107'
        }
      }
    }
  },
  plugins: []
};

export default config;
