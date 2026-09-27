import {
  Monitor,
  Globe,
  Cloud,
  Network,
  Shield,
  Server,
  Radio,
  Cpu,
  Zap,
  Database,
  Table,
  HardDrive,
  Layers,
  Activity,
  Search,
  Gauge,
  Clock,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "@/lib/catalog";

const ICONS: Record<ComponentType, LucideIcon> = {
  client: Monitor,
  dns: Globe,
  cdn: Cloud,
  load_balancer: Network,
  api_gateway: Shield,
  service: Server,
  websocket: Radio,
  worker: Cpu,
  cache: Zap,
  sql_db: Database,
  nosql_db: Table,
  object_storage: HardDrive,
  queue: Layers,
  stream: Activity,
  search: Search,
  rate_limiter: Gauge,
  scheduler: Clock,
};

export function ComponentIcon({
  type,
  size = 16,
  color,
}: {
  type: ComponentType;
  size?: number;
  color?: string;
}) {
  const Icon = ICONS[type];
  return <Icon size={size} color={color} strokeWidth={2} />;
}
