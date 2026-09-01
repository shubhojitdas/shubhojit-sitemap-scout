import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Copy,
  Download,
  FileSearch,
  Gauge,
  Globe2,
  Layers3,
  Network,
  Radar,
  Repeat2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1] as const;

const problems = [
  { n: "01", title: "Fragmented evidence", body: "Titles in one export, redirects in another, crawl structure somewhere else. The audit gets lost in assembly." },
  { n: "02", title: "Invisible architecture", body: "A spreadsheet cannot show where authority stalls, which pages are isolated, or how deep important content sits." },
  { n: "03", title: "False confidence", body: "Bot walls, JavaScript hops, and incomplete sitemaps can make a clean report look complete when it is not." },
];

const capabilities = [
  { key: "signals", icon: FileSearch, title: "One pass. Every signal.", body: "Titles, descriptions, H1–H3, image alt text, canonicals, hreflang, robots, schema, and social tags—resolved per URL.", metric: "14+", label: "signal groups" },
  { key: "graph", icon: Network, title: "See the structure", body: "Readable sitemap and internal-link graphs that open in a dedicated view and export to PNG or interactive HTML." },
  { key: "duplicate", icon: Copy, title: "Find content collisions", body: "Group exact matches and 85%+ near-duplicate titles, descriptions, and H1s before they compete." },
  { key: "equity", icon: Gauge, title: "Trace link equity", body: "Rank pages by inbound and outbound relationships to expose weak paths and stranded authority." },
  { key: "redirect", icon: Repeat2, title: "Follow every redirect", body: "Inspect full HTTP, meta-refresh, and JavaScript chains with the source instruction behind every detected hop." },
  { key: "ai", icon: Sparkles, title: "Ask the crawl", body: "Bring your preferred AI provider and interrogate the current audit without mixing histories between websites." },
  { key: "export", icon: Download, title: "Hand off cleanly", body: "Export filtered CSV and Excel data, sitemap and hreflang XML, social tags, maps, and client-ready audit reports." },
];

const workflow = [
  { n: "01", title: "Choose the source", body: "Sitemap, domain spider, pasted URLs, CSV, or Excel." },
  { n: "02", title: "Shape the crawl", body: "Select fields and crawler identity, then pause or resume when needed." },
  { n: "03", title: "Act on evidence", body: "Prioritize issues, visualize paths, ask questions, and export the handoff." },
];

const formats = ["XML sitemap", "Domain spider", "URL list", "CSV", "Excel", "Robots.txt"];

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

function SectionIntro({ number, label, title, copy }: { number: string; label: string; title: string; copy?: string }) {
  return (
    <Reveal className="landing-section-intro">
      <div className="landing-section-index"><span>{number}</span><span>{label}</span></div>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </Reveal>
  );
}

function CrawlMap() {
  const nodes = [
    [50, 14, "root"], [28, 31, "ok"], [72, 31, "ok"], [16, 53, "warn"], [38, 55, "ok"],
    [61, 55, "error"], [83, 53, "ok"], [29, 78, "orphan"], [52, 79, "ok"], [74, 78, "warn"],
  ] as const;
  const lines = [[50,14,28,31],[50,14,72,31],[28,31,16,53],[28,31,38,55],[72,31,61,55],[72,31,83,53],[38,55,29,78],[38,55,52,79],[61,55,74,78]];
  return (
    <div className="crawl-map" aria-label="Example site architecture visualization">
      <div className="crawl-map-orbit crawl-map-orbit-one" />
      <div className="crawl-map-orbit crawl-map-orbit-two" />
      <svg className="crawl-map-lines" viewBox="0 0 100 100" aria-hidden="true">
        {lines.map((line, index) => <line key={index} x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} />)}
      </svg>
      {nodes.map(([x, y, status], index) => (
        <motion.span
          key={`${x}-${y}`}
          className={`crawl-node crawl-node-${status}`}
          style={{ left: `${x}%`, top: `${y}%` }}
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.05, duration: 0.45, ease }}
        >
          {index === 0 && <Globe2 />}
        </motion.span>
      ))}
      <div className="crawl-map-key"><span><i className="is-healthy" /> Healthy</span><span><i className="is-warning" /> Review</span><span><i className="is-critical" /> Critical</span></div>
    </div>
  );
}

function ProductStage() {
  return (
    <motion.div
      className="product-stage"
      initial={{ opacity: 0, y: 32, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.25, ease }}
    >
      <div className="product-stage-bar">
        <div className="product-stage-brand"><span className="stage-mark">S</span><span>example.com</span></div>
        <div className="stage-status"><span /> Crawl complete</div>
      </div>
      <div className="product-stage-body">
        <aside className="stage-sidebar" aria-label="Example report navigation">
          {['Overview','Response codes','SEO issues','Page titles','Internal links'].map((item, i) => <span key={item} className={i === 0 ? "is-active" : ""}>{item}</span>)}
        </aside>
        <div className="stage-dashboard">
          <div className="stage-heading"><div><small>CRAWL OVERVIEW</small><strong>Technical health</strong></div><span>12,480 URLs</span></div>
          <div className="stage-metrics">
            <div><small>HEALTH SCORE</small><strong>91</strong><span className="stage-trend">+4.2%</span></div>
            <div><small>CRITICAL</small><strong>12</strong><span>needs action</span></div>
            <div><small>WARNINGS</small><strong>86</strong><span>review</span></div>
          </div>
          <div className="stage-lower">
            <div className="stage-chart"><span>Issue distribution</span><div className="stage-bars">{[36,62,46,81,57,74,42,68,88,53,71,61].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></div>
            <div className="stage-priorities"><span>Fix these first</span><div><b>01</b><p>Missing page titles<small>18 affected URLs</small></p></div><div><b>02</b><p>Redirect chains<small>14 affected URLs</small></p></div><div><b>03</b><p>Orphan pages<small>9 affected URLs</small></p></div></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="landing-rule landing-rule-left" />
        <div className="landing-rule landing-rule-right" />
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <motion.div className="landing-kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <Radar /> Technical SEO intelligence <span>Browser-native</span>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
              See the architecture.<br/><em>Fix what search sees.</em>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease }}>
              Crawl every technical signal, expose structural blind spots, and turn raw URLs into a prioritized audit your team can act on.
            </motion.p>
            <motion.div className="landing-hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.16, ease }}>
              <Button asChild size="lg" className="landing-primary-cta">
                <Link to="/app"><span>Start crawling free</span><span className="cta-arrow"><ArrowRight /></span></Link>
              </Button>
              <a href="#capabilities" className="landing-text-link">Explore the system <ChevronRight /></a>
            </motion.div>
            <motion.div className="landing-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
              <span><Check /> No login</span><span><Check /> Up to 50k URLs</span><span><Check /> Data stays local</span>
            </motion.div>
          </div>
          <div className="landing-hero-note" aria-hidden="true"><span>01</span><p>CRAWL<br/>UNDERSTAND<br/>IMPROVE</p></div>
        </div>
        <div className="landing-container"><ProductStage /></div>
      </section>

      <section className="landing-section landing-problem-section">
        <div className="landing-container">
          <SectionIntro number="01" label="The blind spot" title="Your crawler should reveal the site—not create more work." copy="Technical SEOs do not need another wall of cells. They need the relationship between an issue, its impact, and the pages that cause it." />
          <div className="problem-editorial-grid">
            {problems.map((problem, i) => (
              <Reveal key={problem.title} delay={i * 0.06} className={`problem-story problem-story-${i + 1}`}>
                <span>{problem.n}</span><div><h3>{problem.title}</h3><p>{problem.body}</p></div>
              </Reveal>
            ))}
            <Reveal className="problem-quote" delay={0.16}><p>“The useful answer is not <em>what failed</em>. It is <em>where, why, and what to fix first</em>.”</p><span>THE SCOUT PRINCIPLE</span></Reveal>
          </div>
        </div>
      </section>

      <section className="landing-section landing-map-section">
        <div className="landing-container landing-map-layout">
          <Reveal className="landing-map-copy">
            <div className="landing-section-index"><span>02</span><span>Architecture, made visible</span></div>
            <h2>Turn a list of URLs into a map of decisions.</h2>
            <p>Spot isolated pages, deep content, redirect paths, and authority gaps in a structure you can inspect, share, and export.</p>
            <div className="map-stat-row"><div><strong>09</strong><span>Orphan pages</span></div><div><strong>3.8</strong><span>Avg. click depth</span></div><div><strong>214</strong><span>Redirect hops</span></div></div>
          </Reveal>
          <Reveal className="landing-map-visual" delay={0.1}><CrawlMap /></Reveal>
        </div>
      </section>

      <section id="capabilities" className="landing-section landing-capabilities">
        <div className="landing-container">
          <SectionIntro number="03" label="The system" title="One crawl becomes a complete working view." copy="Every module is designed to move from discovery to evidence to handoff without rebuilding the audit somewhere else." />
          <div className="capability-masonry">
            {capabilities.map((item, i) => (
              <Reveal key={item.key} delay={(i % 4) * 0.05} className={`capability-card capability-${item.key}`}>
                <div className="capability-top"><span className="capability-icon"><item.icon /></span><span className="capability-count">0{i + 1}</span></div>
                {item.key === "graph" && <div className="mini-network" aria-hidden="true"><i/><i/><i/><i/><i/></div>}
                {item.key === "redirect" && <div className="mini-chain" aria-hidden="true"><span>301</span><b/><span>302</span><b/><span>200</span></div>}
                {item.key === "equity" && <div className="mini-equity" aria-hidden="true">{[74,52,86,39,65].map((w, x)=><i key={x} style={{width:`${w}%`}}/>)}</div>}
                <div className="capability-copy"><h3>{item.title}</h3><p>{item.body}</p>{item.metric && <div className="capability-metric"><strong>{item.metric}</strong><span>{item.label}</span></div>}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-workflow">
        <div className="landing-container">
          <SectionIntro number="04" label="From crawl to action" title="Three movements. No busywork between them." />
          <div className="workflow-line">
            {workflow.map((step, i) => <Reveal className="workflow-step" key={step.n} delay={i * 0.08}><span>{step.n}</span><CircleDot/><h3>{step.title}</h3><p>{step.body}</p></Reveal>)}
          </div>
          <Reveal className="format-strip">
            <span className="format-label">START WITH</span>
            <div>{formats.map((format, i) => <span key={format} style={{ zIndex: formats.length - i }}>{format}</span>)}</div>
            <span className="format-end">One normalized crawl <ArrowRight /></span>
          </Reveal>
        </div>
      </section>

      <section className="landing-section landing-outcome">
        <div className="landing-container landing-outcome-grid">
          <Reveal className="outcome-copy"><div className="landing-section-index"><span>05</span><span>The outcome</span></div><h2>Clarity your team can ship.</h2><p>Prioritized findings, visible site structure, and evidence that survives the handoff from SEO to engineering.</p></Reveal>
          <Reveal className="finding-stack" delay={0.1}>
            <div className="finding-card finding-card-back"><span>EXPORT READY</span></div>
            <div className="finding-card finding-card-mid"><span>14 affected URLs</span></div>
            <div className="finding-card finding-card-front"><div><span className="severity-dot"/>HIGH PRIORITY <small>TECHNICAL</small></div><h3>Redirect chain dilutes authority across key category pages.</h3><p>Replace intermediate destinations with the final canonical URL.</p><span className="finding-action">View evidence <ArrowRight /></span></div>
          </Reveal>
        </div>
      </section>

      <section className="landing-final">
        <div className="landing-container landing-final-inner">
          <Reveal><ShieldCheck/><span className="landing-final-label">FREE · NO LOGIN · NO INSTALL</span><h2>Stop auditing the spreadsheet.<br/><em>Start auditing the site.</em></h2><p>Bring a sitemap, a domain, or a URL list. Your first technical picture is seconds away.</p><Button asChild size="lg" className="landing-primary-cta"><Link to="/app"><span>Open the crawler</span><span className="cta-arrow"><ArrowRight /></span></Link></Button></Reveal>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container"><div><span className="stage-mark">S</span><p><strong>SEO Sitemap Scout</strong><small>Built by <Link to="/shubhojit-das">Shubhojit Das</Link></small></p></div><nav><Link to="/app">Crawler</Link><a href="#capabilities">Capabilities</a><a href="https://www.linkedin.com/in/shubhojitdas/" target="_blank" rel="noopener noreferrer">LinkedIn</a></nav></div>
      </footer>
    </main>
  );
}