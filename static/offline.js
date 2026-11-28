// This public shell implements the local account storage contract from $lib/account.
// The selector is only used for local IndexedDB lookup.
const selectorCookie = 'list_local_account';
const content = document.querySelector('#offline-content');
const message = document.querySelector('#offline-message');
let lastAccount;
let renderVersion = 0;

function accountSelector() {
	const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(selectorCookie + '='));
	try {
		return entry ? decodeURIComponent(entry.slice(selectorCookie.length + 1)) : '';
	} catch {
		return '';
	}
}

function openAccount(account) {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(`ListAppDB:account:${account}`);
		request.onupgradeneeded = () => request.transaction.abort();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function getRows(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function listForPath(lists, account) {
	const slug = decodeURIComponent(location.pathname.replace(/^\/|\/$/g, ''));
	return lists.find((list) => list.slug === slug && list.createdBy === account)
		?? lists.find((list) => list.slug === slug)
		?? lists.find((list) => slug === `${list.slug}--${list.createdBy.slice(0, 8)}`)
		?? lists.find((list) => list.id === slug);
}

function addText(parent, tag, text) {
	const element = document.createElement(tag);
	element.textContent = text;
	parent.append(element);
	return element;
}

function renderLists(lists) {
	addText(content, 'h2', 'Saved lists');
	const entries = addText(content, 'ul', '');
	for (const list of lists) {
		const link = addText(addText(entries, 'li', ''), 'a', list.name);
		link.href = '/' + encodeURIComponent(list.id);
	}
}

function renderItems(list, items) {
	const back = addText(content, 'a', 'All saved lists');
	back.href = '/';
	addText(content, 'h2', list.name);
	const entries = addText(content, 'ul', '');
	for (const item of items.filter((item) => !item.deletedAt).sort((a, b) => a.rank - b.rank)) {
		const prefix = item.groupName ? item.groupName + ' · ' : '';
		const row = addText(entries, 'li', prefix + item.name);
		if (item.done) row.className = 'done';
	}
}

async function showAccount() {
	const account = accountSelector();
	if (account === lastAccount) return;
	lastAccount = account;
	const version = ++renderVersion;
	content.replaceChildren();
	message.textContent = 'Reconnect to open your lists.';
	if (!account) return;

	let db;
	try {
		db = await openAccount(account);
		const lists = await getRows(db.transaction('lists').objectStore('lists').getAll());
		if (!lists.length || version !== renderVersion || account !== accountSelector()) return;
		const list = listForPath(lists, account);
		const items = list
			? await getRows(db.transaction('items').objectStore('items').index('listId').getAll(list.id))
			: [];
		if (version !== renderVersion || account !== accountSelector()) return;
		message.textContent = 'You can read your saved lists. Reconnect to make changes here.';
		if (list) renderItems(list, items);
		else renderLists(lists);
	} catch {
		// This browser may not have an account database yet.
	} finally {
		db?.close();
	}
}

document.querySelector('#offline-retry').addEventListener('click', () => location.reload());
window.addEventListener('pageshow', showAccount);
window.addEventListener('focus', showAccount);
window.addEventListener('pagehide', () => {
	lastAccount = undefined;
	renderVersion++;
	content.replaceChildren();
});
window.cookieStore?.addEventListener('change', showAccount);
void showAccount();
