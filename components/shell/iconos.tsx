import {
  Activity,
  Banknote,
  Building,
  Building2,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  FileSignature,
  FlaskConical,
  HardHat,
  Hotel,
  House,
  Inbox,
  Landmark,
  Mail,
  Megaphone,
  Package,
  Receipt,
  Route,
  Ruler,
  Sparkles,
  Square,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** Iconos del registro de módulos por nombre (el registro es dato; aquí se vuelve componente). */
const ICONOS: Record<string, LucideIcon> = {
  activity: Activity,
  banknote: Banknote,
  building: Building,
  "building-2": Building2,
  "calendar-days": CalendarDays,
  "check-check": CheckCheck,
  "clipboard-list": ClipboardList,
  "file-signature": FileSignature,
  "flask-conical": FlaskConical,
  "hard-hat": HardHat,
  hotel: Hotel,
  house: House,
  inbox: Inbox,
  landmark: Landmark,
  mail: Mail,
  megaphone: Megaphone,
  package: Package,
  receipt: Receipt,
  route: Route,
  ruler: Ruler,
  sparkles: Sparkles,
  users: Users,
  wallet: Wallet,
};

export function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const C = ICONOS[nombre] ?? Square;
  return <C className={className} aria-hidden />;
}
