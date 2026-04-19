import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

class ThemeManager {
	current = $state<Theme>('system');

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('theme') as Theme | null;
			this.current = saved || 'system';

			$effect.root(() => {
				$effect(() => {
					localStorage.setItem('theme', this.current);
					this.apply();
				});
			});
		}
	}

	set(theme: Theme) {
		this.current = theme;
	}

	apply() {
		if (!browser) return;

		const isDark =
			this.current === 'dark' ||
			(this.current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

		document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
		
		// Also update the color-scheme meta tag if needed, but app.css handles color-scheme
	}
}

export const themeManager = new ThemeManager();
