import prisma from "@/lib/prisma";

interface AuditLogParams {
  editedById: string;
  messId: string;
  tableName: string;
  recordId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  action: "CREATE" | "UPDATE" | "DELETE";
}

export async function createAuditLog(params: AuditLogParams) {
  return prisma.auditLog.create({
    data: {
      editedById: params.editedById,
      messId: params.messId,
      tableName: params.tableName,
      recordId: params.recordId,
      fieldName: params.fieldName,
      oldValue: params.oldValue,
      newValue: params.newValue,
      action: params.action,
    },
  });
}

export async function createBulkAuditLogs(logs: AuditLogParams[]) {
  return prisma.auditLog.createMany({
    data: logs.map((log) => ({
      editedById: log.editedById,
      messId: log.messId,
      tableName: log.tableName,
      recordId: log.recordId,
      fieldName: log.fieldName,
      oldValue: log.oldValue,
      newValue: log.newValue,
      action: log.action,
    })),
  });
}
