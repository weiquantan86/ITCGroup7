export default function MobileBlockedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Desktop Only</h1>
        <p className="mt-3 text-sm text-neutral-300">
          This site is currently available on desktop browsers only.
          Mobile device is not playable.
        </p>
      </div>
    </main>
  );
}
