export default function Loading() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 text-zinc-100">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
      <p className="text-sm text-zinc-400">Loading...</p>
    </div>
  );
}
