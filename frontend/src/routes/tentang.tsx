import { PageHeader } from "@/components/PageHeader";
import { useDocumentTitle } from "@/lib/hooks";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

const EMAIL = "support@dalil.app";

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[65ch] text-[15px] text-[var(--text-2)] leading-[1.75] space-y-3">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-xl font-medium text-[var(--text)] mb-5 tracking-tight">
      {children}
    </h2>
  );
}

function TentangPage() {
  useDocumentTitle("Tentang — Dalil");

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <PageHeader
        title="Tentang Dalil"
        subtitle="Mesin pencari makna untuk Al-Qur'an dan Hadits."
      />

      <section className="mb-12">
        <SectionTitle>Tujuan Aplikasi</SectionTitle>
        <Prose>
          <p>
            Dalil adalah alat bantu pencarian semantik untuk ayat Al-Qur'an dan hadits nabawi. Tidak
            seperti mesin pencari biasa yang hanya cocokkan kata persis, Dalil memahami makna di
            balik kata — sehingga Anda bisa menemukan dalil yang relevan meskipun menggunakan kata
            yang berbeda dari teks aslinya.
          </p>
          <p>
            Sumber data meliputi Al-Qur'an (teks Arab, terjemahan Kemenag, tafsir Kemenag, Quraish
            Shihab, dan Jalalayn) serta kitab-kitab hadits utama (Bukhari, Muslim, Abu Dawud,
            Tirmidzi, Nasa'i, Ibnu Majah, dan lainnya).
          </p>
        </Prose>
      </section>

      <section className="mb-12 pt-10 border-t border-[var(--border)]">
        <SectionTitle>Klarifikasi — Bukan Fatwa</SectionTitle>
        <Prose>
          <p>
            Seluruh konten di aplikasi ini — termasuk terjemahan, tafsir, dan hadits — adalah bahan
            rujukan dan pembelajaran. <strong>Ini bukan fatwa</strong> dan bukan pengganti ulama
            atau lembaga keagamaan resmi.
          </p>
          <p>
            Untuk pengambilan keputusan ibadah, hukum, atau masalah agama yang serius, tanyakan
            langsung kepada ulama atau institusi fatwa yang terpercaya.
          </p>
        </Prose>
      </section>

      <aside className="mb-12 pl-6 border-l-2 border-[var(--accent)] max-w-[65ch]">
        <p className="font-serif italic text-lg text-[var(--text)] leading-relaxed mb-3">
          Permohonan Maaf
        </p>
        <div className="text-[15px] text-[var(--text-2)] leading-[1.75] space-y-3">
          <p>
            Kami menyadari bahwa data yang tersaji mungkin mengandung kekurangan: kesalahan ketik,
            transliterasi yang kurang tepat, penerjemahan yang belum sempurna, atau kesalahan
            metadata ayat dan hadits.
          </p>
          <p>
            Jika menemukan kesalahan, mohon maaf sebesar-besarnya. Kami akan berusaha memperbaikinya
            secepat mungkin.
          </p>
        </div>
      </aside>

      <section className="pt-10 border-t border-[var(--border)]">
        <SectionTitle>Lapor Kesalahan</SectionTitle>
        <p className="max-w-[65ch] text-[15px] text-[var(--text-2)] leading-[1.75] mb-5">
          Bantu kami terus memperbaiki kualitas data. Laporkan kesalahan, saran, atau pertanyaan
          melalui email:
        </p>
        <a
          href={`mailto:${EMAIL}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[var(--accent)] border border-[var(--border-strong)] rounded-btn hover:bg-[var(--accent-soft)] hover:border-[var(--accent)] transition-colors"
        >
          {EMAIL}
        </a>
      </section>
    </div>
  );
}

export const tentangRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tentang",
  component: TentangPage,
});
