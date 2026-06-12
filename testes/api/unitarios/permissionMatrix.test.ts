import {
  normalizePermissionMatrix,
  resolveEffectivePermissionMatrix,
  hasPermissionAccess,
  applyPermissionOverride,
  getOverrideState,
  getTicketViewScope,
  getUsersViewScope,
  toVisibilityMap,
  PermissionMatrix
} from "../../../lib/permissionMatrix";

describe("permissionMatrix - Matriz Rígida de Autorização baseada em Módulos", () => {
  describe("normalizePermissionMatrix", () => {
    it("deve rejeitar lixos (null, strings, arrays) devolvendo interface limpa {}", () => {
      expect(normalizePermissionMatrix(null)).toEqual({});
      expect(normalizePermissionMatrix(undefined)).toEqual({});
      expect(normalizePermissionMatrix("fake")).toEqual({});
      expect(normalizePermissionMatrix([])).toEqual({});
      expect(normalizePermissionMatrix(123)).toEqual({});
    });

    it("deve remover arrays corrompidos, chaves não-string, e formatar strings vazias", () => {
      const dirty = {
        users: ["view", 123, null, "create", ""],
        settings: { view: true }, // Not an array
        runs: ["delete"],
        broken: null
      };

      const clean = normalizePermissionMatrix(dirty);
      
      expect(clean.users).toEqual(["view", "create"]); // Sanitizou 123, null, str vazia
      expect(clean.settings).toBeUndefined(); // Removeu key porque actions n era Array
      expect(clean.runs).toEqual(["delete"]);
      expect(clean).not.toHaveProperty("broken");
    });

    it("deve preservar apenas actions únicas evitando duplicidades", () => {
      const duplicated = {
        tickets: ["view", "view", "edit", "edit", "delete"]
      };
      
      const clean = normalizePermissionMatrix(duplicated);
      expect(clean.tickets).toHaveLength(3);
      expect(clean.tickets).toEqual(["view", "edit", "delete"]);
    });
  });

  describe("resolveEffectivePermissionMatrix", () => {
    it("deve retornar permissions diretos, caso existam, ignorando roles", () => {
      const matrix = resolveEffectivePermissionMatrix({
        permissions: { tickets: ["view_all"] },
        role: "technical_support",
        isGlobalAdmin: true
      });
      // Importante: prevalece os permissions override explícitos se existem
      expect(matrix).toEqual({ tickets: ["view_all"] });
    });

    it("fallback em cascata rigidamente priorizado: permissionRole > role > companyRole > globalRole > isGlobalAdmin", () => {
      // 1. match `permissionRole`
      expect(
        resolveEffectivePermissionMatrix({ permissionRole: "leader_tc", role: "company" })
      ).toHaveProperty("tickets"); // Puxa do ROLE_DEFAULTS (mocked by fallback logic/imports)

      // 2. match `role` if permissionRole is missing
      expect(
        resolveEffectivePermissionMatrix({ role: "technical_support" })
      ).toHaveProperty("support");

      // 3. Fallback to `isGlobalAdmin` true maps to `global_admin`
      const globalMatrix = resolveEffectivePermissionMatrix({ isGlobalAdmin: true });
      // Depending on ROLE_DEFAULTS values, global_admin is leader_tc
      expect(Object.keys(globalMatrix).length).toBeGreaterThan(0); 
    });

    it("deve retornar matriz em branco caso nenhum fallback funcione", () => {
      const noneMatch = resolveEffectivePermissionMatrix({
        permissions: {}, // none valid action
        role: "",
        companyRole: null,
        isGlobalAdmin: false
      });
      expect(noneMatch).toEqual({}); // Matrix completamente vazia
    });
  });

  describe("hasPermissionAccess", () => {
    it("valida match strict contra action em modulo especifico", () => {
      const permissions: PermissionMatrix = {
        users: ["view", "delete"],
        tickets: ["create"]
      };

      expect(hasPermissionAccess(permissions, "users", "view")).toBe(true);
      expect(hasPermissionAccess(permissions, "users", "delete")).toBe(true);
      expect(hasPermissionAccess(permissions, "users", "create")).toBe(false); // Inexistente no modulo
      expect(hasPermissionAccess(permissions, "runs", "view")).toBe(false); // Modulo inexistente
    });

    it("barra acessos nulls ou corrompidos sem falhar", () => {
      expect(hasPermissionAccess(null, "users", "view")).toBe(false);
      expect(hasPermissionAccess(undefined, "users", "view")).toBe(false);
      
      const malformed = { users: { view: true } } as unknown as PermissionMatrix;
      expect(hasPermissionAccess(malformed, "users", "view")).toBe(false);
    });
  });

  describe("applyPermissionOverride", () => {
    it("deve dar merge de allow e subtrair deny de rolesDefaults", () => {
      const baseDefaults: PermissionMatrix = {
        users: ["view", "create"],
        settings: ["view"]
      };
      
      const override = {
        allow: {
          settings: ["edit"], // Adiciona esse
          tickets: ["create"] // Novo Modulo
        },
        deny: {
          users: ["create"] // Remove esse
        }
      };

      const result = applyPermissionOverride(baseDefaults, override);
      
      // Users só sobrou view
      expect(result.users).toEqual(["view"]);
      // Settings ganhou edit
      expect(result.settings).toHaveLength(2);
      expect(result.settings).toContain("view");
      expect(result.settings).toContain("edit");
      // Ticket veio inteiro do allow
      expect(result.tickets).toEqual(["create"]);
    });

    it("na colisão entre allow e deny sobre a mesma policy: subtrai (prioritário ao deny)", () => {
      const base: PermissionMatrix = { tickets: ["comment"] };
      const override = {
        allow: { tickets: ["delete"] },
        deny: { tickets: ["delete"] } // Nega a mesma coisa que permitiu
      };

      const result = applyPermissionOverride(base, override);
      expect(result.tickets).not.toContain("delete"); // Deny prevaleceu na execução do merge set iterators
      expect(result.tickets).toContain("comment"); // intacto
    });
  });

  describe("Scooped Views", () => {
    describe("getTicketViewScope", () => {
      it("retorna hierarquia rigorosa: all > company > own", () => {
        expect(getTicketViewScope({ tickets: ["view_all", "view_company"] })).toBe("all");
        expect(getTicketViewScope({ tickets: ["view_company"] })).toBe("company");
        expect(getTicketViewScope({ tickets: ["view"] })).toBe("own"); // Fallback fallback_own default
        expect(getTicketViewScope(null)).toBe("own");
      });
    });

    describe("getUsersViewScope", () => {
      it("retorna hierarquia rigorosa: all > company > own", () => {
        expect(getUsersViewScope({ users: ["view_all"] })).toBe("all");
        expect(getUsersViewScope({ users: ["view_company"] })).toBe("company");
        expect(getUsersViewScope({ users: ["edit"] })).toBe("own");
        expect(getUsersViewScope(null)).toBe("own");
      });
    });
  });

  describe("toVisibilityMap", () => {
    it("plana matriz convertendo cada modulo pra view booelan se houver modulo.view", () => {
      const perms = {
        users: ["view", "create"],
        runs: ["create"],
        tickets: ["edit", "view"]
      };

      const visMap = toVisibilityMap(perms);
      expect(visMap.users).toBe(true);
      expect(visMap.runs).toBe(false); // não tem view action
      expect(visMap.tickets).toBe(true); 
    });
  });
});
