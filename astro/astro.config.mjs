// shortener/astro/astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
	output: 'static',
	outDir: '../dist', // Output to root dist for Wrangler

	// Vite specific configurations
	vite: {
		server: {
			proxy: {
				// Proxy API requests to your Cloudflare Worker dev server
				// This will match any request that doesn't have a common static file extension
				// and isn't handled by Astro's own routing.
				// Adjust the pattern if your API calls are more specific (e.g., /api/*)
				'/': { // Or more specific like '/api' if all your worker endpoints are under /api
					target: 'http://localhost:8787', // Your Wrangler dev server address
					changeOrigin: true, // Recommended for virtual hosted sites
					// You might not need a rewrite if your worker expects paths like /slug+url
					// If your worker expected /api/slug+url, you'd use rewrite: (path) => path.replace(/^\/api/, '')
					// For your current setup, where the worker expects the path directly, no rewrite is needed if proxying '/'
				}
			},
			fs: {
				// You might not need to change fs.allow if the proxy handles API calls.
				// Vite's default allow list usually includes the project root and workspace root.
				// The error message you saw was because Vite was trying to *serve* the API path as a file.
				// allow: [], // Only if you need to add specific directories outside the project root
			}
		}
	}
});
