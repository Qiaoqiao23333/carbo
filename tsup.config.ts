import { defineConfig } from 'tsup';

export default defineConfig([
  // The published package.
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    target: 'es2022',
  },
  // A single-file browser build for the GitHub Pages demo, committed to the
  // repo so the page works on a plain static host with no build step.
  {
    entry: { carbo: 'src/index.ts' },
    outDir: 'docs',
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: false,
    minify: true,
    treeshake: true,
    target: 'es2022',
  },
]);
