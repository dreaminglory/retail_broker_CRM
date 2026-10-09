import { Badge } from "@/components/ui/badge";
import { type Stage } from "@/domain/stages/types";
import { cn } from "@/lib/utils";
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";

interface StageBadgeProps {
  stage: Stage;
  className?: string;
}

export function StageBadge({ stage, className }: StageBadgeProps) {
  const getStageName = useStageTranslation();
  if (!stage.is_terminal || !stage.terminal_type) {
    return (
      <Badge variant="outline" className={cn("bg-transparent", className)}>
        {getStageName(stage.name)}
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
          {getStageName(stage.name)}
        </Badge>
      );
    case "lost":
      return (
        <Badge variant="destructive" className={className}>
          {getStageName(stage.name)}
        </Badge>
      );
    case "nurture":
      return (
        <Badge variant="secondary" className={className}>
          {getStageName(stage.name)}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          {getStageName(stage.name)}
        </Badge>
      );
  }
}
