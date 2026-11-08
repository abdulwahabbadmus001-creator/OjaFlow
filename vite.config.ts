import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Rewrites barrel `import { IconA, IconB } from 'lucide-react'` statements into
 * direct modular icon imports (`lucide-react/dist/esm/icons/<icon>.mjs`),
 * avoiding loading or transforming the 1,600+ icon barrel on dev & build.
 */
function modularLucideIcons(): Plugin {
  const iconMap = new Map<string, string>();

  return {
    name: 'ojaflow-modular-lucide-icons',
    enforce: 'pre',
    buildStart() {
      if (iconMap.size > 0) return;
      try {
        const entryPath = path.resolve(
          process.cwd(),
          'node_modules/lucide-react/dist/esm/lucide-react.mjs'
        );
        const content = fs.readFileSync(entryPath, 'utf8');
        const exportRegex =
          /export\s*\{([^}]+)\}\s*from\s*['"]\.\/icons\/([^'"]+)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = exportRegex.exec(content)) !== null) {
          const specifiers = match[1].split(',');
          const file = match[2];
          for (const rawSpec of specifiers) {
            const parts = rawSpec.trim().split(/\s+as\s+/);
            const exportedName = (parts[1] || parts[0] || '').trim();
            if (exportedName) {
              iconMap.set(
                exportedName,
                `lucide-react/dist/esm/icons/${file}`
              );
            }
          }
        }
      } catch {
        // Fallback gracefully to standard resolution if entry file is unavailable
      }
    },
    transform(code, id) {
      if (
        iconMap.size === 0 ||
        id.includes('node_modules') ||
        !code.includes('lucide-react')
      ) {
        return null;
      }

      const importRegex =
        /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]\s*;?/g;
      let mutated = false;

      const transformed = code.replace(importRegex, (fullMatch, specGroup: string) => {
        const specifiers = specGroup
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        const lines: string[] = [];
        for (const spec of specifiers) {
          if (spec.startsWith('type ')) {
            return fullMatch;
          }
          const parts = spec.split(/\s+as\s+/);
          const imported = parts[0].trim();
          const local = (parts[1] || parts[0]).trim();
          const targetModule = iconMap.get(imported);
          if (!targetModule) {
            return fullMatch;
          }
          lines.push(`import ${local} from '${targetModule}';`);
        }

        mutated = true;
        return lines.join('\n');
      });

      return mutated ? { code: transformed, map: null } : null;
    }
  };
}

export default defineConfig({
  plugins: [modularLucideIcons(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (
            id.includes('node_modules/react-markdown') ||
            id.includes('node_modules/remark-') ||
            id.includes('node_modules/micromark') ||
            id.includes('node_modules/mdast-') ||
            id.includes('node_modules/hast-') ||
            id.includes('node_modules/unified') ||
            id.includes('node_modules/vfile')
          ) {
            return 'markdown-vendor';
          }
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
});
