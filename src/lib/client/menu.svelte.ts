import { type Snippet } from "svelte";

export class MenuState {
	contextualSnippet = $state<Snippet | null>(null);

	setContextualSnippet(snippet: Snippet | null) {
		this.contextualSnippet = snippet;
	}
}

export const menuState = new MenuState();
