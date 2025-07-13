import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  return {
    server: {
      port: Number(process.env.CLIENT_PORT) || 8080,
      open: false,
    },
  };
});
