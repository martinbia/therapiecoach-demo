/** Node ESM loader: only available in the explicit SDK-simulation test command.
 * Never shipped by Vite and never used in a deployed web/ build.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@elevenlabs/client') {
    const src = 'export const Conversation = {startSession: async options => globalThis.__fakeElevenLabs.startSession(options)};';
    return {url: 'data:text/javascript,' + encodeURIComponent(src), shortCircuit:true};
  }
  return nextResolve(specifier, context);
}
