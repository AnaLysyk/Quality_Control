"use client";

/**
 * Profile Tabs — navegação entre abas
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfileContext } from "@/lib/profile/useProfileContext";
import type { ProfileTab } from "@/lib/profile/types";

const TAB_LABELS: Record<ProfileTab, string> = {
  overview: "Visão geral",
  profile: "Cadastro",
  access: "Acesso",
  companies: "Empresas",
  users: "Usuários",
  applications: "Aplicações",
  integrations: "Integrações",
  permissions: "Permissões",
  preferences: "Preferências",
  security: "Segurança",
  audit: "Histórico",
};

export type ProfileTabsProps = {
  children: Record<ProfileTab, React.ReactNode>;
  defaultTab?: ProfileTab;
  onTabChange?: (tab: ProfileTab) => void;
};

export function ProfileTabs({
  children,
  defaultTab = "overview",
  onTabChange,
}: ProfileTabsProps) {
  const context = useProfileContext();

  return (
    <Tabs
      defaultValue={defaultTab}
      onValueChange={(val) => onTabChange?.(val as ProfileTab)}
    >
      <TabsList>
        {context.visibleTabs.map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {TAB_LABELS[tab]}
          </TabsTrigger>
        ))}
      </TabsList>

      {context.visibleTabs.map((tab) => (
        <TabsContent key={tab} value={tab}>
          {children[tab]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
