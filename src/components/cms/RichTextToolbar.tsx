// Backward-compatible shim: the original RichTextArea has been replaced by
// a full WYSIWYG editor (TipTap). Existing imports keep working unchanged.
import { WysiwygEditor } from "@/components/cms/WysiwygEditor";

interface RichTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  rows?: number;
  className?: string;
  placeholder?: string;
}

export const RichTextArea = ({ value, onChange, onBlur, rows = 3, className, placeholder }: RichTextAreaProps) => (
  <WysiwygEditor
    value={value}
    onChange={onChange}
    onBlur={onBlur}
    className={className}
    placeholder={placeholder}
    minHeight={Math.max(80, rows * 28)}
  />
);

export const RichTextToolbar = RichTextArea;
