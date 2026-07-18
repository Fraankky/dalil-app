import { SearchIcon } from "@/components/icons";

export function SearchBar({ onSubmit }: { onSubmit: (e: React.FormEvent) => void }) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <div className="flex-1 flex items-center border border-[var(--border)] rounded-btn bg-white dark:bg-[var(--surface)] focus-within:border-[var(--accent)] transition-all">
        <span className="pl-3 text-[var(--text-3)]">
          <SearchIcon />
        </span>
        <input
          type="text"
          name="q"
          defaultValue=""
          className="w-full px-3 py-3 bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--text-3)]"
          aria-label="Cari dalil"
          placeholder="Perbaiki pencarian..."
        />
      </div>
      <button
        type="submit"
        className="px-5 py-3 bg-[var(--accent)] text-white rounded-btn font-medium hover:bg-[var(--accent-strong)] transition-colors"
      >
        Cari
      </button>
    </form>
  );
}
