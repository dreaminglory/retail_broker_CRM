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
            "bg-done-soft text-done hover:bg-done-soft border-done/20",
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
