import { useState } from "react";
import { Search, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

interface CrawlFormProps {
  onCrawl: (url: string) => void;
  isLoading: boolean;
  onReset: () => void;
}

export function CrawlForm({ onCrawl, isLoading, onReset }: CrawlFormProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onCrawl(url.trim());
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/sitemap.xml"
            className="pl-11 h-13 text-base bg-card border-border/60 focus-visible:ring-primary/40 font-mono text-sm"
            disabled={isLoading}
          />
        </div>
        {isLoading ? (
          <Button type="button" variant="outline" onClick={() => { onReset(); setUrl(""); }} className="h-13 px-6">
            Cancel
          </Button>
        ) : (
          <Button type="submit" className="h-13 px-8 glow font-semibold gap-2">
            <Search className="h-4 w-4" />
            Crawl
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2.5 text-center">
        Enter a sitemap.xml URL to extract all URLs with their meta titles and descriptions
      </p>
    </motion.form>
  );
}
