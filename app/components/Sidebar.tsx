"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { FiGrid, FiHome, FiLayers, FiSettings, FiUsers } from "react-icons/fi";

const menuLogoEnv = process.env.NEXT_PUBLIC_MENU_LOGO || "";

type Role = "TC_ADMIN" | "CLIENT_ADMIN" | "QA" | "VIEWER";

const navigation: {
  label: string;
  icon: typeof FiHome;
  href: string;
  roles?: Role[];
}[] = [
  { label: "Home", icon: FiHome, href: "/" },
  { label: "Testing Metric", icon: FiGrid, href: "/dashboard" },
  { label: "Clientes", icon: FiUsers, href: "/admin/clients", roles: ["TC_ADMIN"] },
  { label: "Aplicacoes", icon: FiLayers, href: "/applications" },
  { label: "Releases", icon: FiLayers, href: "/release" },
  { label: "Gestao de Releases", icon: FiSettings, href: "/admin/releases" },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const logoSrc = useMemo(() => (menuLogoEnv ? menuLogoEnv : "/images/tc.png"), []);
  // TODO: substituir por usuario real / contexto de auth
  const role: Role = "TC_ADMIN";
  const pathname = usePathname() || "";

  const renderNavLinks = (isMobile = false) =>
    navigation
      .filter((item) => !item.roles || item.roles.includes(role))
      .map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`group/link relative flex items-center h-11 w-full rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden min-w-0 ${
              isMobile
                ? "px-3 justify-start gap-3"
                : "lg:px-0 lg:justify-center lg:gap-0 lg:group-hover/sidebar:px-3 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3"
            } ${
              isActive
                ? "bg-white/10 ring-1 ring-[#4e8df5]/50 shadow-[0_12px_30px_rgba(78,141,245,0.35)] text-white"
                : "text-white/80 hover:bg-white/7 hover:text-white"
            }`}
            onClick={isMobile && onClose ? onClose : undefined}
          >
            <span
              aria-hidden
              className={`absolute left-1 top-2 bottom-2 w-[3px] rounded-full bg-[#4e8df5] transition-all ${
                isActive ? "opacity-100" : "opacity-0 group-hover/link:opacity-60"
              }`}
            />
            <div
              className={`flex items-center justify-center w-11 h-11 rounded-[14px] border transition-all duration-200 shrink-0 backdrop-blur-sm ${
                isActive
                  ? "border-[#4e8df5]/60 bg-[#4e8df5]/12 text-[#4e8df5] shadow-[0_12px_28px_rgba(78,141,245,0.25)]"
                  : "border-white/12 bg-white/6 text-[#4e8df5] group-hover/link:border-[#4e8df5]/35 group-hover/link:bg-white/10"
              }`}
            >
              <item.icon size={20} />
            </div>
            <span className="pl-3 hidden lg:inline whitespace-normal text-left leading-snug flex-1">
              {item.label}
            </span>
          </Link>
        );
      });

  const DesktopNav = (
    <aside
      className="group/sidebar hidden lg:flex fixed left-0 top-0 z-40 h-screen w-[84px] hover:w-[260px] overflow-hidden border-r border-white/10 text-white flex-col bg-[linear-gradient(180deg,#03123b_0%,#051a52_60%,#03123b_100%)] backdrop-blur-2xl shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition-[width] duration-200 ease-out"
    >
      <div className="flex items-center px-2 py-3 border-b border-white/5 relative">
        <Link
          href="/"
          className="flex items-center gap-0 lg:group-hover/sidebar:gap-3 transition-all duration-200 justify-center lg:group-hover/sidebar:justify-start w-full"
        >
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur">
            <span
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(78,141,245,0.15),transparent_55%)]"
              aria-hidden
            />
            <Image
              src={logoSrc}
              alt="Logo"
              width={48}
              height={48}
              className="object-cover pointer-events-none select-none"
            />
          </div>
          <div className="flex flex-col leading-tight opacity-0 lg:group-hover/sidebar:opacity-100 transition duration-200 whitespace-nowrap">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/55">Painel QA</span>
            <span className="text-base font-semibold tracking-wide text-white">Testing Metric</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 px-3 py-6 space-y-6">
          <div className="flex items-center justify-center opacity-100 lg:opacity-100 lg:group-hover/sidebar:opacity-0 transition-all duration-200 -mt-1">
            <Link
              href="/"
              className="relative flex items-center justify-center w-11 h-11 rounded-2xl border border-white/12 bg-white/5 shadow-[0_10px_22px_rgba(0,0,0,0.25)] hover:border-[#4e8df5]/50 hover:shadow-[0_12px_26px_rgba(78,141,245,0.22)] transition-all duration-200"
            >
              <Image
                src={logoSrc}
                alt="Logo TC"
                width={32}
                height={32}
                className="object-contain pointer-events-none select-none"
              />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center px-1">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55 opacity-0 lg:group-hover/sidebar:opacity-100 transition duration-150">
                Navegacao
              </p>
              <span className="h-px flex-1 ml-3 bg-white/15" aria-hidden />
            </div>
            <div className="space-y-3">{renderNavLinks()}</div>
          </div>
        </div>
      </nav>

    </aside>
  );

  const MobileNav =
    mobileOpen &&
    onClose && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose}>
        <aside
          className="flex h-full w-72 bg-gradient-to-b from-[#0b1021]/95 via-[#0f1830]/92 to-[#0b1021]/95 text-white flex-col border-r border-white/10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 p-4 border-b border-white/10 relative">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <Image
                src={logoSrc}
                alt="Logo"
                width={48}
                height={48}
                className="object-cover pointer-events-none select-none"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/55">Painel QA</span>
              <span className="text-sm font-semibold tracking-wide text-[#4e8df5]">Testing Metric</span>
            </div>
          </div>

          <nav className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scroll">
            <div className="flex-1 px-3 py-4 space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45 px-1">Navegacao</p>
                <div className="space-y-2">{renderNavLinks(true)}</div>
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="text-sm text-white/50"> </div>
          </div>
        </aside>
      </div>
    );

  return (
    <>
      {DesktopNav}
      {MobileNav}
    </>
  );
}
