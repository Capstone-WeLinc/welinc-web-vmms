import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

interface FilterPanelPosition {
  top: number;
  left: number;
  maxHeight: number;
}

export function useFilterPanelPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
): { position: FilterPanelPosition | null; preparePosition: () => void } {
  const [position, setPosition] = useState<FilterPanelPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const margin = 8;
    const gap = 8;
    const panelWidth = Math.min(window.innerWidth * 0.92, 430);
    const left = Math.min(
      Math.max(margin, triggerRect.right - panelWidth),
      Math.max(margin, window.innerWidth - panelWidth - margin),
    );
    const panelHeight = Math.min(
      panelRef.current?.scrollHeight || 320,
      viewportHeight - margin * 2,
    );
    const spaceBelow = Math.max(0, viewportHeight - triggerRect.bottom - gap - margin);
    const spaceAbove = Math.max(0, triggerRect.top - gap - margin);
    const placeBelow = panelHeight <= spaceBelow || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(panelHeight, placeBelow ? spaceBelow : spaceAbove);
    const top = placeBelow
      ? triggerRect.bottom + gap
      : triggerRect.top - gap - maxHeight;

    setPosition({ top, left, maxHeight });
  }, [panelRef, triggerRef]);

  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return { position, preparePosition: updatePosition };
}
