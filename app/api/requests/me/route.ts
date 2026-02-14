import { NextResponse } from "next/server";
import { listUserRequests, type RequestStatus, type RequestType } from "@/data/requestsStore";
import { authenticateRequest } from "@/lib/jwtAuth";

function isRequestStatus(value: string | null): value is RequestStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED" || value === "CANCELLED";
}

function isRequestType(value: string | null): value is RequestType {
  return value === "ACCESS" || value === "EMAIL_CHANGE" || value === "COMPANY_CHANGE";
}

export async function GET(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusRaw = searchParams.get("status");
    const typeRaw = searchParams.get("type");

    let status: RequestStatus | undefined = undefined;
    let type: RequestType | undefined = undefined;
    if (statusRaw) {
      if (!isRequestStatus(statusRaw)) {
        return NextResponse.json({ message: "Status inválido" }, { status: 400 });
      }
      status = statusRaw as RequestStatus;
    }
    if (typeRaw) {
      if (!isRequestType(typeRaw)) {
        return NextResponse.json({ message: "Tipo inválido" }, { status: 400 });
      }
      type = typeRaw as RequestType;
    }

    const items = await listUserRequests(authUser.id, {
      status,
      type,
    });

    // Se necessário, filtrar campos sensíveis aqui
    // const safeItems = items.map(({id, type, status, createdAt, payload}) => ({id, type, status, createdAt, payload}));

    return NextResponse.json({ 
      items: items.map(item => ({
        ...item,
        status: (typeof item.status === "string" && ["PENDING","APPROVED","REJECTED","CANCELLED"].includes(item.status.toUpperCase()))
          ? item.status.toUpperCase() as RequestStatus
          : undefined,
        type: (typeof item.type === "string" && ["ACCESS","EMAIL_CHANGE","COMPANY_CHANGE"].includes(item.type.toUpperCase()))
          ? item.type.toUpperCase() as RequestType
          : undefined,
      })), 
      total: items.length 
    });
  } catch (err) {
    console.error("Erro ao listar solicitações do usuário", err);
    return NextResponse.json(
      { message: "Erro ao buscar solicitações" },
      { status: 500 }
    );
  }
}
