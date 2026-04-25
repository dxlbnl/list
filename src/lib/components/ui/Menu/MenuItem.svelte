<script lang="ts">
	import { DropdownMenu as BitsDropdown } from "bits-ui";
	import type { DropdownMenuItemProps } from "bits-ui";
	import type { Snippet } from "svelte";

	let {
		children,
		class: className,
		onSelect,
		danger = false,
		highlightAccent = false,
		...rest
	}: DropdownMenuItemProps & {
		children: Snippet;
		danger?: boolean;
		highlightAccent?: boolean;
	} = $props();
</script>

<BitsDropdown.Item
	class="menu-item {className || ''} {danger ? 'danger' : ''} {highlightAccent ? 'highlight-accent' : ''}"
	{onSelect}
	{...rest}
>
	{@render children()}
</BitsDropdown.Item>

<style>
	:global {
		.menu-item {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			padding: var(--space-2) var(--space-3);
			border-radius: var(--radius-md);
			cursor: pointer;
			font-size: 0.875rem;
			color: var(--fg-2);
			transition: background 0.1s ease, color 0.1s ease;
			outline: none;
			position: relative;
			user-select: none;

			&[data-highlighted],
			&:hover {
				background-color: var(--bg-2) !important;
				color: var(--fg-1) !important;

				&::before {
					content: "";
					position: absolute;
					left: 0;
					top: var(--space-2);
					bottom: var(--space-2);
					width: 2px;
					background: var(--accent);
					border-radius: 0 2px 2px 0;
				}

				.icon-container {
					opacity: 1;
					color: var(--accent);
				}
			}

			&:active {
				transform: scale(0.98);
			}

			&.danger {
				color: var(--danger);

				&[data-highlighted],
				&:hover {
					background-color: var(--danger) !important;
					color: white !important;

					.icon-container {
						opacity: 1;
						color: white;
					}
				}
			}

			&.highlight-accent {
				color: var(--accent);
				border: 1px dashed var(--accent);
				margin-top: var(--space-1);

				&[data-highlighted],
				&:hover {
					background-color: var(--accent) !important;
					color: white !important;

					.icon-container {
						color: white;
					}
				}
			}

			.icon-container {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 20px;
				opacity: 0.7;
			}
		}
	}
</style>
