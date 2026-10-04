import { Badge } from "@/components/ui/badge";
import { type Stage } from "@/domain/stages/types";
import { cn } from "@/lib/utils";

interface StageBadgeProps {
  stage: Stage;
  className?: string;
}

export function StageBadge({ stage, className }: StageBadgeProps) {
  if (!stage.is_terminal || !stage.terminal_type) {
    return (
      <Badge variant="outline" className={cn("bg-transparent", className)}>
        {stage.name}
      </Badge>
    );
  }

  switch (stage.terminal_type) {
    case "won":
      return (
        <Badge
          className={cn(
            "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400 border-emerald-500/20",
            className
          )}
          variant="outline"
        >
          {stage.name}
        </Badge>
      );
    case "lost":
      return (
        <Badge variant="destructive" className={className}>
          {stage.name}
        </Badge>
      );
    case "nurture":
      return (
        <Badge variant="secondary" className={className}>
          {stage.name}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          {stage.name}
        </Badge>
      );
  }
}
