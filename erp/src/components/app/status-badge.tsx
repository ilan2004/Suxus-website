import { Badge } from "@/components/ui/badge";

const MAP: Record<string, "secondary" | "info" | "violet" | "gold" | "success" | "destructive" | "warning"> = {
  Booked: "secondary",
  Cut: "info",
  Stitching: "violet",
  Ready: "gold",
  Delivered: "success",
  Cancelled: "destructive",
  Express: "warning",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={MAP[status] ?? "outline"}>{status}</Badge>;
}
