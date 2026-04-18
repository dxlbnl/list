import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/kit/vite';
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess({
		postcss: {
				plugins: [
						tailwind, 
						autoprefixer
				]
		}}),

	kit: {
		adapter: adapter({ out: 'build' })
		
	}
};

export default config;
