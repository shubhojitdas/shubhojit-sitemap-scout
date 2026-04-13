import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Linkedin,
  ArrowLeft,
  ExternalLink,
  Briefcase,
  Award,
  Code,
  Search,
  Globe,
  BarChart3,
  FileCode,
  Wrench,
  Heart,
} from "lucide-react";
import { Link } from "react-router-dom";
import profilePhoto from "@/assets/shubhojit-placeholder.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const skills = [
  { name: "Technical SEO", icon: Wrench },
  { name: "On-Page SEO", icon: FileCode },
  { name: "Content Strategy", icon: BarChart3 },
  { name: "Google Search Console", icon: Search },
  { name: "Core Web Vitals", icon: Globe },
  { name: "Schema Markup", icon: Code },
  { name: "Site Architecture", icon: Globe },
  { name: "Crawl Optimization", icon: Search },
  { name: "JavaScript SEO", icon: FileCode },
  { name: "Log File Analysis", icon: BarChart3 },
  { name: "Page Speed Optimization", icon: Wrench },
  { name: "Front-End Development", icon: Code },
];

const experience = [
  {
    role: "SEO Specialist",
    company: "Jeewangarg.com",
    period: "Current",
    achievements: [
      "Leading technical SEO audits for enterprise-level websites",
      "Implementing structured data strategies improving rich snippet appearances",
      "Conducting white hat SEO experiments to discover ranking opportunities",
    ],
  },
  {
    role: "SEO Executive",
    company: "Previous Organizations",
    period: "2018 – Prior",
    achievements: [
      "Started journey building and ranking Blogger & Wix websites",
      "Developed expertise in GSC query analysis and content optimization",
      "Built a strong foundation in web design and development",
    ],
  },
];

const featuredPosts = [
  {
    title: "Why Technical SEO Matters More Than Link Building",
    description:
      "A deep dive into how technical optimizations drive sustainable organic growth compared to vanity link metrics.",
    url: "https://www.linkedin.com/in/shubhojitdas/recent-activity/all/",
  },
  {
    title: "JavaScript SEO: What Most SEOs Miss",
    description:
      "Exploring how JS rendering affects internal linking, content visibility, and crawl budget.",
    url: "https://www.linkedin.com/in/shubhojitdas/recent-activity/all/",
  },
  {
    title: "Building SEO Tools with Vibe Coding",
    description:
      "How I combined my passion for web development and SEO to build practical auditing tools.",
    url: "https://www.linkedin.com/in/shubhojitdas/recent-activity/all/",
  },
];

const AboutShubhojit = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Grid background */}
      <div className="fixed inset-0 grid-bg fade-mask pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Tool
              </Button>
            </Link>
            <div className="flex items-center gap-0.5">
              <ThemeToggle />
              <a
                href="https://www.linkedin.com/in/shubhojitdas/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-16">
          {/* Hero / About Me */}
          <motion.section
            initial="hidden"
            animate="visible"
            className="flex flex-col md:flex-row gap-8 items-start"
          >
            <motion.div
              custom={0}
              variants={fadeUp}
              className="shrink-0"
            >
              <div className="w-36 h-36 rounded-2xl overflow-hidden border border-border card-elevated">
                <img
                  src={profilePhoto}
                  alt="Shubhojit Das - SEO Specialist"
                  width={144}
                  height={144}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            <div className="space-y-4 flex-1">
              <motion.div custom={1} variants={fadeUp}>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight gradient-text">
                  Shubhojit Das
                </h1>
                <p className="text-muted-foreground text-sm mt-1 font-medium">
                  Technical SEO Specialist · Front-End Enthusiast
                </p>
              </motion.div>

              <motion.div
                custom={2}
                variants={fadeUp}
                className="text-sm leading-relaxed text-muted-foreground space-y-3"
              >
                <p>
                  I'm an SEO who is focused on optimizing a website from its technical
                  aspects which can actually contribute in the website organic growth
                  (rather than vanity link building and updating Title and Meta
                  Description in the name of SEO).
                </p>
                <p>
                  I do various kind of White Hat SEO experiments that can increase the
                  chance of ranking higher on the SERPs. I also focus on analysing user
                  queries from Google Search Console and craft content accordingly. I
                  believe to supply users demand from business website.
                </p>
                <p>
                  I also have some hobbies like creating something by doing a bit of
                  Vibe Coding, learning to code (JS) as I have a huuugeee interest in
                  Web Designing and Development as my journey was rooted deep with the
                  fascination of creating Blogger and Wix Websites to ranking them from
                  2018. Now I am doing it as my fulltime profession of being an SEO.
                </p>
                <p>
                  Apart from that you are already reading my portfolio. It became clear
                  to you already that I also have interest into Front End Web
                  Development as well, and that explains my obsession with Technical
                  SEO and fulfill my childhood dream of creating websites with full
                  flexibility.
                </p>
              </motion.div>

              <motion.div custom={3} variants={fadeUp}>
                <a
                  href="https://www.linkedin.com/in/shubhojitdas/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                  >
                    <Linkedin className="h-3.5 w-3.5" />
                    Connect on LinkedIn
                    <ExternalLink className="h-3 w-3 ml-0.5 text-muted-foreground" />
                  </Button>
                </a>
              </motion.div>
            </div>
          </motion.section>

          {/* Skills */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="space-y-5"
          >
            <motion.h2
              custom={0}
              variants={fadeUp}
              className="text-lg font-semibold tracking-tight flex items-center gap-2"
            >
              <Code className="h-4 w-4 text-muted-foreground" />
              Skills & Expertise
            </motion.h2>
            <motion.div
              custom={1}
              variants={fadeUp}
              className="flex flex-wrap gap-2"
            >
              {skills.map((skill) => (
                <Badge
                  key={skill.name}
                  variant="secondary"
                  className="gap-1.5 py-1.5 px-3 text-xs font-medium"
                >
                  <skill.icon className="h-3 w-3" />
                  {skill.name}
                </Badge>
              ))}
            </motion.div>
          </motion.section>

          {/* Work Experience */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="space-y-5"
          >
            <motion.h2
              custom={0}
              variants={fadeUp}
              className="text-lg font-semibold tracking-tight flex items-center gap-2"
            >
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Work Experience
            </motion.h2>
            <div className="space-y-4">
              {experience.map((exp, i) => (
                <motion.div key={exp.company} custom={i + 1} variants={fadeUp}>
                  <Card className="card-elevated border-border">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-sm">{exp.role}</h3>
                          <p className="text-xs text-muted-foreground">
                            {exp.company}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0"
                        >
                          {exp.period}
                        </Badge>
                      </div>
                      <ul className="space-y-1.5">
                        {exp.achievements.map((a, j) => (
                          <li
                            key={j}
                            className="text-xs text-muted-foreground flex items-start gap-2"
                          >
                            <Award className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/60" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Featured LinkedIn Posts */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="space-y-5"
          >
            <motion.h2
              custom={0}
              variants={fadeUp}
              className="text-lg font-semibold tracking-tight flex items-center gap-2"
            >
              <Heart className="h-4 w-4 text-muted-foreground" />
              Featured Posts
            </motion.h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredPosts.map((post, i) => (
                <motion.div key={post.title} custom={i + 1} variants={fadeUp}>
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-full"
                  >
                    <Card className="card-elevated border-border h-full hover:border-muted-foreground/30 transition-colors">
                      <CardContent className="p-5 space-y-2">
                        <h3 className="font-semibold text-sm leading-snug">
                          {post.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {post.description}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 pt-1">
                          <Linkedin className="h-3 w-3" />
                          View on LinkedIn
                          <ExternalLink className="h-2.5 w-2.5" />
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Recent Activity CTA */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="space-y-4"
          >
            <motion.div custom={0} variants={fadeUp}>
              <Card className="card-elevated border-border">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="font-semibold text-sm">Recent LinkedIn Activity</h3>
                    <p className="text-xs text-muted-foreground">
                      Check out my latest thoughts on SEO, web development, and more.
                    </p>
                  </div>
                  <a
                    href="https://www.linkedin.com/in/shubhojitdas/recent-activity/all/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0">
                      <Linkedin className="h-3.5 w-3.5" />
                      View All Posts
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </motion.div>
          </motion.section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-6">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Shubhojit Das · Built with{" "}
              <Heart className="inline h-3 w-3 mx-0.5" /> and curiosity
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AboutShubhojit;
