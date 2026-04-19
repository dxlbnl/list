<script lang="ts">
	import { DropdownMenu as BitsDropdown } from "bits-ui";

	let { class: className, ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<BitsDropdown.Separator class="menu-separator {className || ''}" {...rest} />

<style>
	:global {
		.menu-separator {
			height: 1px;
			background: var(--border);
			margin: var(--space-1) 0;
		}
	}
</style>
