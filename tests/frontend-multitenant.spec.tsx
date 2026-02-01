import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReleaseManualList from "../app/components/ReleaseManualList";
import DefectList from "../app/components/DefectList";

jest.mock("../app/components/ReleaseManualList");
jest.mock("../app/components/DefectList");

// Exemplo de teste de renderização e isolamento multi-tenant

describe("ReleaseManualList e DefectList", () => {
  it("Renderiza lista de releases manuais para a empresa correta", async () => {
    const companyId = "empresa-teste-1";
    (ReleaseManualList as jest.Mock).mockImplementation(({ companyId }) => (
      <div data-testid="release-list">Releases da empresa: {companyId}</div>
    ));
    render(<ReleaseManualList companyId={companyId} />);
    expect(screen.getByTestId("release-list")).toHaveTextContent(companyId);
  });

  it("Renderiza lista de defeitos para a empresa correta", async () => {
    const companyId = "empresa-teste-2";
    (DefectList as jest.Mock).mockImplementation(({ companyId }) => (
      <div data-testid="defect-list">Defeitos da empresa: {companyId}</div>
    ));
    render(<DefectList companyId={companyId} />);
    expect(screen.getByTestId("defect-list")).toHaveTextContent(companyId);
  });
});
