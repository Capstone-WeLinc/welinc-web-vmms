import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardCheck,
  Plus,
  Trash2,
  GripVertical,
  Edit,
  Filter,
  X,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  ActionButton,
  ActionMenu,
  ConfirmationModal,
  DataTable,
  LegendHelp,
  Pagination,
  SearchInput,
  ToastNotification,
} from "../../components/ui";
import {
  getChecklistTemplates,
  getMaintenanceSchedules,
  saveChecklistTemplates,
} from "../../lib/api/maintenanceService";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import type { MaintenanceTask } from "../../types/maintenance";

type ChecklistTemplateName = string;

interface ChecklistItemTemplate {
  id: string;
  text: string;
}

const containerClasses = "space-y-6";

export default function ChecklistTemplates() {
  const itemsPerPage = 8;
  const [templates, setTemplates] = useState<
    Record<ChecklistTemplateName, ChecklistItemTemplate[]>
  >({});
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<
    MaintenanceTask[]
  >([]);
  const [selectedType, setSelectedType] = useState<ChecklistTemplateName>("");
  const [editingItems, setEditingItems] = useState<ChecklistItemTemplate[]>([]);
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTemplateItems, setNewTemplateItems] = useState<ChecklistItemTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [templateUsageFilter, setTemplateUsageFilter] = useState<"all" | "used" | "unused">("all");
  const [templateSizeFilter, setTemplateSizeFilter] = useState<"all" | "empty" | "withItems">("all");
  const [draftUsageFilter, setDraftUsageFilter] = useState<"all" | "used" | "unused">("all");
  const [draftSizeFilter, setDraftSizeFilter] = useState<"all" | "empty" | "withItems">("all");
  const [showTemplateFilters, setShowTemplateFilters] = useState(false);
  const [itemFilter, setItemFilter] = useState("");
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templatePage, setTemplatePage] = useState(1);
  const [checklistPage, setChecklistPage] = useState(1);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState<string>("");
  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [confirmAddType, setConfirmAddType] = useState(false);
  const [confirmDeleteTemplateItem, setConfirmDeleteTemplateItem] = useState<string | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<string | null>(null);
  const [blockedDeleteType, setBlockedDeleteType] = useState<string | null>(
    null,
  );
  const [duplicateType, setDuplicateType] = useState<string | null>(null);
  const [duplicateTypeSource, setDuplicateTypeSource] = useState<string | null>(
    null,
  );
  const [openTemplateActionMenuId, setOpenTemplateActionMenuId] = useState<
    string | null
  >(null);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);

  useBodyScrollLock(
    Boolean(
      confirmDeleteType ||
        confirmAddType ||
        confirmDeleteTemplateItem ||
        blockedDeleteType ||
        duplicateType ||
        isTemplateModalOpen ||
        isAddingType,
    ),
  );

  const getTemplateUsageCount = (type: string) =>
    maintenanceSchedules.filter(
      (schedule) =>
        schedule.title.trim().toLowerCase() === type.trim().toLowerCase(),
    ).length;

  const templateHasMaintenanceSchedule = (type: string) =>
    getTemplateUsageCount(type) > 0;

  const showStructureLockedMessage = () => {
    setToast({
      type: "error",
      message:
        "Checklist items cannot be modified because this template has already been used.",
    });
  };

  useEffect(() => {
    getChecklistTemplates()
      .then((loadedTemplates) => {
        setTemplates(loadedTemplates);
        const availableTypes = Object.keys(loadedTemplates);
        const initialType = availableTypes.length > 0 ? availableTypes[0] : "";
        setSelectedType(initialType as ChecklistTemplateName);
        setEditingItems(initialType ? [...loadedTemplates[initialType]] : []);
      })
      .catch(() => {
        setTemplates({});
        setSelectedType("");
        setEditingItems([]);
      });

    getMaintenanceSchedules()
      .then(setMaintenanceSchedules)
      .catch(() => setMaintenanceSchedules([]));
  }, []);

  useEffect(() => {
    const closeActionMenus = () => {
      setOpenTemplateActionMenuId(null);
    };
    document.addEventListener("click", closeActionMenus);
    return () => document.removeEventListener("click", closeActionMenus);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleUpdateItem = (id: string, text: string) => {
    setEditingItems((items) =>
      items.map((item) => (item.id === id ? { ...item, text } : item)),
    );
  };

  const handleReorderItems = (draggedId: string, targetId: string) => {
    if (!isEditingChecklist) return;
    if (templateHasMaintenanceSchedule(selectedType)) {
      showStructureLockedMessage();
      return;
    }

    setEditingItems((items) => {
      const fromIndex = items.findIndex((item) => item.id === draggedId);
      const toIndex = items.findIndex((item) => item.id === targetId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return items;
      }

      const updatedItems = [...items];
      const [movedItem] = updatedItems.splice(fromIndex, 1);
      updatedItems.splice(toIndex, 0, movedItem);
      return updatedItems;
    });
  };

  const commitTemplateModalChanges = () => {
    if (!selectedType || templateHasMaintenanceSchedule(selectedType)) {
      if (selectedType) showStructureLockedMessage();
      return false;
    }

    const nextType =
      editingType === selectedType && editingTypeValue.trim()
        ? editingTypeValue.trim()
        : selectedType;
    const existingType = Object.keys(templates).find(
      (type) =>
        type !== selectedType && type.toLowerCase() === nextType.toLowerCase(),
    );

    if (existingType) {
      setDuplicateType(existingType);
      setDuplicateTypeSource(selectedType);
      return false;
    }

    const saveableItems = editingItems.filter(
      (item) => item.text.trim() !== "",
    );
    const newTemplates: Record<ChecklistTemplateName, ChecklistItemTemplate[]> = {
      ...templates,
    };

    if (nextType !== selectedType) {
      delete newTemplates[selectedType];
    }
    newTemplates[nextType] = saveableItems;

    setTemplates(newTemplates);
    setSelectedType(nextType);
    setEditingItems(saveableItems);
    saveChecklistTemplates(newTemplates).catch((error) => {
      console.error("Failed to save template", error);
    });
    return true;
  };

  const handleAddType = () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;

    const existingType = Object.keys(templates).find(
      (type) => type.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existingType) {
      setDuplicateType(existingType);
      setDuplicateTypeSource(null);
      return;
    }

    const saveableItems = newTemplateItems.filter(
      (item) => item.text.trim() !== "",
    );
    const newTemplates = { [trimmed]: saveableItems, ...templates };
    setTemplates(newTemplates);
    saveChecklistTemplates(newTemplates).catch((error) => {
      console.error("Failed to save templates", error);
    });
    setNewTypeName("");
    setNewTemplateItems([]);
    setIsAddingType(false);
    setSelectedType(trimmed);
    setTemplatePage(1);
    setChecklistPage(1);
    setEditingItems(saveableItems);
    setIsTemplateModalOpen(true);
  };

  const openAddTemplateModal = () => {
    setNewTypeName("");
    setNewTemplateItems([
      { id: `new-${Date.now()}`, text: "" },
    ]);
    setIsAddingType(true);
  };

  const closeAddTemplateModal = () => {
    setIsAddingType(false);
    setNewTypeName("");
    setNewTemplateItems([]);
  };

  const addNewTemplateItem = () => {
    setNewTemplateItems((items) => [
      ...items,
      { id: `new-${Date.now()}-${items.length}`, text: "" },
    ]);
  };

  const handleReorderNewTemplateItems = (draggedId: string, targetId: string) => {
    setNewTemplateItems((items) => {
      const fromIndex = items.findIndex((item) => item.id === draggedId);
      const toIndex = items.findIndex((item) => item.id === targetId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return items;
      }

      const updatedItems = [...items];
      const [movedItem] = updatedItems.splice(fromIndex, 1);
      updatedItems.splice(toIndex, 0, movedItem);
      return updatedItems;
    });
  };

  const updateNewTemplateItem = (id: string, text: string) => {
    setNewTemplateItems((items) =>
      items.map((item) => (item.id === id ? { ...item, text } : item)),
    );
  };

  const removeNewTemplateItem = (id: string) => {
    setNewTemplateItems((items) => items.filter((item) => item.id !== id));
    setConfirmDeleteTemplateItem(null);
  };

  const replaceDuplicateType = () => {
    if (!duplicateType) return;
    if (templateHasMaintenanceSchedule(duplicateType)) {
      showStructureLockedMessage();
      return;
    }

    const replacementItems = duplicateTypeSource
      ? (templates[duplicateTypeSource] ?? [])
      : newTemplateItems.filter((item) => item.text.trim() !== "");
    const newTemplates = { ...templates, [duplicateType]: replacementItems };
    if (duplicateTypeSource && duplicateTypeSource !== duplicateType) {
      delete newTemplates[duplicateTypeSource];
    }
    setTemplates(newTemplates);
    setSelectedType(duplicateType);
    setEditingItems([...replacementItems]);
    setNewTypeName("");
    setNewTemplateItems([]);
    setIsAddingType(false);
    setEditingType(null);
    setEditingTypeValue("");
    setDuplicateType(null);
    setDuplicateTypeSource(null);
    saveChecklistTemplates(newTemplates).catch((error) => {
      console.error("Failed to replace template", error);
    });
  };

  const performDeleteType = (typeToDelete: string) => {
    if (templateHasMaintenanceSchedule(typeToDelete)) {
      setConfirmDeleteType(null);
      return;
    }

    const newTemplates = { ...templates };
    delete newTemplates[typeToDelete];
    setTemplates(newTemplates);
    saveChecklistTemplates(newTemplates).catch((error) => {
      console.error("Failed to save templates", error);
    });

    if (selectedType === typeToDelete) {
      const remainingTypes = Object.keys(newTemplates);
      if (remainingTypes.length > 0) {
        setSelectedType(remainingTypes[0]);
        setEditingItems([...newTemplates[remainingTypes[0]]]);
      } else {
        setSelectedType("");
        setEditingItems([]);
      }
    }
    setConfirmDeleteType(null);
  };

  const handleCancelEditType = () => {
    setEditingType(null);
    setEditingTypeValue("");
  };

  const hasSelectedTemplate =
    selectedType !== "" &&
    Object.prototype.hasOwnProperty.call(templates, selectedType);
  const hasTemplateSearch = searchTerm.trim().length > 0;
  const visibleTemplates = Object.keys(templates)
    .filter((type) => {
      const matchesSearch = type.toLowerCase().includes(searchTerm.trim().toLowerCase());
      const usageCount = getTemplateUsageCount(type);
      const itemCount = templates[type]?.length ?? 0;
      const matchesUsage =
        templateUsageFilter === "all" ||
        (templateUsageFilter === "used" && usageCount > 0) ||
        (templateUsageFilter === "unused" && usageCount === 0);
      const matchesSize =
        templateSizeFilter === "all" ||
        (templateSizeFilter === "empty" && itemCount === 0) ||
        (templateSizeFilter === "withItems" && itemCount > 0);

      return matchesSearch && matchesUsage && matchesSize;
    })
    .sort((left, right) => left.localeCompare(right));
  const activeTemplateFilterCount =
    (templateUsageFilter === "all" ? 0 : 1) +
    (templateSizeFilter === "all" ? 0 : 1);
  const hasChecklistItemSearch = itemFilter.trim().length > 0;
  const filteredItems = editingItems.filter((item) =>
    item.text.toLowerCase().includes(itemFilter.trim().toLowerCase()),
  );
  const templateTotalPages = Math.max(
    1,
    Math.ceil(visibleTemplates.length / itemsPerPage),
  );
  const checklistTotalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / itemsPerPage),
  );
  const activeTemplatePage = Math.min(templatePage, templateTotalPages);
  const activeChecklistPage = Math.min(checklistPage, checklistTotalPages);
  const paginatedTemplates = visibleTemplates.slice(
    (activeTemplatePage - 1) * itemsPerPage,
    activeTemplatePage * itemsPerPage,
  );
  const paginatedItems = filteredItems.slice(
    (activeChecklistPage - 1) * itemsPerPage,
    activeChecklistPage * itemsPerPage,
  );

  const openTemplateModal = (type: string, mode: "view" | "edit") => {
    if (editingType === type) return;
    setSelectedType(type);
    setChecklistPage(1);
    setItemFilter("");
    const items = Object.prototype.hasOwnProperty.call(templates, type)
      ? [...templates[type]]
      : [];
    setEditingItems(items);
    setIsEditingChecklist(mode === "edit");
    setEditingType(mode === "edit" ? type : null);
    setEditingTypeValue(mode === "edit" ? type : "");
    setIsTemplateModalOpen(true);
  };

  const selectTemplate = (type: string) => {
    openTemplateModal(type, "view");
  };

  const openTemplateForEdit = (type: string) => {
    if (templateHasMaintenanceSchedule(type)) {
      showStructureLockedMessage();
      return;
    }
    openTemplateModal(type, "edit");
  };

  const closeTemplateModal = (shouldSave = false) => {
    if (shouldSave && (isEditingChecklist || editingType === selectedType)) {
      const committed = commitTemplateModalChanges();
      if (!committed) return;
    }
    setIsTemplateModalOpen(false);
    setIsEditingChecklist(false);
    setEditingType(null);
    setEditingTypeValue("");
    setItemFilter("");
    setChecklistPage(1);
    if (selectedType) {
      setEditingItems([...templates[selectedType] ?? []]);
    }
  };

  return (
    <div className={containerClasses}>
      <div className="fixed right-6 top-6 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toast && <ToastNotification type={toast.type} message={toast.message} />}
      </div>

      <PageHeader
        icon={ClipboardCheck}
        title={"CHECKLIST TEMPLATES"}
        subtitle={"Manage and configure checklist templates"}
      />

      <section className="space-y-5">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                className="w-full sm:w-96"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setTemplatePage(1);
                }}
                placeholder="Search templates..."
              />

              <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDraftUsageFilter(templateUsageFilter);
                    setDraftSizeFilter(templateSizeFilter);
                    setShowTemplateFilters((current) => !current);
                  }}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                    showTemplateFilters || activeTemplateFilterCount > 0
                      ? "border-[#070b45] bg-[#f6f8fc]"
                      : "border-[#d8dee8] bg-[#f6f8fc] hover:border-[#070b45]"
                  }`}
                  aria-expanded={showTemplateFilters}
                  aria-label="Filter checklist templates"
                >
                  <Filter className="h-5 w-5 text-[#63728a]" strokeWidth={2.4} />
                  {activeTemplateFilterCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#070b45] px-1 text-[10px] font-bold text-white">
                      {activeTemplateFilterCount}
                    </span>
                  ) : null}
                </button>

                {showTemplateFilters ? (
                  <div
                    className="absolute left-0 top-12 z-40 w-[min(92vw,540px)] rounded-xl border border-[#e0e5ee] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.18)] animate-in fade-in zoom-in-95 duration-150"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <h3 className="text-xl font-extrabold text-[#141827]">
                      Filter by
                    </h3>
                    <div className="my-5 h-px bg-[#dde3eb]" />

                    <div className="space-y-6">
                      <div>
                        <p className="text-sm font-bold text-black">Usage</p>
                        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                          {[
                            ["all", "All Templates"],
                            ["used", "Used in schedules"],
                            ["unused", "Unused"],
                          ].map(([value, label]) => (
                            <label key={value} className="flex cursor-pointer items-center gap-3 text-base font-semibold text-[#141827]">
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                                  draftUsageFilter === value
                                    ? "border-[#070b45] bg-[#eef2ff]"
                                    : "border-[#cbd3df] bg-white"
                                }`}
                              />
                              <input
                                type="radio"
                                name="templateUsageFilter"
                                value={value}
                                checked={draftUsageFilter === value}
                                onChange={() => setDraftUsageFilter(value as "all" | "used" | "unused")}
                                className="sr-only"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="h-px bg-[#dde3eb]" />

                      <div>
                        <p className="text-sm font-bold text-black">Checklist items</p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          {[
                            ["all", "Any item count"],
                            ["withItems", "Has checklist items"],
                            ["empty", "No checklist items"],
                          ].map(([value, label]) => (
                            <label key={value} className="block">
                              <span className="text-sm font-semibold text-[#64748b]">
                                {label}
                              </span>
                              <button
                                type="button"
                                onClick={() => setDraftSizeFilter(value as "all" | "empty" | "withItems")}
                                className={`mt-2 h-10 w-full rounded-xl border px-4 text-left text-sm transition ${
                                  draftSizeFilter === value
                                    ? "border-[#070b45] bg-[#eef2ff] font-semibold text-[#070b45]"
                                    : "border-[#d8dee8] bg-white text-[#141827] hover:border-[#070b45]"
                                }`}
                              >
                                {label}
                              </button>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateUsageFilter(draftUsageFilter);
                          setTemplateSizeFilter(draftSizeFilter);
                          setTemplatePage(1);
                          setShowTemplateFilters(false);
                        }}
                        className="h-10 rounded-lg bg-[#070b45] text-sm font-bold text-white transition hover:bg-[#11175f]"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftUsageFilter("all");
                          setDraftSizeFilter("all");
                          setTemplateUsageFilter("all");
                          setTemplateSizeFilter("all");
                          setTemplatePage(1);
                          setShowTemplateFilters(false);
                        }}
                        className="h-10 rounded-lg border-2 border-[#070b45] bg-white text-sm font-bold text-[#070b45] transition hover:bg-[#f6f8fc]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <LegendHelp
                title="Template Legend"
                items={[
                  { label: "Used", description: "Template is already attached to one or more schedules.", tone: "#0f766e" },
                  { label: "Unused", description: "Template is available but not yet used by schedules.", tone: "#64748b" },
                  { label: "Has Items", description: "Template contains checklist steps.", tone: "#2563eb" },
                  { label: "Empty", description: "Template has no checklist steps yet.", tone: "#dc2626" },
                ]}
              />
              </div>
            </div>

            <ActionButton className="w-full sm:w-auto" onClick={openAddTemplateModal}>
              <Plus className="h-4 w-4" />
              Add New Type
            </ActionButton>
          </div>
        </div>

      {paginatedTemplates.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedTemplates.map((type) => {
              const usageCount = getTemplateUsageCount(type);
              const itemCount = templates[type]?.length ?? 0;
              const isActive = selectedType === type;

              return (
                <article
                  key={type}
                  className={`enterprise-card flex min-h-40 flex-col justify-between p-5 ${
                    isActive ? "border-[#1a1f6e] bg-[#f8faff]" : ""
                  }`}
                  onClick={() => selectTemplate(type)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 text-left">
                      <h2 className="truncate text-base font-bold text-[#141827]">
                        {type}
                      </h2>
                      <p className="mt-2 text-sm text-[#64748b]">
                        {itemCount} checklist item{itemCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ActionMenu
                      open={openTemplateActionMenuId === type}
                      onToggle={(event) => {
                        event.stopPropagation();
                        setOpenTemplateActionMenuId((current) =>
                          current === type ? null : type,
                        );
                      }}
                      items={[
                        {
                          label: "View",
                          icon: ClipboardCheck,
                          onClick: () => {
                            setOpenTemplateActionMenuId(null);
                            openTemplateModal(type, "view");
                          },
                        },
                        {
                          label: "Edit",
                          icon: Edit,
                          onClick: () => {
                            setOpenTemplateActionMenuId(null);
                            openTemplateForEdit(type);
                          },
                        },
                        {
                          label: "Delete",
                          icon: Trash2,
                          danger: true,
                          onClick: () => {
                            setOpenTemplateActionMenuId(null);
                            if (templateHasMaintenanceSchedule(type)) {
                              setBlockedDeleteType(type);
                            } else {
                              setConfirmDeleteType(type);
                            }
                          },
                        },
                      ]}
                    />
                  </div>
                  <div className="mt-6 border-t border-slate-200 pt-4 text-sm">
                    <span className="text-[#64748b]">
                      Used in {usageCount} schedule{usageCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 font-bold text-[#141827]">
              {hasTemplateSearch ? "No templates match your search." : "No templates yet."}
            </p>
            <p className="mt-1 text-sm text-[#64748b]">
              {hasTemplateSearch ? "Try a different keyword." : "Add a checklist type to get started."}
            </p>
          </div>
        )}

        {visibleTemplates.length > itemsPerPage ? (
          <Pagination
            page={activeTemplatePage}
            totalPages={templateTotalPages}
            totalItems={visibleTemplates.length}
            pageSize={itemsPerPage}
            pageSizeOptions={[itemsPerPage]}
            onPageChange={setTemplatePage}
            onPageSizeChange={() => undefined}
          />
        ) : null}
      </section>

      {isAddingType && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay z-[70]">
          <div className="modal-content w-full max-w-2xl p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#141827]">
                  Add Checklist Template
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Create a new checklist type, then add checklist items.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeAddTemplateModal();
                }}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[#64748b] transition hover:bg-[var(--color-card-bg-hover)] hover:text-[#141827]"
                aria-label="Close add template"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-sm font-semibold text-[#334155]" htmlFor="new-template-name">
              Template Name
            </label>
            <input
              id="new-template-name"
              type="text"
              value={newTypeName}
              onChange={(event) => setNewTypeName(event.target.value)}
              placeholder="e.g., Cooling System Inspection"
              className="mt-2 h-10 w-full rounded-xl border border-[#cbd3df] bg-white px-3 text-sm text-[#141827] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAddType();
                if (event.key === "Escape") closeAddTemplateModal();
              }}
            />
            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#141827]">Checklist Items</h3>
                  <p className="mt-1 text-xs text-[#64748b]">Add the first items now, or leave them blank and edit later.</p>
                </div>
                <button
                  type="button"
                  onClick={addNewTemplateItem}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#cbd3df] px-4 text-sm font-bold text-[#070b45] transition hover:bg-[#f8faff]"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {newTemplateItems.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedItemId(item.id)}
                    onDragEnd={() => setDraggedItemId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!draggedItemId || draggedItemId === item.id) {
                        setDraggedItemId(null);
                        return;
                      }
                      handleReorderNewTemplateItems(draggedItemId, item.id);
                      setDraggedItemId(null);
                    }}
                    className={`flex items-center gap-3 rounded-xl transition ${
                      draggedItemId === item.id ? "bg-[#f6f8fc]" : ""
                    }`}
                  >
                    <span className="flex h-10 w-14 shrink-0 cursor-grab items-center justify-center gap-1 rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                      <GripVertical className="h-4 w-4 text-slate-400" />
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={item.text}
                      onChange={(event) =>
                        updateNewTemplateItem(item.id, event.target.value)
                      }
                      placeholder="Enter checklist item..."
                      className="h-10 flex-1 rounded-xl border border-[#cbd3df] bg-white px-3 text-sm text-[#141827] outline-none focus:border-[#070b45]"
                    />
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTemplateItem(item.id)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#ff4040] transition hover:bg-[#fff1f1]"
                      aria-label="Remove checklist item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {newTemplateItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-[#64748b]">
                    No checklist items added yet.
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <ActionButton
                variant="secondary"
                onClick={closeAddTemplateModal}
              >
                Cancel
              </ActionButton>
              <ActionButton onClick={() => setConfirmAddType(true)} disabled={!newTypeName.trim()}>
                Create Template
              </ActionButton>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isTemplateModalOpen && hasSelectedTemplate && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay z-[70]">
          <div className="modal-content flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col">
            <div className="flex shrink-0 flex-col gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                {editingType === selectedType ? (
                  <div className="max-w-3xl">
                    <input
                      type="text"
                      value={editingTypeValue}
                      onChange={(event) => setEditingTypeValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-[#cbd3df] bg-white px-4 text-base font-bold text-[#141827] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-xl font-bold text-[#141827]">
                      {selectedType}
                    </h2>
                    <button
                      type="button"
                      onClick={() => openTemplateForEdit(selectedType)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-slate-100 hover:text-[#070b45]"
                      title="Edit template title"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <p className="mt-1 text-sm text-[#64748b]">
                  Checklist template details
                </p>
              </div>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => closeTemplateModal(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[#64748b] transition hover:bg-[var(--color-card-bg-hover)] hover:text-[#141827]"
                  aria-label="Close checklist template"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-5">
              <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-center lg:justify-between">
                <SearchInput
                  className="w-full sm:w-96"
                  value={itemFilter}
                  onChange={(event) => {
                    setItemFilter(event.target.value);
                    setChecklistPage(1);
                  }}
                  placeholder="Filter checklist items..."
                />
                <p className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#64748b]">
                  Showing {paginatedItems.length} of {filteredItems.length} matching item{filteredItems.length === 1 ? "" : "s"}
                </p>
              </div>

              <DataTable
                data={paginatedItems}
                getRowKey={(item) => item.id}
                minWidth="760px"
                emptyMessage={
                  hasChecklistItemSearch
                    ? "No checklist items match your filter."
                    : "This template has no checklist items."
                }
                columns={[
                  {
                    key: "order",
                    header: "item no.",
                    width: "104px",
                    render: (item) =>
                      (activeChecklistPage - 1) * itemsPerPage +
                      filteredItems.findIndex((current) => current.id === item.id) +
                      1,
                  },
                  {
                    key: "item",
                    header: "Checklist Item",
                    width: "auto",
                    render: (item) =>
                      isEditingChecklist ? (
                        <div
                          draggable
                          onDragStart={() => setDraggedItemId(item.id)}
                          onDragEnd={() => setDraggedItemId(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (!draggedItemId || draggedItemId === item.id) {
                              setDraggedItemId(null);
                              return;
                            }
                            handleReorderItems(draggedItemId, item.id);
                            setDraggedItemId(null);
                          }}
                          className={`flex items-center gap-4 ${
                            draggedItemId === item.id ? "text-[#070b45]" : ""
                          }`}
                        >
                          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#64748b]" />
                          <input
                            type="text"
                            value={item.text}
                            onChange={(event) =>
                              handleUpdateItem(item.id, event.target.value)
                            }
                            placeholder="Enter checklist task description..."
                            className="h-10 w-full rounded-xl border border-[#cbd3df] bg-white px-3 text-sm text-[#141827] outline-none focus:border-[#070b45]"
                          />
                        </div>
                      ) : (
                        <span className="text-[#141827]">
                          {item.text || "Untitled checklist item"}
                        </span>
                      ),
                  },
                ]}
              />

              {filteredItems.length > itemsPerPage ? (
                <Pagination
                  page={activeChecklistPage}
                  totalPages={checklistTotalPages}
                  totalItems={filteredItems.length}
                  pageSize={itemsPerPage}
                  pageSizeOptions={[itemsPerPage]}
                  onPageChange={setChecklistPage}
                  onPageSizeChange={() => undefined}
                />
              ) : null}
            </div>
            {isEditingChecklist ? (
              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white px-6 py-5 sm:flex-row sm:justify-end">
                <ActionButton
                  variant="secondary"
                  onClick={() => closeTemplateModal(false)}
                >
                  Cancel
                </ActionButton>
                <ActionButton onClick={() => closeTemplateModal(true)}>
                  Save Changes
                </ActionButton>
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      )}

      <ConfirmationModal
        isOpen={confirmAddType}
        message={
          <>
            Are you sure you want to add this checklist template?
            <span className="mt-2 block font-bold">{newTypeName.trim()}</span>
          </>
        }
        confirmLabel="Yes"
        onConfirm={() => {
          setConfirmAddType(false);
          handleAddType();
        }}
        onCancel={() => setConfirmAddType(false)}
      />

      <ConfirmationModal
        isOpen={Boolean(confirmDeleteTemplateItem)}
        variant="danger"
        message={
          <>
            Are you sure you want to delete this checklist item?
            <span className="mt-2 block font-bold">
              {newTemplateItems.find((item) => item.id === confirmDeleteTemplateItem)?.text ||
                "Untitled checklist item"}
            </span>
          </>
        }
        confirmLabel="Yes"
        onConfirm={() => {
          if (confirmDeleteTemplateItem) {
            removeNewTemplateItem(confirmDeleteTemplateItem);
          }
        }}
        onCancel={() => setConfirmDeleteTemplateItem(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(confirmDeleteType)}
        variant="danger"
        message={
          confirmDeleteType ? (
            <>
              Are you sure you want to delete this checklist template?
              <span className="mt-2 block font-bold">{confirmDeleteType}</span>
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Yes"
        onConfirm={() => {
          if (confirmDeleteType) performDeleteType(confirmDeleteType);
        }}
        onCancel={() => setConfirmDeleteType(null)}
      />

      {blockedDeleteType && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay z-[60]">
          <div className="modal-content w-full max-w-md p-6">
            <h3 className="mb-3 text-lg font-bold text-[var(--color-text-primary)]">
              Template Cannot Be Deleted
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              <span className="font-semibold text-[var(--color-text-primary)]">
                {blockedDeleteType}
              </span>{" "}
              Checklist Template cannot be deleted because it is currently
              being used by active records.
            </p>
            <dl className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-secondary)]">Usage count</dt>
                <dd className="font-semibold text-[var(--color-text-primary)]">
                  {getTemplateUsageCount(blockedDeleteType)}
                </dd>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <dt className="text-[var(--color-text-secondary)]">Maintenance schedules</dt>
                <dd className="font-semibold text-[var(--color-text-primary)]">
                  {getTemplateUsageCount(blockedDeleteType)}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setBlockedDeleteType(null)}
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {duplicateType && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay z-[60]">
          <div className="modal-content w-full max-w-md p-6">
            <h3 className="mb-3 text-lg font-bold text-[var(--color-text-primary)]">
              Existing Checklist Template
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              A template named{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {duplicateType}
              </span>{" "}
              already exists.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDuplicateType(null);
                  if (duplicateTypeSource) {
                    handleCancelEditType();
                  } else {
                    setNewTypeName("");
                    setNewTemplateItems([]);
                    setIsAddingType(false);
                  }
                  setDuplicateTypeSource(null);
                }}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-input-bg)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setDuplicateType(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-input-bg)]"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={replaceDuplicateType}
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90"
              >
                Replace
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

    </div>
  );
}
