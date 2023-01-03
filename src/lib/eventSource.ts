import { browser } from '$app/environment';
import { readable } from 'svelte/store';
import { goto } from '$app/navigation';
import type { Readable } from 'svelte/store';

export function source<T>(
  uri:string,
  initial = undefined,
reduce = (acc: T|undefined, value: T): T => value
) : Readable<T> {
  return readable<T>(initial, set => {
    if (browser) {
      let value: T|undefined = initial
      const events = new window.EventSource(uri)
      events.onmessage = ({ data }) => set(value = reduce(value, JSON.parse(data)))
      events.onerror = err => {
        console.log(err)
        // goto('/')
      }

      return () => events.close()
    }

  })
}