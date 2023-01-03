import type { RequestHandler } from './$types';
import { stateMap, loadState, Store, updateAll } from '$lib/state.server';
import { error, redirect } from '@sveltejs/kit';

type StreamSource = UnderlyingSource<string> & {
  listener?: (data: Store) => void
};

export const GET: RequestHandler = ({ params }) => {
  const id = params.id;
  
  const state = loadState(id)
  console.log("Hi", id, state)
  if (!state) {
    // Check if store exists or redirect to /
    return new Response(null, redirect(302, '/'))
  }
  
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  const source: StreamSource  = {
    start(controller) {
      console.log("start")
      this.listener = data => {
        console.log('Got data to send', data)
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
      }
      state.emitter.on('state', this.listener)
      updateAll(id)
    },
    cancel(reason) {
      console.log("cancel", reason)
      if (this.listener) {
        state.emitter.off('state', this.listener)
        updateAll(id)
      }
    }
  };
  const stream = new ReadableStream(source);

  return new Response(stream, { headers });
};

export const POST = async ({ params, request }) => {
  const item = await request.json()
  const state = stateMap.get(params.id)
  if (!state) return error(400, 'unknown list')

  state.store.add(item)
  updateAll(params.id)
  return new Response(null, { status: 201 })
}
export const PUT = async ({ params, request }) => {
  const item = await request.json()
  const state = stateMap.get(params.id)
  if (!state) return error(400, 'unknown list')

  state.store.update(item)
  updateAll(params.id)
  return new Response(null, { status: 200 })
}
export const DELETE = async ({ params, request}) => {
  const item = await request.json()
  const state = stateMap.get(params.id)
  if (!state) return error(400, 'unknown list')

  state.store.remove(item)
  updateAll(params.id)
  return new Response(null, { status: 200 })
}
