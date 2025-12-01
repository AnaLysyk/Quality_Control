"use client";

import Link from "next/link";
import { useState } from "react";
import { FiHome, FiFolder, FiChevronRight } from "react-icons/fi";

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  const releases = [
    { id: "v1_6_2", name: "Release 1.6.2" },
    { id: "v1_7_0", name: "Release 1.7.0" },
    { id: "v1_8_0", name: "Release 1.8.0" },
  ];

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className={`
        bg-black text-white h-screen fixed top-0 left-0 z-50
        transition-all duration-300 ease-in-out
        flex flex-col
        ${open ? "w-64" : "w-16"}
      `}
    >
      <nav className="p-4 flex flex-col gap-4">

        {/* DASHBOARD */}
        <Link
          href="/dashboard"
          className="flex items-center gap-4 p-2 rounded hover:bg-zinc-800 transition"
        >
          <FiHome size={22} />
          {open && <span className="text-sm">Dashboard</span>}
        </Link>

        {/* RELEASES */}
        <div>
          <div className="flex items-center gap-4 p-2 rounded hover:bg-zinc-800 transition select-none">
            <FiFolder size={22} />
            {open && <span className="text-sm font-semibold">Releases</span>}
          </div>

          {/* LISTA DE RELEASES */}
          <div className={`flex flex-col gap-1 mt-2 ${open ? "ml-6" : ""}`}>
            {releases.map((r) => (
              <Link
                key={r.id}
                href={`/release/${r.id}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-zinc-800 transition text-sm"
              >
                {open && (
                  <>
                    <FiChevronRight size={16} />
                    {r.name}
                  </>
                )}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
