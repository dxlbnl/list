<script lang="ts">
	import QRCode from "qrcode";

	let { url, isLoading = false } = $props();
	let qrDataUrl = $state("");
	let error = $state(false);

	$effect(() => {
		if (url && !isLoading) {
			generateQR(url);
		}
	});

	async function generateQR(text: string) {
		error = false;
		try {
			qrDataUrl = await QRCode.toDataURL(text, {
				width: 300,
				margin: 2,
				color: {
					dark: "#000000",
					light: "#ffffff",
				},
			});
		} catch (e) {
			console.error("Failed to generate QR:", e);
			error = true;
		}
	}
</script>

<div class="ui-qr-container">
	{#if isLoading}
		<div class="ui-qr-placeholder mono small muted">
			Generating secure key...
		</div>
	{:else if qrDataUrl}
		<img src={qrDataUrl} alt="QR Code" class="ui-qr-image" />
	{:else if error}
		<div class="ui-qr-placeholder mono small danger">
			Failed to generate key
		</div>
	{/if}
</div>

<style>
	:global {
		.ui-qr-container {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			width: 100%;
			max-width: 280px;
			aspect-ratio: 1 / 1;
			background: white;
			border-radius: var(--radius-md);
			padding: var(--space-4);
			box-shadow: 0 0 40px rgba(0, 0, 0, 0.3);
		}

		.ui-qr-image {
			width: 100%;
			max-width: 250px;
			image-rendering: pixelated;
		}

		.ui-qr-placeholder {
			color: #000;
			text-align: center;
		}
	}
</style>
