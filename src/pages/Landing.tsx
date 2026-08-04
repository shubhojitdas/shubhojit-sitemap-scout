import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Network,
  FileSearch,
  Copy,
  Repeat,
  Download,
  Sparkles,
  ShieldCheck,
  Gauge,
  Globe,
  Layers,
  Clock,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1] as const;

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.05 * i, ease },
  }),
};

function Reveal({
  children,
  i = 0,
  className,
}: {
  children: React.ReactNode;
  i?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={rise}
      custom={i}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
      <span className="h-1 w-1 rounded-full bg-primary" />
      {children}
    </span>
  );
}

const problems = [
  {
    icon: Clock,
    title: "Desktop crawlers are heavy",
    body: "Installs, licences, RAM spikes and a laptop you can't use while it works.",
  },
  {
    icon: Layers,
    title: "Exports live in spreadsheets",
    body: "Titles here, canonicals there, headings in a third tab. Stitching is the job.",
  },
  {
    icon: ShieldCheck,
    title: "Bot walls break audits",
    body: "Cloudflare and WAFs silently drop requests, so your crawl lies to you.",
  },
  {
    icon: Repeat,
    title: "Redirect chains stay invisible",
    body: "JS hops and meta refreshes hide behind a single 200 in most reports.",
  },
];

const bento = [
  {
    span: "lg:col-span-2 lg:row-span-2",
    icon: FileSearch,
    title: "Every on-page signal in one pass",
    body: "Meta titles and descriptions, H1–H3, image alt text, canonicals, hreflang, meta robots, schema markup and social tags — extracted per URL, in one crawl, with nothing to configure twice.",
    bullets: [
      "Sitemap index, single sitemap, spider or pasted URL list",
      "CSV & Excel upload for existing URL sets",
      "Pick exactly which fields to extract",
    ],
  },
  {
    span: "lg:col-span-2",
    icon: Network,
    title: "Internal link graphs you can actually read",
    body: "Force-directed maps of your sitemap and internal links, opened in their own tab and exportable as PNG or interactive HTML.",
  },
  {
    span: "",
    icon: Copy,
    title: "Duplicate detection",
    body: "Exact and 85%+ near-duplicate titles, descriptions and H1s grouped for you.",
  },
  {
    span: "",
    icon: Gauge,
    title: "Link equity scoring",
    body: "Inbound and outbound counts turned into a ranked internal link juice view.",
  },
  {
    span: "lg:col-span-2",
    icon: Repeat,
    title: "Honest redirect chains",
    body: "Full hop-by-hop chains, including JS and meta-refresh redirects, with the exact source line that caused each hop.",
  },
  {
    span: "",
    icon: Sparkles,
    title: "AI insights, your key",
    body: "Bring your own Gemini, Claude, OpenAI or Groq key and ask questions about your crawl.",
  },
  {
    span: "",
    icon: Download,
    title: "Export in seconds",
    body: "Filtered CSV and Excel exports, sitemap XML, hreflang XML and social tag blocks.",
  },
];

const steps = [
  {
    n: "01",
    title: "Point it at your site",
    body: "Drop in a sitemap URL, spider a domain, paste a URL list or upload a CSV. Choose the crawler identity if the site is behind a bot wall.",
  },
  {
    n: "02",
    title: "Pick what to extract",
    body: "Select only the fields this audit needs. Crawl runs in your browser with progress, pause and resume — and survives a refresh.",
  },
  {
    n: "03",
    title: "Audit, visualise, export",
    body: "Filter with AND/OR and regex, jump to issues, open the link graph, ask AI, then export clean deliverables for the client.",
  },
];

const benefits = [
  "Cut audit prep from hours to a single crawl",
  "Catch title, description and H1 cannibalisation before the client does",
  "Prove internal link fixes with a before/after graph",
  "Ship redirect and hreflang recommendations with evidence attached",
  "No seats, no installs, no data leaving your browser session",
  "Free and open — no login required",
];

export default function Landing() {
  return (
    <main className="relative overflow-hidden">
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative">
        <div className="absolute inset-0 grid-bg fade-mask pointer-events-none" />
        <div className="relative container max-w-6xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-[11px] font-medium text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Free &amp; open — no login required
              </div>
            </motion.div>

            <motion.h1
              className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05, ease }}
            >
              <span className="gradient-text">The technical SEO crawler</span>
              <br />
              <span className="iridescent-text">that runs in your browser</span>
            </motion.h1>

            <motion.p
              className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease }}
            >
              SEO Sitemap Scout crawls a sitemap, a domain or a pasted URL list and returns
              every on-page signal you audit against — titles, descriptions, headings, alt
              text, canonicals, hreflang, schema, redirects and internal links — ready to
              filter, visualise and export.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease }}
            >
              <Button asChild size="lg" className="press-tuck rounded-lg font-semibold">
                <Link to="/app">
                  Start crawling free
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="press-tuck rounded-lg font-semibold"
              >
                <a href="#capabilities">See what it extracts</a>
              </Button>
              <span className="text-[11px] text-muted-foreground/70">
                Sitemap · Spider · URL list · CSV upload
              </span>
            </motion.div>
          </div>

          {/* Hero product frame */}
          <motion.div
            className="mt-14 lg:mt-16"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease }}
          >
            <div className="rounded-2xl border border-border glass-strong overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/70">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                <span className="h-2 w-2 rounded-full bg-primary/70" />
                <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  crawl · example.com/sitemap.xml
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border/70">
                {[
                  { k: "URLs crawled", v: "12,480" },
                  { k: "Duplicate titles", v: "37" },
                  { k: "Redirect hops", v: "214" },
                  { k: "Orphan pages", v: "9" },
                ].map((s) => (
                  <div key={s.k} className="p-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {s.k}
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                      {s.v}
                    </p>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-5 pt-1">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full animate-pulse-glow"
                    style={{ width: "72%", background: "var(--gradient-iridescent)" }}
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  extracting meta · headings · canonical · hreflang · schema
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───────────────────────── Problem ───────────────────────── */}
      <section className="relative border-t border-border/70">
        <div className="container max-w-6xl mx-auto px-4 py-20 sm:py-24">
          <Reveal>
            <SectionLabel>The problem</SectionLabel>
            <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-2xl">
              Technical audits stall on tooling, not on insight.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
              Most SEOs already know what to check. The time goes into wrestling crawlers,
              merging exports and re-running jobs that quietly failed.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {problems.map((p, i) => (
              <Reveal key={p.title} i={i}>
                <div className="h-full rounded-xl border border-border bg-card/60 p-5 card-lift">
                  <p.icon className="h-4 w-4 text-primary" />
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{p.title}</h3>
                  <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                    {p.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── Bento capabilities ───────────────────────── */}
      <section id="capabilities" className="relative border-t border-border/70">
        <div className="container max-w-6xl mx-auto px-4 py-20 sm:py-24">
          <Reveal>
            <SectionLabel>Why SEOs use it</SectionLabel>
            <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-2xl">
              One crawl. Every signal you audit against.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[minmax(0,1fr)]">
            {bento.map((b, i) => (
              <Reveal key={b.title} i={i} className={b.span}>
                <div className="h-full rounded-xl border border-border bg-card/60 p-6 card-lift flex flex-col">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                    <b.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground">
                    {b.title}
                  </h3>
                  <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                    {b.body}
                  </p>
                  {b.bullets && (
                    <ul className="mt-5 space-y-2 border-t border-border/70 pt-4">
                      {b.bullets.map((x) => (
                        <li
                          key={x}
                          className="flex items-start gap-2 text-[13px] text-muted-foreground"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          {x}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── How it works ───────────────────────── */}
      <section className="relative border-t border-border/70">
        <div className="container max-w-6xl mx-auto px-4 py-20 sm:py-24">
          <Reveal>
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-2xl">
              From URL to client-ready deliverable in three steps.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} i={i}>
                <div className="h-full rounded-xl border border-border bg-card/60 p-6 card-lift">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-primary">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── Benefits ───────────────────────── */}
      <section className="relative border-t border-border/70">
        <div className="container max-w-6xl mx-auto px-4 py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-start">
            <Reveal>
              <SectionLabel>The payoff</SectionLabel>
              <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                What you get back is time — and a stronger case.
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Scout is built around the way audits are actually delivered: find the issue,
                show the evidence, hand over something the dev team can action.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="press-tuck rounded-lg font-semibold">
                  <Link to="/app">
                    Open the crawler
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Reveal>

            <Reveal i={1}>
              <ul className="grid gap-3">
                {benefits.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 text-[13px] text-foreground"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Final CTA ───────────────────────── */}
      <section className="relative border-t border-border/70">
        <div className="container max-w-6xl mx-auto px-4 py-20 sm:py-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-border glass-strong iridescent-ring p-8 sm:p-12 text-center">
              <div className="absolute inset-0 grid-bg fade-mask pointer-events-none opacity-60" />
              <div className="relative">
                <Globe className="mx-auto h-5 w-5 text-primary" />
                <h2 className="mt-5 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  Paste a sitemap. Get an audit.
                </h2>
                <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  No account, no install, no seat pricing. Bring a URL and start crawling in
                  the next ten seconds.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button asChild size="lg" className="press-tuck rounded-lg font-semibold">
                    <Link to="/app">
                      Start crawling free
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="press-tuck rounded-lg font-semibold"
                  >
                    <Link to="/shubhojit-das">About the maker</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────────── Footer ───────────────────────── */}
      <footer className="border-t border-border/70">
        <div className="container max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-muted-foreground">
            SEO Sitemap Scout — built by{" "}
            <Link to="/shubhojit-das" className="text-foreground font-medium story-link">
              Shubhojit Das
            </Link>
          </p>
          <div className="flex items-center gap-5 text-[12px] text-muted-foreground">
            <Link to="/app" className="hover:text-foreground transition-colors">
              Crawler
            </Link>
            <a href="#capabilities" className="hover:text-foreground transition-colors">
              Capabilities
            </a>
            <a
              href="https://www.linkedin.com/in/shubhojitdas/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
