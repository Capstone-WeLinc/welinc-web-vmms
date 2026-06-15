export const formatWorkOrderNumber = (id: string) => {
  const numericSuffix = id.match(/^(?:task-)?(\d+)$/i)?.[1];

  if (numericSuffix) {
    return `WO-${numericSuffix.slice(-6).padStart(6, "0")}`;
  }

  const normalizedId = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `WO-${normalizedId.slice(0, 8).padEnd(8, "0")}`;
};
