/** Next.js startup hook: start background jobs in the Node.js server runtime. */
export async function register() {
  // Keep the import inside this exact check so webpack drops it from the edge bundle.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();
  }
}
