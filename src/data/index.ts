/* Picks the backend: AWS when amplify_outputs.json exists (written by `npx ampx sandbox`
   or the Amplify Hosting pipeline), otherwise the on-device demo. */
import { Amplify } from 'aws-amplify';
import type { Backend } from './backend';
import { demoBackend } from './demo';

const found = import.meta.glob('../../amplify_outputs.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;
const outputs = Object.values(found)[0];
const forceDemo = import.meta.env.VITE_HIKEE_MODE === 'demo';

export async function loadBackend(): Promise<Backend> {
  if (outputs && !forceDemo && outputs.auth) {
    Amplify.configure(outputs);
    const { awsBackend } = await import('./aws');
    return awsBackend;
  }
  return demoBackend;
}
