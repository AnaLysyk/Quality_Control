"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FiChevronLeft, FiGrid, FiHome, FiLayers, FiLogOut } from "react-icons/fi";
import { releaseOrder, releasesData } from "@/release/data";

const griauleLogo = "/images/griaule.svg";

const applications = [
  { name: "SMART", slug: "smart", description: "Releases monitoradas com gráficos e detalhamento." },
  { name: "PRINT", slug: "print", description: "Nenhuma release publicada ainda." },
  { name: "BOOKING", slug: "booking", description: "Nenhuma release publicada ainda." },
  { name: "TRUST", slug: "trust", description: "Nenhuma release publicada ainda." },
  { name: "CIDADÃO SMART", slug: "cidadao-smart", description: "Nenhuma release publicada ainda." },
  { name: "MOBILE GRIAULE", slug: "mobile-griaule", description: "Nenhuma release publicada ainda." },
];

const navigation = [
  { label: "Home", icon: FiHome, href: "/" },
  { label: "Deskboard", icon: FiGrid, href: "/deskboard" },
  { label: "Releases", icon: FiLayers, href: "/release" },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const releases = releaseOrder.map((id) => ({ id, name: releasesData[id].title }));

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } finally {
      localStorage.removeItem("auth_ok");
      window.location.href = "/login";
    }
  };

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className={`bg-[#090f1b] text-white h-screen fixed top-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out group ${
        open ? "w-64" : "w-20"
      }`}
    >
      <div className="flex items-center gap-3 p-4 border-b border-white/10 relative">
        <Link
          href="/"
          className={`flex items-center gap-3 transition-all duration-200 ${open ? "justify-start" : "justify-center w-full"}`}
        >
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center ring-1 ring-white/10 overflow-hidden">
            <Image src={griauleLogo} alt="Griaule" width={48} height={48} className="w-10 h-10 object-contain" priority />
          </div>
          {open && <span className="text-sm font-semibold tracking-wide">Painel QA</span>}
        </Link>
        <button
          onClick={() => setOpen((value) => !value)}
          aria-label="Alternar menu"
          className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 bg-white/5 text-white/80 transition ${
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <FiChevronLeft size={18} className={`${open ? "" : "rotate-180"}`} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 px-3 py-4">
          <div className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/5 ${
                  open ? "justify-start" : "justify-center"
                }`}
              >
                <item.icon size={18} />
                {open && <span>{item.label}</span>}
              </Link>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="text-xs uppercase tracking-[0.3em] text-[#7CD343] mb-2">{open ? "Aplicações" : "Apps"}</h3>
            <div className="space-y-2 pr-1">
              <div
                className={`h-full w-full ${open ? "overflow-y-auto scrollbar-thin scrollbar-thumb-[#1f2b3f] scrollbar-track-transparent" : ""}`}
                style={{ maxHeight: open ? "calc(100vh - 220px)" : "auto" }}
              >
                {applications.map((app) => (
                  <Link
                    key={app.slug}
                    href={`/applications/${app.slug}`}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-white/5 ${
                      open ? "justify-start" : "justify-center"
                    }`}
                  >
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                      {app.name.slice(0, 2)}
                    </span>
                    {open && (
                      <div>
                        <p className="font-semibold">{app.name}</p>
                        <p className="text-xs text-gray-400">{app.description}</p>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-xs uppercase tracking-[0.3em] text-[#7CD343] mb-2">{open ? "Releases" : "Rel"}</h3>
            <div className="space-y-1">
              {releases.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/release/${rel.id}`}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:bg-white/5 ${
                    open ? "justify-start" : "justify-center"
                  }`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-[10px] font-semibold">
                    {rel.id}
                  </span>
                  {open && <span className="truncate">{rel.name}</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 rounded-xl bg-red-600/80 px-3 py-2 text-sm font-semibold transition hover:bg-red-600"
        >
          <FiLogOut size={18} />
          {open ? "Sair" : " "}
        </button>
      </div>
    </aside>
  );
}
