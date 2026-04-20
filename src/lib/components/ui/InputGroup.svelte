<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		value: string;
		prefix?: string;
		actionLabel?: string;
		onAction?: () => void;
		danger?: boolean;
		disabled?: boolean;
		placeholder?: string;
		actionDisabled?: boolean;
	}

	let {
		value = $bindable(),
		prefix = '>',
		actionLabel,
		onAction,
		danger = false,
		disabled = false,
		placeholder = undefined,
		actionDisabled = false,
		...rest
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && onAction && !disabled && !actionDisabled && value.trim()) {
			onAction();
		}
	}
</script>

<div class="input-group" class:danger>
	{#if prefix}
		<div class="input-prefix">{prefix}</div>
	{/if}
	
	<input
		type="text"
		{placeholder}
		bind:value
		onkeydown={handleKeydown}
		{disabled}
		{...rest}
	/>

	{#if actionLabel}
		<button
			class="input-action-btn"
			class:danger
			onclick={onAction}
			disabled={disabled || actionDisabled || !value.trim()}
		>
			{actionLabel}
		</button>
	{/if}
</div>

<style>
	:global {
		/* Inherit core styles from app.css .input-group */
		
		.input-group.danger {
			&:focus-within {
				border-color: var(--danger) !important;
				box-shadow: 0 0 0 2px var(--danger-muted) !important;
			}

			.input-prefix {
				color: var(--danger) !important;
			}

			.input-action-btn.danger {
				background: var(--danger) !important;
				color: white !important;

				&:hover:not(:disabled) {
					background: var(--danger) !important;
					box-shadow: 0 0 20px var(--danger-muted) !important;
				}

				&:disabled {
					background: var(--bg-2) !important;
					color: var(--fg-3) !important;
					opacity: 0.5;
				}
			}
		}
	}
</style>
