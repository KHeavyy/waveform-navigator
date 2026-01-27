import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		fs: { allow: ['..'] },
		watch: {
			// ensure Vite notices changes to files outside the demo folder
			usePolling: true,
		},
	},
});
