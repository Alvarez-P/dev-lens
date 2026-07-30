export default function Home(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-primary-400 sm:text-6xl">
          DevLens
        </h1>
        <p className="mt-4 text-lg text-surface-400">
          Software Intelligence Platform
        </p>
        <div className="mt-8">
          <span className="inline-flex items-center rounded-full border border-surface-700 px-4 py-1.5 text-sm text-surface-400">
            Coming soon
          </span>
        </div>
      </div>
    </main>
  );
}
