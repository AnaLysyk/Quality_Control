/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import UsersList from "@/admin/users/permissions/UsersList";

let language = "pt-BR";

jest.mock("@/hooks/useI18n", () => ({
  useI18n: () => ({ language }),
}));

const users = [
  {
    id: "user-1",
    name: "Ana Paula",
    email: "ana@example.com",
    role: "Líder TC",
    companies: ["Empresa A"],
    status: "active",
  },
];

describe("UsersList", () => {
  beforeEach(() => {
    language = "pt-BR";
  });

  it("renderiza busca e usuários em botões nativos", () => {
    render(<UsersList users={users} onSelect={jest.fn()} />);

    expect(screen.getByPlaceholderText("Buscar nome ou email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ana Paula/i })).toHaveAttribute("type", "button");
    expect(screen.getByText(/ana@example.com/)).toBeInTheDocument();
  });

  it("seleciona o usuário ao clicar", () => {
    const onSelect = jest.fn();
    render(<UsersList users={users} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Ana Paula/i }));
    expect(onSelect).toHaveBeenCalledWith(users[0]);
  });

  it("usa placeholder em inglês", () => {
    language = "en";
    render(<UsersList users={[]} onSelect={jest.fn()} />);

    expect(screen.getByPlaceholderText("Search name or email")).toBeInTheDocument();
  });
});
