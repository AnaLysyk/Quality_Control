/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import { CreateUserModal } from "../app/admin/users/components/CreateUserModal";

describe("CreateUserModal", () => {
  it("auto-selects the single client and enables submit when required fields filled", async () => {
    const onClose = jest.fn();
    const onCreated = jest.fn();

    const clients = [{ id: "c1", name: "Client One" }];

    render(
      <CreateUserModal open={true} clientId={null} clients={clients} onClose={onClose} onCreated={onCreated} />,
    );

    // Empresa select should have the single client selected
    const select = screen.getByLabelText("Empresa vinculada") as HTMLSelectElement;
    expect(select.value).toBe("c1");

    // Fill required fields
    const nameInput = screen.getByPlaceholderText("Nome do usuario") as HTMLInputElement;
    const emailInput = screen.getByPlaceholderText("email@empresa.com") as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "Teste Usuario" } });
    fireEvent.change(emailInput, { target: { value: "teste@exemplo.com" } });

    const submit = screen.getByRole("button", { name: /Criar usuario/i }) as HTMLButtonElement;
    expect(submit).not.toBeDisabled();
  });
});
