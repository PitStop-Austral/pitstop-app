import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.webp')) {
      return {
        shortCircuit: true,
        url: new URL(specifier, context.parentURL).href,
      };
    }

    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.webp')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${JSON.stringify(url)};`,
      };
    }

    return nextLoad(url, context);
  },
});
