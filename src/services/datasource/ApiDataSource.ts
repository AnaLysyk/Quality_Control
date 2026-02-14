// ApiDataSource: Alias para a implementação padrão de data source (JsonDataSource).
// Altere este export para trocar globalmente a fonte de dados do backend.
import { JsonDataSource } from "./JsonDataSource";

export const ApiDataSource = JsonDataSource;
