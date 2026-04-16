import { useState, useEffect, useCallback, useRef } from "react";
import { Bold, Italic, Underline, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface RichTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  rows?: number;
  className?: string;
  placeholder?: string;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (v: string) => void,
  before: string,
  after: string,
  promptText?: string
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.substring(start, end);

  if (promptText && !selected) {
    const url = window.prompt(promptText);
    if (!url) return;
    const linkText = window.prompt("Link text:", "link") || "link";
    const tag = `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    const newValue = value.substring(0, start) + tag + value.substring(end);
    onChange(newValue);
    return;
  }

  if (promptText && selected) {
    const url = window.prompt(promptText);
    if (!url) return;
    const tag = `<a href="${url}" target="_blank" rel="noopener noreferrer">${selected}</a>`;
    const newValue = value.substring(0, start) + tag + value.substring(end);
    onChange(newValue);
    return;
  }

  const wrapped = `${before}${selected || "text"}${after}`;
  const newValue = value.substring(0, start) + wrapped + value.substring(end);
  onChange(newValue);

  setTimeout(() => {
    textarea.focus();
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + (selected || "text").length;
  }, 0);
}

export const RichTextArea = ({ value, onChange, onBlur, rows = 3, className, placeholder }: RichTextAreaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });

  const apply = useCallback((before: string, after: string, prompt?: string) => {
    if (!textareaRef.current) return;
    wrapSelection(textareaRef.current, value, onChange, before, after, prompt);
  }, [value, onChange]);

  const updateToolbarPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      setShowToolbar(false);
      return;
    }

    setShowToolbar(true);

    // Position toolbar above the textarea, centered
    const rect = textarea.getBoundingClientRect();
    const parentRect = textarea.offsetParent?.getBoundingClientRect() || rect;

    setToolbarPos({
      top: rect.top - parentRect.top - 44,
      left: rect.width / 2 - 80,
    });
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelect = () => {
      // Small delay to ensure selection is finalized
      requestAnimationFrame(updateToolbarPosition);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') {
          e.preventDefault();
          apply("<b>", "</b>");
        } else if (e.key === 'i') {
          e.preventDefault();
          apply("<i>", "</i>");
        } else if (e.key === 'u') {
          e.preventDefault();
          apply("<u>", "</u>");
        } else if (e.key === 'k') {
          e.preventDefault();
          apply("", "", "Enter URL:");
        }
      }
    };

    // Handle shift+arrow or mouse selection
    const handleMouseUp = () => {
      requestAnimationFrame(updateToolbarPosition);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key === 'Shift') {
        requestAnimationFrame(updateToolbarPosition);
      }
    };

    textarea.addEventListener('select', handleSelect);
    textarea.addEventListener('mouseup', handleMouseUp);
    textarea.addEventListener('keyup', handleKeyUp);
    textarea.addEventListener('keydown', handleKeyDown);

    return () => {
      textarea.removeEventListener('select', handleSelect);
      textarea.removeEventListener('mouseup', handleMouseUp);
      textarea.removeEventListener('keyup', handleKeyUp);
      textarea.removeEventListener('keydown', handleKeyDown);
    };
  }, [apply, updateToolbarPosition]);

  // Hide toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        toolbarRef.current && !toolbarRef.current.contains(e.target as Node) &&
        textareaRef.current && !textareaRef.current.contains(e.target as Node)
      ) {
        setShowToolbar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      {showToolbar && (
        <div
          ref={toolbarRef}
          className="absolute z-50 flex items-center gap-0.5 border border-border rounded-lg px-1 py-0.5 bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
        >
          <Button
            type="button" variant="ghost" size="icon"
            className="h-7 w-7 hover:bg-accent"
            onMouseDown={(e) => { e.preventDefault(); apply("<b>", "</b>"); }}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon"
            className="h-7 w-7 hover:bg-accent"
            onMouseDown={(e) => { e.preventDefault(); apply("<i>", "</i>"); }}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon"
            className="h-7 w-7 hover:bg-accent"
            onMouseDown={(e) => { e.preventDefault(); apply("<u>", "</u>"); }}
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button
            type="button" variant="ghost" size="icon"
            className="h-7 w-7 hover:bg-accent"
            onMouseDown={(e) => { e.preventDefault(); apply("", "", "Enter URL:"); }}
            title="Add Link (Ctrl+K)"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          // Delay hiding so toolbar clicks can register
          setTimeout(() => setShowToolbar(false), 200);
          onBlur?.();
        }}
        rows={rows}
        className={cn("text-sm font-mono", className)}
        placeholder={placeholder}
      />
    </div>
  );
};

// Keep backward compat export
export const RichTextToolbar = RichTextArea;
