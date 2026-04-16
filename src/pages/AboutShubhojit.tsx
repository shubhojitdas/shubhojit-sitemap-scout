import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Linkedin, ArrowLeft, ExternalLink, Briefcase, Award, Code, Search, Globe,
  BarChart3, FileCode, Wrench, Heart, Zap, Layout, Database, Shield, Cpu,
  Terminal, Link as LinkIconLucide, Settings, Monitor, Smartphone, Server, Cloud,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  useAboutProfile, useAboutSkills, useAboutExperience, useAboutFeaturedPosts,
} from "@/hooks/use-about-cms";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const iconMap: Record<string, any> = {
  Code, Search, Globe, BarChart3, FileCode, Wrench, Zap, Layout,
  Database, Shield, Cpu, Terminal, Link: LinkIconLucide, Settings,
  Monitor, Smartphone, Server, Cloud, Heart,
};

const getIcon = (name: string) => iconMap[name] || Code;

const AboutShubhojit = () => {
  const { data: profile, isLoading: profileLoading } = useAboutProfile();
  const { data: skills = [] } = useAboutSkills();
  const { data: experiences = [] } = useAboutExperience();
  const { data: featuredPosts = [] } = useAboutFeaturedPosts();
  const [imageLoaded, setImageLoaded] = useState(false);

  const photoUrl = profile?.image_url;
  const name = profile?.name || "Shubhojit Das";
  const title = profile?.title || "Technical SEO Specialist · Front-End Enthusiast";
  const paragraphs = profile?.about_paragraphs || [];
  const linkedinUrl = profile?.linkedin_url || "https://www.linkedin.com/in/shubhojitdas/";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 grid-bg fade-mask pointer-events-none" />

      <div className="relative z-10">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Tool
              </Button>
            </Link>
            <div className="flex items-center gap-0.5">
              <ThemeToggle />
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                  <Linkedin className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-16">
          {/* Hero */}
          <motion.section initial="hidden" animate="visible" className="flex flex-col md:flex-row gap-8 items-start">
            <motion.div custom={0} variants={fadeUp} className="shrink-0">
              <div className="w-44 h-44 rounded-2xl overflow-hidden border border-border card-elevated">
                {profileLoading || !photoUrl ? (
                  <Skeleton className="w-full h-full" />
                ) : (
                  <>
                    {!imageLoaded && <Skeleton className="w-full h-full absolute inset-0" />}
                    <img
                      src={photoUrl}
                      alt={`${name} - SEO Specialist`}
                      width={176}
                      height={176}
                      className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                      onLoad={() => setImageLoaded(true)}
                    />
                  </>
                )}
              </div>
            </motion.div>
            <div className="space-y-4 flex-1">
              <motion.div custom={1} variants={fadeUp}>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight gradient-text">
                  {name}
                </h1>
                <p className="text-muted-foreground text-sm mt-1 font-medium">{title}</p>
              </motion.div>
              <motion.div custom={2} variants={fadeUp} className="text-sm leading-relaxed text-muted-foreground space-y-3">
                {paragraphs.map((p, i) => (
                  <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
                ))}
              </motion.div>
              <motion.div custom={3} variants={fadeUp}>
                <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Linkedin className="h-3.5 w-3.5" />
                    Connect on LinkedIn
                    <ExternalLink className="h-3 w-3 ml-0.5 text-muted-foreground" />
                  </Button>
                </a>
              </motion.div>
            </div>
          </motion.section>

          {/* Skills */}
          {skills.length > 0 && (
            <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="space-y-5">
              <motion.h2 custom={0} variants={fadeUp} className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Code className="h-4 w-4 text-muted-foreground" />
                Skills & Expertise
              </motion.h2>
              <motion.div custom={1} variants={fadeUp} className="flex flex-wrap gap-2">
                {skills.map((skill) => {
                  const Icon = getIcon(skill.icon_name);
                  return (
                    <Badge key={skill.id} variant="secondary" className="gap-1.5 py-1.5 px-3 text-xs font-medium">
                      <Icon className="h-3 w-3" />
                      {skill.name}
                    </Badge>
                  );
                })}
              </motion.div>
            </motion.section>
          )}

          {/* Experience */}
          {experiences.length > 0 && (
            <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="space-y-5">
              <motion.h2 custom={0} variants={fadeUp} className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                Work Experience
              </motion.h2>
              <div className="space-y-4">
                {experiences.map((exp, i) => (
                  <motion.div key={exp.id} custom={i + 1} variants={fadeUp}>
                    <Card className="card-elevated border-border">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <h3 className="font-semibold text-base">{exp.role}</h3>
                            <p className="text-sm text-muted-foreground">{exp.company}</p>
                          </div>
                          <Badge variant="outline" className="text-xs px-3 py-1 shrink-0">{exp.period}</Badge>
                        </div>
                        {exp.image_url && (
                          <img src={exp.image_url} alt={`${exp.company} featured`} className="w-full max-h-48 rounded-lg object-cover border border-border" />
                        )}
                        {exp.description && <p className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: exp.description }} />}
                        {exp.achievements && exp.achievements.length > 0 && (
                          <ul className="space-y-1.5">
                            {exp.achievements.map((a) => (
                              <li key={a.id} className="text-sm text-muted-foreground flex items-start gap-2">
                                <Award className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                                <span dangerouslySetInnerHTML={{ __html: a.text }} />
                              </li>
                            ))}
                          </ul>
                        )}
                        {exp.featured_post_url && (
                          <a href={exp.featured_post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mt-1">
                            <ExternalLink className="h-3 w-3" />
                            {exp.featured_post_title || "Featured post"}
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Featured Posts */}
          {featuredPosts.length > 0 && (
            <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="space-y-5">
              <motion.h2 custom={0} variants={fadeUp} className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Heart className="h-4 w-4 text-muted-foreground" />
                Featured Posts
              </motion.h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredPosts.map((post, i) => (
                  <motion.div key={post.id} custom={i + 1} variants={fadeUp}>
                    <a href={post.url} target="_blank" rel="noopener noreferrer" className="block h-full">
                       <Card className="card-elevated border-border h-full hover:border-muted-foreground/30 transition-colors overflow-hidden flex flex-col">
                        {post.image_url && (
                          <img src={post.image_url} alt={post.title} className="w-full h-32 object-cover" />
                        )}
                        <CardContent className="p-5 flex flex-col flex-1">
                          <h3 className="font-semibold text-sm leading-snug">{post.title}</h3>
                          {post.description && <p className="text-xs text-muted-foreground leading-relaxed mt-2">{post.description}</p>}
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-auto pt-3">
                            <ExternalLink className="h-2.5 w-2.5" />
                            View on {post.source_label || "Web"}
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Recent Activity CTA */}
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="space-y-4">
            <motion.div custom={0} variants={fadeUp}>
              <Card className="card-elevated border-border">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="font-semibold text-sm">Recent LinkedIn Activity</h3>
                    <p className="text-xs text-muted-foreground">Check out my latest thoughts on SEO, web development, and more.</p>
                  </div>
                  <a href={`${linkedinUrl}recent-activity/all/`} target="_blank" rel="noopener noreferrer">
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

        <footer className="border-t border-border py-6">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} {name} · Built with <Heart className="inline h-3 w-3 mx-0.5" /> and curiosity
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AboutShubhojit;
