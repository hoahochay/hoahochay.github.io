import { defineConfig } from 'vite';

export default defineConfig({
  // Đường dẫn tương đối: chạy được ở mọi thư mục con (vd. GitHub Pages: /chemistry/)
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
