/** Next.js startup hook: start background jobs in the Node.js server runtime. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startScheduler } = await import('./lib/scheduler');
  startScheduler();
}
