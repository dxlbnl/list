<script lang="ts">
	import * as Menu from "./Menu";
	import { syncManager } from "$lib/client/sync.svelte";
	import Dialog from "./Dialog.svelte";
	import { page } from "$app/state";
	import { deleteList } from "$lib/client/actions";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { menuState } from "$lib/client/menu.svelte";
	import QRCodeDisplay from "./QRCodeDisplay.svelte";
	import ConfirmDeleteDialog from "./ConfirmDeleteDialog.svelte";
	import * as auth from "$lib/client/auth";

	let { user } = $props();

	let qrCodeUrl = $state("");
	let isSyncDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let isLoadingQr = $state(false);

	const currentList = $derived(page.data.initialList);

	async function handleDeleteList() {
		if (currentList?.id) {
			await deleteList(currentList.id);
			isDeleteDialogOpen = false;
			goto(resolve("/"));
		}
	}

	async function handleSyncDevice() {
		isLoadingQr = true;
		qrCodeUrl = "";
		try {
			qrCodeUrl = await auth.getCloneUrl();
		} catch (e) {
			console.error("Failed to generate sync QR:", e);
		} finally {
			isLoadingQr = false;
		}
	}

	$effect(() => {
		if (isSyncDialogOpen) {
			handleSyncDevice();
		}
	});

	const statusColor = $derived(
		!syncManager.isOnline
			? "var(--danger)"
			: syncManager.isSyncing
				? "var(--accent)"
				: "var(--success)",
	);

	const statusText = $derived(
		!syncManager.isOnline
			? "Offline"
			: syncManager.isSyncing
				? "Syncing..."
				: "Online",
	);

	function getInitial() {
		if (user?.email) return user.email[0].toUpperCase();
		if (user?.id) return user.id[0].toUpperCase();
		return "G";
	}

	function getShortId() {
		if (user?.email) return user.email.split("@")[0];
		if (user?.id) return user.id.slice(0, 8);
		return "Guest";
	}
</script>

<div class="user-menu-container">
	<Menu.Root>
		<Menu.Trigger class="user-trigger">
			<div class="avatar mono">
				{getInitial()}
				<div
					class="status-indicator"
					style:background={statusColor}
					class:pulse={syncManager.isSyncing}
				></div>
			</div>
			<div class="user-label-container">
				<span class="mono small user-id">{getShortId()}</span>
				<span class="tiny status-text" style:color={statusColor}
					>{statusText}</span
				>
			</div>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="chevron"><path d="m6 9 6 6 6-6" /></svg
			>
		</Menu.Trigger>

		<Menu.Content align="end">
			<div class="menu-status-header">
				<div
					class="status-dot"
					style:background={statusColor}
					class:pulse={syncManager.isSyncing}
				></div>
				<div class="status-header-text">
					<span class="tiny muted mono uppercase tracking-widest"
						>{statusText}</span
					>
					{#if syncManager.lastSyncError}
						<span class="tiny danger mono error-message"
							>{syncManager.lastSyncError}</span
						>
					{/if}
				</div>
			</div>

			<Menu.Separator />

			<Menu.Group>
				{#if user?.email_verified}
					<Menu.Item
						onSelect={() => (window.location.href = "/settings")}
					>
						<div class="icon-container">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
								/><circle cx="12" cy="12" r="3" /></svg
							>
						</div>
						<span>Settings</span>
					</Menu.Item>
				{:else}
					<Menu.Item
						highlightAccent
						onSelect={() => (window.location.href = "/settings")}
					>
						<div class="icon-container">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"
								/></svg
							>
						</div>
						<span class="font-bold">Register</span>
					</Menu.Item>

					<Menu.Item
						class="muted"
						onSelect={() => (window.location.href = "/login")}
					>
						<div class="icon-container">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
								/><polyline points="10 17 15 12 10 7" /><line
									x1="15"
									y1="12"
									x2="3"
									y2="12"
								/></svg
							>
						</div>
						<span>Login</span>
					</Menu.Item>
				{/if}

				<Menu.Item onSelect={() => (isSyncDialogOpen = true)}>
					<div class="icon-container">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><rect
								width="14"
								height="20"
								x="5"
								y="2"
								rx="2"
								ry="2"
							/><path d="M12 18h.01" /></svg
						>
					</div>
					<span>Sync Device</span>
				</Menu.Item>
			</Menu.Group>

			{#if menuState.contextualSnippet}
				<Menu.Separator />
				<Menu.Group>
					{@render menuState.contextualSnippet()}
				</Menu.Group>
			{/if}

			{#if user?.email_verified}
				<Menu.Separator />
				<Menu.Group>
					<Menu.Item danger onSelect={auth.logout}>
						<div class="icon-container">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
								/><polyline points="16 17 21 12 16 7" /><line
									x1="21"
									y1="12"
									x2="9"
									y2="12"
								/></svg
							>
						</div>
						<span>Logout</span>
					</Menu.Item>
				</Menu.Group>
			{/if}
		</Menu.Content>
	</Menu.Root>

	<Dialog
		bind:open={isSyncDialogOpen}
		title="Sync Device"
		description="Scan this QR code with another device to mirror this session. This link expires in 10 minutes."
	>
		<div class="user-menu-qr-wrapper">
			<QRCodeDisplay url={qrCodeUrl} isLoading={isLoadingQr} />
			<div class="user-menu-qr-footer small muted mono">
				Sync session active
			</div>
		</div>
	</Dialog>

	<ConfirmDeleteDialog
		bind:open={isDeleteDialogOpen}
		title="Delete List"
		description="This action cannot be undone. To confirm, please type the name of the list: {currentList?.name}"
		targetName={currentList?.name}
		onConfirm={handleDeleteList}
		footerLabel="Warning: permanent action"
	/>
</div>

<style>
	:global {
		.user-menu-container {
			position: relative;

			.user-trigger {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				padding: var(--space-1);
				background: var(--bg-1);
				border: 1px solid var(--border);
				border-radius: 100px;
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				color: var(--fg-2);
				cursor: pointer;
				user-select: none;

				&:hover {
					border-color: var(--border-hover);
					background: var(--bg-2);
					color: var(--fg-1);
					transform: translateY(-1px);
					box-shadow: var(--shadow-sm);
				}
			}

			.avatar {
				width: 32px;
				height: 32px;
				background: var(--bg-3);
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 0.8rem;
				font-weight: 600;
				color: var(--fg-0);
				position: relative;
				border: 1px solid var(--border);
			}

			.status-indicator {
				position: absolute;
				bottom: 0;
				right: 0;
				width: 10px;
				height: 10px;
				border-radius: 50%;
				border: 2px solid var(--bg-1);
			}

			.user-label-container {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				line-height: 1;
				padding-right: var(--space-2);
			}

			.user-id {
				max-width: 80px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				font-weight: 500;
			}

			.tiny {
				font-size: 0.65rem;
			}
			.uppercase {
				text-transform: uppercase;
			}
			.tracking-widest {
				letter-spacing: 0.1em;
			}

			.status-text {
				font-weight: 600;
				margin-top: 2px;
			}

			.chevron {
				opacity: 0.3;
				margin-right: var(--space-2);
			}

			.status-header-text {
				display: flex;
				flex-direction: column;
				gap: 2px;
			}

			.error-message {
				color: var(--danger);
				font-size: 0.6rem;
				opacity: 0.8;
				max-width: 200px;
				line-height: 1.2;
			}

			@media (max-width: 250px) {
				.user-id,
				.user-label-container,
				.chevron {
					display: none;
				}
				.user-trigger {
					padding: var(--space-1);
				}
			}
		}

		/* Portaled elements */
		.user-menu-qr-wrapper {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: var(--space-4);
			width: 100%;
		}
	}
</style>
