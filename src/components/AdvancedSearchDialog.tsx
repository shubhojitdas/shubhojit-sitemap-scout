import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Settings2 } from "lucide-react";

export type FilterOperator = "contains" | "not_contains" | "equals" | "not_equals" | "regex" | "not_regex";

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string;
}

export interface FilterGroup {
  conditions: FilterCondition[];
  logic: "AND";
}

export interface AdvancedFilter {
  groups: FilterGroup[];
  groupLogic: "OR";
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "Contains",
  not_contains: "Does not contain",
  equals: "Equal to",
  not_equals: "Does not equal",
  regex: "Matches Regex",
  not_regex: "Does not match Regex",
};

interface AdvancedSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: { key: string; label: string }[];
  filter: AdvancedFilter;
  onApply: (filter: AdvancedFilter) => void;
  onReset: () => void;
}

export function createEmptyFilter(defaultField: string): AdvancedFilter {
  return {
    groups: [{ conditions: [{ field: defaultField, operator: "contains", value: "" }], logic: "AND" }],
    groupLogic: "OR",
  };
}

export function isFilterActive(filter: AdvancedFilter): boolean {
  return filter.groups.some((g) => g.conditions.some((c) => c.value.trim() !== ""));
}

export function applyAdvancedFilter<T>(
  data: T[],
  filter: AdvancedFilter,
  getFieldValue: (item: T, field: string) => string
): T[] {
  if (!isFilterActive(filter)) return data;

  return data.filter((item) => {
    // Groups are OR'd together
    return filter.groups.some((group) => {
      // Conditions within a group are AND'd
      return group.conditions.every((cond) => {
        if (!cond.value.trim()) return true; // empty condition = pass
        const fieldVal = getFieldValue(item, cond.field).toLowerCase();
        const searchVal = cond.value.toLowerCase();

        switch (cond.operator) {
          case "contains":
            return fieldVal.includes(searchVal);
          case "not_contains":
            return !fieldVal.includes(searchVal);
          case "equals":
            return fieldVal === searchVal;
          case "not_equals":
            return fieldVal !== searchVal;
          case "regex":
            try { return new RegExp(cond.value, "i").test(getFieldValue(item, cond.field)); }
            catch { return false; }
          case "not_regex":
            try { return !new RegExp(cond.value, "i").test(getFieldValue(item, cond.field)); }
            catch { return true; }
          default:
            return true;
        }
      });
    });
  });
}

export function AdvancedSearchDialog({ open, onOpenChange, fields, filter, onApply, onReset }: AdvancedSearchDialogProps) {
  const [local, setLocal] = useState<AdvancedFilter>(filter);

  const updateCondition = useCallback((gi: number, ci: number, patch: Partial<FilterCondition>) => {
    setLocal((prev) => {
      const groups = prev.groups.map((g, gIdx) => {
        if (gIdx !== gi) return g;
        return {
          ...g,
          conditions: g.conditions.map((c, cIdx) => (cIdx === ci ? { ...c, ...patch } : c)),
        };
      });
      return { ...prev, groups };
    });
  }, []);

  const addCondition = useCallback((gi: number) => {
    setLocal((prev) => {
      const groups = prev.groups.map((g, gIdx) => {
        if (gIdx !== gi) return g;
        return { ...g, conditions: [...g.conditions, { field: fields[0].key, operator: "contains" as FilterOperator, value: "" }] };
      });
      return { ...prev, groups };
    });
  }, [fields]);

  const removeCondition = useCallback((gi: number, ci: number) => {
    setLocal((prev) => {
      const groups = prev.groups.map((g, gIdx) => {
        if (gIdx !== gi) return g;
        const conditions = g.conditions.filter((_, cIdx) => cIdx !== ci);
        return { ...g, conditions: conditions.length === 0 ? [{ field: fields[0].key, operator: "contains" as FilterOperator, value: "" }] : conditions };
      });
      return { ...prev, groups };
    });
  }, [fields]);

  const addGroup = useCallback(() => {
    setLocal((prev) => ({
      ...prev,
      groups: [...prev.groups, { conditions: [{ field: fields[0].key, operator: "contains" as FilterOperator, value: "" }], logic: "AND" }],
    }));
  }, [fields]);

  const removeGroup = useCallback((gi: number) => {
    setLocal((prev) => {
      const groups = prev.groups.filter((_, gIdx) => gIdx !== gi);
      return { ...prev, groups: groups.length === 0 ? [{ conditions: [{ field: fields[0].key, operator: "contains" as FilterOperator, value: "" }], logic: "AND" }] : groups };
    });
  }, [fields]);

  const handleApply = () => {
    onApply(local);
    onOpenChange(false);
  };

  const handleReset = () => {
    const empty = createEmptyFilter(fields[0].key);
    setLocal(empty);
    onReset();
    onOpenChange(false);
  };

  // Sync local state when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setLocal(filter);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Settings2 className="h-4 w-4" />
            Advanced Search
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {local.groups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && (
                <div className="flex items-center justify-center py-2">
                  <span className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded">OR</span>
                </div>
              )}
              <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
                {group.conditions.map((cond, ci) => (
                  <div key={ci}>
                    {ci > 0 && (
                      <div className="flex items-center justify-center py-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">AND</span>
                      </div>
                    )}
                    <div className="flex gap-1.5 items-center">
                      <Select value={cond.field} onValueChange={(v) => updateCondition(gi, ci, { field: v })}>
                        <SelectTrigger className="h-8 w-[140px] text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map((f) => (
                            <SelectItem key={f.key} value={f.key} className="text-[11px]">{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={cond.operator} onValueChange={(v) => updateCondition(gi, ci, { operator: v as FilterOperator })}>
                        <SelectTrigger className="h-8 w-[170px] text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-[11px]">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="Enter search query"
                        value={cond.value}
                        onChange={(e) => updateCondition(gi, ci, { value: e.target.value })}
                        className="h-8 text-[11px] flex-1"
                      />

                      <Button size="sm" variant="ghost" onClick={() => removeCondition(gi, ci)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-1">
                  <Button size="sm" variant="ghost" onClick={() => removeGroup(gi)} className="h-7 text-[10px] text-muted-foreground hover:text-destructive px-2">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove group
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addCondition(gi)} className="h-7 text-[10px] px-2.5 gap-1">
                    <Plus className="h-3 w-3" />
                    AND
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-center">
            <Button size="sm" variant="outline" onClick={addGroup} className="h-8 text-[11px] px-4 gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
              <Plus className="h-3.5 w-3.5" />
              OR
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button size="sm" variant="destructive" onClick={handleReset} className="text-[11px] h-8">
            Reset
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="text-[11px] h-8">
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply} className="text-[11px] h-8">
              OK
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
