import { env } from '$env/dynamic/private';
import { Axiom } from '@axiomhq/js';

let axiom: Axiom | null = null;

export function getAxiomClient() {
	if (!axiom && env.AXIOM_TOKEN) {
		axiom = new Axiom({ token: env.AXIOM_TOKEN });
	}
	return axiom;
}

export function getAxiomDataset() {
	return env.AXIOM_DATASET;
}
