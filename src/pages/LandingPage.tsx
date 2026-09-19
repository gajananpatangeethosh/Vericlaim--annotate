import { Link } from 'react-router'
import { useStore } from '../store/useStore'

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Claim Verification',
    desc: 'Every factual claim in your brochure is checked, not guessed. Verdicts come straight from the research paper — never the model’s own memory.',
  },
  {
    icon: '🎨',
    title: 'AI Brochure Builder',
    desc: 'Generate a professionally branded medical brochure from a text prompt. AI handles branding, layout, and flags all factual claims for verification.',
  },
  {
    icon: '📚',
    title: 'Evidence in the Research Paper',
    desc: 'See the exact quote backing each claim, highlighted at its real position in the source paper with one-click navigation.',
  },
  {
    icon: '🎯',
    title: 'Exact Text Positioning',
    desc: 'Highlights snap to the true text coordinates in the PDF, line by line, with no manual placement needed.',
  },
  {
    icon: '🗞️',
    title: 'Annotated PDF & Paper Export',
    desc: 'Download a tagged brochure or evidence-highlighted research paper with native sticky-note popups.',
  },
  {
    icon: '💬',
    title: 'Chat “Verify Claim”',
    desc: 'Select any sentence and get a Supported / Partial / Unsupported verdict with a verbatim evidence quote.',
  },
  {
    icon: '📜',
    title: 'Audit Trail History',
    desc: 'Every upload, validation run, export, and claim verdict is logged — your complete document audit log.',
  },
]

const STEPS = [
  { n: '1', title: 'Upload', desc: 'Add your brochure and the research paper it should be checked against.' },
  { n: '2', title: 'Verify', desc: 'Run AI verification or select a claim to cross-check it against the paper.' },
  { n: '3', title: 'Export & Audit', desc: 'Export annotated documents and review the full audit trail any time.' },
]

export default function LandingPage() {
  const exportHistory = useStore((s) => s.exportHistory)
  const auditLog = useStore((s) => s.auditLog)

  const totalClaims = exportHistory.reduce((acc, r) => acc + r.annotationCount, 0)
  const verified = exportHistory.reduce((acc, r) => acc + r.verdicts.verified, 0)
  const partial = exportHistory.reduce((acc, r) => acc + r.verdicts.partial, 0)
  const unsupported = exportHistory.reduce((acc, r) => acc + r.verdicts.unsupported, 0)
  const hasStats = exportHistory.length > 0

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              V
            </div>
            <span className="text-sm font-semibold">VeriClaim</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/history"
              className="btn-ghost text-xs"
            >
              📜 Audit History
            </Link>
            <Link to="/app" className="btn-primary text-xs">
              Open the App →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          <span>✨</span> Upload a brochure + research paper, get verified claims
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Verify every claim in your brochure{' '}
          <span className="bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent">
            against the real research.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
          VeriClaim cross-checks each factual claim in your document against the reference
          paper and tells you whether it is <strong>Supported</strong>,{' '}
          <strong>Partial</strong>, or <strong>Unsupported</strong> — with the exact
          evidence highlighted at its source.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/app" className="btn-primary px-5 py-2.5 text-sm">
            🚀 Start Verifying
          </Link>
          <Link to="/brochure" className="btn-ghost px-5 py-2.5 text-sm">
            🎨 Build a Medical Brochure
          </Link>
          <Link to="/history" className="btn-ghost px-5 py-2.5 text-sm">
            📜 View Audit History
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto mb-16 max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-4">
          <Stat label="Documents exported" value={exportHistory.length.toString()} />
          <Stat label="Claims verified" value={totalClaims.toString()} />
          <Stat label="Evidence located" value={verified.toString()} />
          <Stat label="Audit events" value={auditLog.length.toString()} fallback={!hasStats} />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mb-16 max-w-6xl px-4">
        <h2 className="mb-8 text-center text-2xl font-bold">How VeriClaim works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card card-hover p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                {s.n}
              </div>
              <h3 className="mb-1 font-semibold">{s.title}</h3>
              <p className="text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto mb-20 max-w-6xl px-4">
        <h2 className="mb-8 text-center text-2xl font-bold">Everything built in</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card card-hover p-6">
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="mb-1.5 font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-200 bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold">Ready to check your document?</h2>
          <p className="mt-3 text-gray-600">
            Open the app and upload a brochure and its research paper to get started.
          </p>
          <Link to="/app" className="btn-primary mt-6 px-6 py-3 text-sm">
            Open the App →
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-400">
        VeriClaim — document claim verification against research sources
      </footer>
    </div>
  )
}

function Stat({ label, value, fallback }: { label: string; value: string; fallback?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-brand-700">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{label}</div>
      {fallback && (
        <div className="mt-0.5 text-[10px] text-gray-400">Export a document to populate</div>
      )}
    </div>
  )
}