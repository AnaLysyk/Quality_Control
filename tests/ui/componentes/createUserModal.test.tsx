/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/hooks/usePermissionAccess", () => ({
  usePermissionAccess: () => ({
    accessContext: null,
    companies: [],
  }),
}));

import { CreateUserModal } from "@/admin/users/components/CreateUserModal";

describe("CreateUserModal", () => {
  it("auto-selects the single client and enables submit when required fields are filled", async () => {
    const onClose = jest.fn();
    const onCreated = jest.fn();

    const clients = [{ id: "c1", name: "Client One" }];

    render(
      <CreateUserModal open={true} clientId={null} clients={clients} onClose={onClose} onCreated={onCreated} initialRole="leader_tc" />,
    );

    // Empresa select should have the single client selected
    const select = screen.getByLabelText("Empresa vinculada") as HTMLSelectElement;
    expect(select.value).toBe("c1");

    // Fill required fields
    const nameInput = screen.getByPlaceholderText("Nome do usu\u00e1rio") as HTMLInputElement;
    const emailInput = screen.getByPlaceholderText("email@empresa.com") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: /Criar usu\u00e1rio/i }) as HTMLButtonElement;

    fireEvent.change(nameInput, { target: { value: "Teste Usuario" } });
    expect(submit).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: "teste@exemplo.com" } });
    expect(screen.getByText(/Senha temporaria automatica/i)).toBeInTheDocument();
    expect(submit).not.toBeDisabled();
  });
});

