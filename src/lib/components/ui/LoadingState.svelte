<script lang="ts">
	let { message = "Loading data..." } = $props();
</script>

<div class="ui-loading-state">
	<p>{message}</p>
	<div class="shimmer-bar"></div>
</div>

<style>
	:global {
		.ui-loading-state {
			text-align: center;
			padding: var(--space-12);
			border: 1px dashed var(--border);
			border-radius: var(--radius-lg);
			font-family: var(--font-mono);
			text-transform: uppercase;
			letter-spacing: 0.1em;
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			color: var(--fg-2);
			background: var(--bg-1);
		}

		.shimmer-bar {
			width: 100%;
			max-width: 200px;
			margin: 0 auto;
			height: 1px;
			background: var(--border);
			position: relative;
			overflow: hidden;

			&::after {
				content: "";
				position: absolute;
				top: 0;
				left: 0;
				width: 40%;
				height: 100%;
				background: var(--accent);
				animation: shimmer-slide 1.5s infinite ease-in-out;
			}
		}

		@keyframes shimmer-slide {
			0% { transform: translateX(-100%); }
			100% { transform: translateX(300%); }
		}
	}
</style>
