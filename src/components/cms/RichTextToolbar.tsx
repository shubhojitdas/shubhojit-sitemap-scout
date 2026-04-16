import { Bold, Italic, Underline, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RichTextToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
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

export const RichTextToolbar = ({ textareaRef, value, onChange }: RichTextToolbarProps) => {
  const apply = (before: string, after: string, prompt?: string) => {
    if (!textareaRef.current) return;
    wrapSelection(textareaRef.current, value, onChange, before, after, prompt);
  };

  return (
    <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5 w-fit bg-muted/30">
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => apply("<b>", "</b>")} title="Bold">
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => apply("<i>", "</i>")} title="Italic">
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => apply("<u>", "</u>")} title="Underline">
        <Underline className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => apply("", "", "Enter URL:")} title="Add Link">
        <LinkIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
