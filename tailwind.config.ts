import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "hsl(252, 85%, 63%)",
          hover: "hsl(252, 85%, 55%)",
          light: "hsl(252, 100%, 97%)",
        },
        sidebar: {
          bg: "hsl(246, 28%, 12%)",
          darker: "hsl(246, 28%, 9%)",
          muted: "hsl(244, 12%, 60%)",
          text: "#ffffff",
        },
        canvas: {
          DEFAULT: "hsl(230, 25%, 97%)",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "hsl(240, 15%, 97%)",
        },
        ink: {
          primary: "hsl(246, 22%, 13%)",
          muted: "hsl(244, 9%, 57%)",
        },
        // Paleta do formulário de cadastro de títulos.
        // Antes emulava um ERP legado (cinza #f2f2f2 / navy #1f3b73); agora aponta
        // para a linguagem moderna do restante do app. Os nomes foram mantidos
        // porque são semânticos e usados em ~100 pontos de ErpForm/CadastroTituloPage.
        erp: {
          title: "hsl(246, 22%, 13%)",    // = ink.primary
          label: "hsl(246, 22%, 13%)",    // = ink.primary
          req: "hsl(350, 89%, 60%)",      // obrigatoriedade (rose)
          section: "hsl(246, 22%, 13%)",  // = ink.primary
          accent: "hsl(252, 85%, 63%)",   // = brand
          icon: "hsl(244, 9%, 57%)",      // = ink.muted
          border: "hsl(240, 12%, 90%)",   // borda de campo
          rule: "hsl(240, 15%, 94%)",     // filete / divisória
          disabled: "hsl(240, 15%, 97%)", // = surface.muted
          status: "hsl(38, 92%, 50%)",    // pendência (amber)
          link: "hsl(252, 85%, 63%)",     // = brand
          focus: "hsl(252, 85%, 63%)",    // = brand
          head: "hsl(240, 15%, 97%)",     // = surface.muted
          zebra: "hsl(240, 20%, 99%)",    // zebra sutil
        },
      },
      borderRadius: {
        'field': '10px',
        'xl': '14px',
        '2xl': '20px',
      },
      boxShadow: {
        'soft': '0px 8px 24px rgba(23, 21, 38, 0.04)',
        'elevated': '0px 12px 32px rgba(23, 21, 38, 0.08)',
      }
    },
  },
  plugins: [],
};
export default config;
