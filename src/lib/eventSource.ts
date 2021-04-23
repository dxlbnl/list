import { browser } from '$app/env';
import { readable } from 'svelte/store';
import { goto } from '$app/navigation';

export const source = (
  uri:string,
  initial = null,
  reduce = (acc, value) => value
) : Readable =>
  readable(initial, set => {
    if (browser) {
      let value = initial
      const events = new window.EventSource(uri)
      events.onmessage = ({ data }) => set(value = reduce(value, JSON.parse(data)))
      events.onerror = err => goto('/')

      return () => events.close()
    }

  })