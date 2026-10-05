export type WebExecutionItem = {
  id: string;
  text: string;
  status: "checked" | "changed" | "notChecked" | "pending";
  note: string;
  partsUsed?: string;
  partsCost?: string;
  attachments?: WebWorkOrderAttachment[];
};

export type WebWorkOrderAttachment = {
  id: string;
  name: string;
  sizeMb: number;
  contentType?: string;
  storageName?: string;
};

export function mergeUploadedWorkOrderAttachments(
  existing: WebWorkOrderAttachment[],
  uploaded: WebWorkOrderAttachment[],
): WebWorkOrderAttachment[] {
  return [
    ...existing.filter((attachment) => attachment.storageName || !uploaded.some(
      (file) => file.name.toLowerCase() === attachment.name.toLowerCase(),
    )),
    ...uploaded,
  ];
}

export type WebChecklistItem = {
  id: string;
  text: string;
  status: "pass" | "fail" | "pending";
  note: string;
};

export type WebExecutionRecord = {
  done: boolean;
  items: WebExecutionItem[];
  attachments?: string[];
  remarks?: string;
  maintenanceRemarks?: string;
  technicianSignature?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asText = (value: unknown): string =>
  typeof value === "string" ? value : "";

export function mapWorkOrderProgress(value: unknown): {
  checklist?: WebChecklistItem[];
  execution?: WebExecutionRecord;
} | null {
  const progress = asRecord(value);
  if (!progress) return null;

  const partDetails = asRecord(progress.partDetails) ?? {};
  const mobileExecution = Array.isArray(progress.executionItems)
    ? progress.executionItems
    : null;
  const legacyExecution = asRecord(progress.execution);
  const rawExecution = mobileExecution ??
    (Array.isArray(legacyExecution?.items) ? legacyExecution.items : null);

  const execution = rawExecution
    ? {
        done:
          progress.mechanicSubmitted === true ||
          progress.workflowStatus === "Done" ||
          (mobileExecution === null && legacyExecution?.done === true),
        items: rawExecution.flatMap((raw): WebExecutionItem[] => {
          const item = asRecord(raw);
          if (!item || typeof item.id !== "string") return [];
          const part = asRecord(partDetails[item.id]) ?? {};
          const status = ["checked", "changed", "notChecked", "pending"].includes(
            String(item.status),
          )
            ? (item.status as WebExecutionItem["status"])
            : "pending";
          const attachmentsValue = Array.isArray(part.attachments)
            ? part.attachments
            : Array.isArray(item.attachments)
              ? item.attachments
              : [];
          return [{
            id: item.id,
            text: asText(item.label) || asText(item.text) || item.id,
            status,
            note: asText(item.note),
            partsUsed: asText(part.partsUsed) || asText(item.partsUsed),
            partsCost: asText(part.materialCost) || asText(item.partsCost),
            attachments: attachmentsValue.flatMap((attachment, index) => {
              if (typeof attachment === "string") {
                return [{ id: "", name: attachment, sizeMb: 0 }];
              }
              const record = asRecord(attachment);
              const name = asText(record?.name);
              if (!record || !name) return [];
              return [{
                id: asText(record.id) || `legacy-${item.id}-${index}`,
                name,
                sizeMb: Number.isFinite(Number(record.sizeMb)) ? Number(record.sizeMb) : 0,
                ...(typeof record.contentType === "string" ? { contentType: record.contentType } : {}),
                ...(typeof record.storageName === "string" ? { storageName: record.storageName } : {}),
              }];
            }),
          }];
        }),
        attachments: Array.isArray(legacyExecution?.attachments)
          ? legacyExecution.attachments.filter((item): item is string => typeof item === "string")
          : [],
        remarks: asText(progress.inspectorRemarks) || asText(legacyExecution?.remarks),
        maintenanceRemarks: asText(progress.maintenanceRemarks) || asText(legacyExecution?.maintenanceRemarks),
        technicianSignature: asText(progress.chiefMechanic) || asText(legacyExecution?.technicianSignature),
      }
    : undefined;

  const rawChecklist = Array.isArray(progress.inspectionItems)
    ? progress.inspectionItems
    : Array.isArray(progress.checklist)
      ? progress.checklist
      : null;
  const checklist = rawChecklist
    ? rawChecklist.flatMap((raw): WebChecklistItem[] => {
        const item = asRecord(raw);
        if (!item || typeof item.id !== "string") return [];
        const status = ["pass", "fail", "pending"].includes(String(item.status))
          ? (item.status as WebChecklistItem["status"])
          : "pending";
        return [{
          id: item.id,
          text: asText(item.label) || asText(item.text) || item.id,
          status,
          note: asText(item.note),
        }];
      })
    : undefined;

  return { checklist, execution };
}

export function buildBackendWorkOrderProgress(
  checklist: WebChecklistItem[],
  execution: WebExecutionRecord,
  previousValue: unknown,
): Record<string, unknown> {
  const previous = asRecord(previousValue) ?? {};
  const previousParts = asRecord(previous.partDetails) ?? {};
  const partDetails: Record<string, Record<string, unknown>> = {};
  const executionItems = execution.items.map((item) => {
    const oldParts = asRecord(previousParts[item.id]) ?? {};
    const attachments = item.attachments !== undefined
      ? item.attachments
      : Array.isArray(oldParts.attachments)
        ? oldParts.attachments
        : [];
    partDetails[item.id] = {
      ...oldParts,
      partsUsed: item.partsUsed ?? asText(oldParts.partsUsed),
      materialCost: item.partsCost ?? asText(oldParts.materialCost),
      quantity: asText(oldParts.quantity),
      attachments,
    };
    return {
      id: item.id,
      label: item.text,
      status: item.status,
      note: item.note,
    };
  });

  return {
    action: "SAVE",
    executionItems,
    partDetails,
    inspectionItems: checklist.map((item) => ({
      id: item.id,
      label: item.text,
      status: item.status,
      note: item.note,
    })),
    inspectorRemarks:
      typeof previous.inspectorRemarks === "string"
        ? previous.inspectorRemarks
        : execution.remarks ?? "",
    maintenanceRemarks:
      typeof previous.maintenanceRemarks === "string"
        ? previous.maintenanceRemarks
        : execution.maintenanceRemarks ?? "",
    rejectionRemarks: asText(previous.rejectionRemarks),
  };
}
