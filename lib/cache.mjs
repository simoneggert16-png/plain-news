// A cache that outlives a single lambda.
//
// Next.js keeps the value of unstable_cache() in the Vercel data cache, so a
// cold start does not have to ask the database again. Every read of the
// content store goes through here: when the mirror is busy, a database round
// trip can take seconds, and a page render must not wait for it.
const wrappers = new Map();

export async function sharedFetch(key, fn, { revalidate = 300 } = {}) {
  // At build time the bundled snapshot is enough; a cache would only hide it.
  if (process.env.NEXT_PHASE === 'phase-production-build') return fn();
  try {
    const { unstable_cache } = await import('next/cache');
    let wrapped = wrappers.get(key);
    if (!wrapped) {
      wrapped = unstable_cache(fn, ['plain-shared', key], { revalidate, tags: ['content'] });
      wrappers.set(key, wrapped);
    }
    return await wrapped();
  } catch {
    // A cache that refuses the payload must never take the page down.
    return fn();
  }
}

/** Rejects when the promise takes longer than ms. */
export function withDeadline(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
