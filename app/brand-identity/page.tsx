"use client";

import Image from "next/image";
import styles from "./page.module.css";

export default function BrandIdentityPage() {
  const colors = [
    { name: "Primary", hex: "#011848", css: "--tc-primary", usage: "Cabeçalhos, textos principais" },
    { name: "Primary Dark", hex: "#000f2e", css: "--tc-primary-dark", usage: "Hover states, elementos escuros" },
    { name: "Accent", hex: "#ef0001", css: "--tc-accent", usage: "Botões, links, destaques" },
    { name: "Accent Hover", hex: "#c80001", css: "--tc-accent-hover", usage: "Estados hover" },
    { name: "Accent Active", hex: "#a80001", css: "--tc-accent-active", usage: "Estados ativos" },
    { name: "Background", hex: "#f4f6fb", css: "--page-bg", usage: "Fundo da página" },
    { name: "Text Primary", hex: "#0b1a3c", css: "--tc-text-primary", usage: "Texto principal" },
    { name: "Text Secondary", hex: "#4b5563", css: "--tc-text-secondary", usage: "Texto secundário" },
    { name: "Surface", hex: "#ffffff", css: "--tc-surface", usage: "Cards, modais" },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-[#011848]/15 via-white to-[#ef0001]/8">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-linear-to-r from-[#011848] to-[#ef0001] rounded-full mb-6 shadow-lg hover:scale-105 transition-all duration-500">
            <Image
              src="/images/tc.png"
              alt="Testing Company Logo"
              width={48}
              height={48}
              className="brightness-0 invert"
            />
          </div>
          <h1 className="text-4xl font-bold text-[#011848] mb-4">
            Testing Company
          </h1>
          <p className="text-xl text-[#4b5563] mb-2">
            Monitoramento Inteligente de Qualidade em Tempo Real
          </p>
          <p className="text-[#6b7280]">
            Identidade Visual e Sistema de Design
          </p>
        </div>

        {/* Logo Section */}
        <section className="bg-white rounded-2xl p-8 shadow-lg mb-8 border border-[#011848]/10">
          <h2 className="text-2xl font-bold text-[#011848] mb-6">Logotipo</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-[#f4f6fb] p-8 rounded-lg mb-4 border border-[#011848]/10">
                <Image
                  src="/images/tc.png"
                  alt="Testing Company Logo"
                  width={80}
                  height={80}
                  className="mx-auto"
                />
              </div>
              <h3 className="font-semibold text-[#011848]">Versão Colorida</h3>
              <p className="text-sm text-[#4b5563]">Para fundos claros</p>
            </div>
            <div className="text-center">
              <div className="bg-[#011848] p-8 rounded-lg mb-4">
                <Image
                  src="/images/tc.png"
                  alt="Testing Company Logo"
                  width={80}
                  height={80}
                  className="mx-auto brightness-0 invert"
                />
              </div>
              <h3 className="font-semibold text-[#011848]">Versão Branca</h3>
              <p className="text-sm text-[#4b5563]">Para fundos escuros</p>
            </div>
            <div className="text-center">
              <div className="bg-[#ef0001] p-8 rounded-lg mb-4">
                <Image
                  src="/images/tc.png"
                  alt="Testing Company Logo"
                  width={80}
                  height={80}
                  className="mx-auto brightness-0 invert"
                />
              </div>
              <h3 className="font-semibold text-[#011848]">Versão Azul</h3>
              <p className="text-sm text-[#4b5563]">Para fundos coloridos</p>
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section className="bg-white rounded-2xl p-8 shadow-lg mb-8 border border-[#011848]/10">
          <h2 className="text-2xl font-bold text-[#011848] mb-6">Paleta de Cores</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {colors.map((color) => {
              // Gera o nome da classe no padrão brand-swatch--*
              const swatchClass = `brand-swatch--${color.name.replace(/\s+/g, '-').toLowerCase()}`;
              return (
                <div key={color.name} className="border border-[#011848]/10 rounded-lg p-4">
                  <div
                    className={`w-full h-20 rounded-lg mb-3 shadow-sm ${styles[swatchClass]}`}
                  ></div>
                  <h3 className="font-semibold text-[#011848]">{color.name}</h3>
                  <p className="text-sm text-[#4b5563] mb-1">{color.hex}</p>
                  <p className="text-xs text-[#6b7280] mb-2">{color.css}</p>
                  <p className="text-xs text-[#4b5563]">{color.usage}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Typography */}
        <section className="bg-white rounded-2xl p-8 shadow-lg mb-8 border border-[#011848]/10">
          <h2 className="text-2xl font-bold text-[#011848] mb-6">Tipografia</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-[#011848] mb-2">Fonte Principal: Poppins</h3>
              <p className={`text-4xl font-light text-[#011848] mb-2 ${styles.poppinsFont}`}>
                Aa Bb Cc Dd Ee Ff Gg
              </p>
              <p className="text-sm text-[#4b5563]">Sans-serif moderna para interfaces digitais</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#011848] mb-2">Fonte Monospace: Geist Mono</h3>
              <p className="text-lg font-mono text-[#011848] mb-2">
                function hello() {`{ return "world"; }`}
              </p>
              <p className="text-sm text-[#4b5563]">Para código e elementos técnicos</p>
            </div>
          </div>
        </section>

        {/* Brand Values */}
        <section className="bg-white rounded-2xl p-8 shadow-lg mb-8 border border-[#011848]/10">
          <h2 className="text-2xl font-bold text-[#011848] mb-6">Valores da Marca</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-[#011848] mb-4">Qualidade</h3>
              <p className="text-[#4b5563]">
                Compromisso com excelência e precisão em todos os processos de teste e validação.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#011848] mb-4">Inovação</h3>
              <p className="text-[#4b5563]">
                Tecnologia de ponta para monitoramento inteligente e análise em tempo real.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#011848] mb-4">Confiabilidade</h3>
              <p className="text-[#4b5563]">
                Dados precisos e insights acionáveis para tomada de decisão estratégica.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#011848] mb-4">Transparência</h3>
              <p className="text-[#4b5563]">
                Visibilidade completa do processo de qualidade para todas as partes interessadas.
              </p>
            </div>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section className="bg-white rounded-2xl p-8 shadow-lg border border-[#011848]/10">
          <h2 className="text-2xl font-bold text-[#011848] mb-6">Diretrizes de Uso</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-[#011848] pl-4">
              <h3 className="font-semibold text-[#011848]">Logo</h3>
              <p className="text-[#4b5563]">Mantenha proporções e não distorça. Use sempre com fundo adequado para legibilidade.</p>
            </div>
            <div className="border-l-4 border-[#ef0001] pl-4">
              <h3 className="font-semibold text-[#011848]">Cor Accent</h3>
              <p className="text-[#4b5563]">Use com moderação. Reserve para ações importantes e estados de erro.</p>
            </div>
            <div className="border-l-4 border-[#4b5563] pl-4">
              <h3 className="font-semibold text-[#011848]">Tipografia</h3>
              <p className="text-[#4b5563]">Poppins para texto corrido, Geist Mono apenas para código técnico.</p>
            </div>
            <div className="border-l-4 border-[#011848]/50 pl-4">
              <h3 className="font-semibold text-[#011848]">Espaçamento</h3>
              <p className="text-[#4b5563]">Mantenha consistência com o sistema de design baseado em múltiplos de 4px.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}