import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import names from 'docker-names'
import { stateMap, createState } from '$lib/state.server'

export const POST = async ({ request }) => {
  // Something to fix grievers?d
  let id, i;

  let { name } = await request.json()

  if (name && name.length) {
    id = name.replace(/[^a-zA-Z0-9.+_]+/g, '-').replace(/^-/, '').replace(/-$/, '')
    if (stateMap.has(id)) {
      console.error("Invalid name")
      return error(400,  'Invalid name')
    }
  } else {
    for (id=names.getRandomName(), i=0; stateMap.has(id); i++, id=names.getRandomName()) {
      if (i > 20) {
        console.error("Too many tries generating id")
        return error(500, "Too many tries generating id");
      }
    }
  }
  
  console.log('Created list', id)
  createState(id, name)

  return json({
    id
  }, {
    status: 201,
  });
};