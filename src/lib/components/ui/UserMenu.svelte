<script lang="ts">
	import { DropdownMenu } from "bits-ui";
	import { syncManager } from "$lib/client/sync.svelte";
	import { fly } from "svelte/transition";
	import Dialog from "./Dialog.svelte";
	import { QRCode } from "qrcode";
	import { page } from "$app/state";
	import { deleteList } from "$lib/client/actions";
	import { goto } from "$app/navigation";
	import { menuState } from "$lib/client/menu.svelte";

	let { user } = $props();

	let qrCodeDataUrl = $state("");
	let isSyncDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let isLoadingQr = $state(false);
	let confirmDeleteName = $state("");

	const currentList = $derived(page.data.initialList);

	async function handleDeleteList() {
		if (confirmDeleteName === currentList?.name) {
			await deleteList(currentList.id);
			isDeleteDialogOpen = false;
			confirmDeleteName = "";
			goto("/");
		}
	}

	async function handleSyncDevice() {
		isLoadingQr = true;
		try {
			const res = await fetch("/api/auth/clone", { method: "POST" });
			const { url } = await res.json();
			qrCodeDataUrl = await QRCode.toDataURL(url, {
				width: 300,
				margin: 2,
				color: {
					dark: "#000000",
					light: "#ffffff",
				},
			});
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
	<DropdownMenu.Root>
		<DropdownMenu.Trigger class="user-trigger">
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
		</DropdownMenu.Trigger>

		<DropdownMenu.Portal disabled={true}>
			<DropdownMenu.Content
				class="menu-content"
				sideOffset={8}
				align="end"
				forceMount
			>
				{#snippet child({ wrapperProps, props, open })}
					{#if open}
						<div {...wrapperProps}>
							<div
								{...props}
								transition:fly={{ y: 8, duration: 200 }}
							>
								<div class="menu-status-header">
									<div class="status-dot" style:background={statusColor} class:pulse={syncManager.isSyncing}></div>
									<span class="tiny muted mono uppercase tracking-widest">{statusText}</span>
								</div>

								<DropdownMenu.Separator class="separator" />

								<DropdownMenu.Group>
									<DropdownMenu.Item
										class="menu-item"
										onSelect={() =>
											(window.location.href =
												"/settings")}
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
												/><circle
													cx="12"
													cy="12"
													r="3"
												/></svg
											>
										</div>
										<span>Settings</span>
									</DropdownMenu.Item>

									<DropdownMenu.Item
										class="menu-item"
										onSelect={() =>
											(isSyncDialogOpen = true)}
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
									</DropdownMenu.Item>
								</DropdownMenu.Group>

								{#if menuState.contextualSnippet}
									<DropdownMenu.Separator class="separator" />
									<DropdownMenu.Group>
										{@render menuState.contextualSnippet()}
									</DropdownMenu.Group>
								{/if}
							</div>
						</div>
					{/if}
				{/snippet}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>

	<Dialog
		bind:open={isSyncDialogOpen}
		title="Sync Device"
		description="Scan this QR code with another device to mirror this session. This link expires in 10 minutes."
	>
		<div class="qr-wrapper">
			<div class="qr-container">
				{#if isLoadingQr}
					<div class="qr-placeholder mono small muted">
						Generating secure key...
					</div>
				{:else if qrCodeDataUrl}
					<img
						src={qrCodeDataUrl}
						alt="Sync QR Code"
						class="qr-image"
					/>
				{:else}
					<div class="qr-placeholder mono small danger">
						Failed to generate key
					</div>
				{/if}
			</div>
			<div class="qr-footer small muted mono">MIRROR_PROTOCOL_V1</div>
		</div>
	</Dialog>

	<Dialog
		bind:open={isDeleteDialogOpen}
		title="Delete List"
		description="This action cannot be undone. To confirm, please type the name of the list: {currentList?.name}"
	>
		<div class="qr-wrapper">
			<div class="input-group">
				<div class="input-prefix">&gt;</div>
				<input
					type="text"
					placeholder="CONFIRM_LIST_NAME"
					bind:value={confirmDeleteName}
					onkeydown={(e) => e.key === "Enter" && handleDeleteList()}
				/>
				<button
					class="input-action-btn danger"
					onclick={handleDeleteList}
					disabled={confirmDeleteName !== currentList?.name}
				>
					DELETE
				</button>
			</div>
			<div class="qr-footer small muted mono">DANGER_ZONE_V1</div>
		</div>
	</Dialog>
</div>

<style>
	.user-menu-container {
		position: relative;

		:global {
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

			.status-dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
			}

			.pulse {
				animation: pulse 2s infinite;
			}

			@keyframes pulse {
				0% {
					opacity: 1;
					transform: scale(1);
				}
				50% {
					opacity: 0.4;
					transform: scale(1.3);
				}
				100% {
					opacity: 1;
					transform: scale(1);
				}
			}

			.chevron {
				opacity: 0.3;
				margin-right: var(--space-2);
			}

			.menu-content {
				position: absolute;
				top: calc(100% + 8px);
				right: 0;
				background: rgba(20, 20, 20, 0.85);
				border: 1px solid var(--border);
				border-radius: var(--radius-lg);
				padding: var(--space-2);
				min-width: 260px;
				box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
				backdrop-filter: blur(20px) saturate(180%);
				outline: none;
				z-index: 1000;
			}

			.separator {
				height: 1px;
				background: var(--border);
				margin: var(--space-1) 0;
			}

			.menu-item {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				padding: var(--space-2) var(--space-3);
				border-radius: var(--radius-md);
				cursor: pointer;
				font-size: 0.875rem;
				color: var(--fg-2);
				transition:
					background 0.1s ease,
					color 0.1s ease;
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
			}

			.icon-container {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 20px;
				opacity: 0.7;
			}

			.menu-status-header {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-2) var(--space-3);
				opacity: 0.8;
			}

			.qr-wrapper {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-4);
			}

			.qr-container {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				min-height: 250px;
				width: 100%;
				background: white;
				border-radius: var(--radius-md);
				padding: var(--space-4);
			}

			.qr-image {
				width: 100%;
				max-width: 250px;
				image-rendering: pixelated;
			}

			.qr-placeholder {
				color: #000;
				text-align: center;
			}

			.qr-footer {
				opacity: 0.5;
				letter-spacing: 2px;
			}
		}

		@media (max-width: 600px) {
			:global {
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
	}
</style>
