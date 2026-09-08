import type { Config } from 'tailwindcss';
import { lightTheme } from './src/shared/theme/tokens';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: lightTheme.colors,
      fontSize: Object.fromEntries(
        Object.entries(lightTheme.typography).map(([name, value]) => [
          name,
          [
            `${value.fontSize}px`,
            {
              lineHeight: `${value.lineHeight}px`,
              fontWeight: value.fontWeight,
              ...('letterSpacing' in value
                ? { letterSpacing: `${value.letterSpacing}px` }
                : {}),
            },
          ],
        ]),
      ),
      opacity: Object.fromEntries(
        Object.entries(lightTheme.opacity).map(([key, value]) => [
          key,
          String(value),
        ]),
      ),
      maxWidth: { page: `${lightTheme.layout.pageMaxWidth}px` },
    },
  },
  plugins: [],
} satisfies Config;
