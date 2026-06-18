import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Plus,
  Trash2,
  GripVertical,
  Edit,
  Save,
  X,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  getChecklistTemplates,
  getMaintenanceSchedules,
  saveChecklistTemplates,
} from "../../lib/api/maintenanceService";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import type { MaintenanceTask } from "../../types/maintenance";

type WorkOrderTemplate = string;

interface ChecklistItemTemplate {
  id: string;
  text: string;
}

// Layout & interaction classes
const containerClasses = 'space-y-6';
const layoutClasses = 'flex flex-col lg:flex-row gap-6 items-start';
const sidebarContainerClasses = 'w-full lg:w-1/3 xl:w-1/4 lg:sticky lg:top-6';
const sidebarCardClasses = 'rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 h-full shadow-card';
const sidebarHeadingClasses = 'text-sm font-bold text-[var(--color-text-primary)] mb-4 px-2';
const templateListClasses = 'space-y-1 max-h-[420px] overflow-y-auto pr-1';
const templateButtonBaseClasses = 'group w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200';
const templateButtonSelectedClasses = 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] border border-[var(--color-brand-primary)]/20 shadow-[0_0_15px_rgba(26,31,110,0.1)]';
const templateButtonUnselectedClasses = 'text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] border border-transparent';
const addTypeContainerClasses = 'mb-4 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] flex flex-col gap-2';
const addTypeInputClasses = 'w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)]';
const addTypeButtonGroupClasses = 'flex justify-end gap-2';
const addTypeCancelClasses = 'text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2 py-1';
const addTypeSubmitClasses = 'text-xs bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/15 px-3 py-1 rounded-md font-medium';
const addNewTypeButtonClasses = 'mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] transition-all text-sm font-medium';
const contentContainerClasses = 'w-full lg:w-2/3 xl:w-3/4';
const contentCardClasses = 'rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 flex flex-col min-h-[420px] lg:min-h-[540px] shadow-card';
const headerSectionClasses = 'flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--color-border)]';
const addItemButtonClasses = 'flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-primary)] transition-colors text-sm font-medium hover:bg-[var(--color-card-bg-hover)]';
const saveButtonClasses = 'flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] transition-colors text-sm font-medium hover:bg-[var(--color-brand-primary)]/15';
const itemsContainerClasses = 'flex-1 space-y-3 overflow-y-auto pr-1';
const emptyStateClasses = 'flex flex-col items-center justify-center h-full min-h-[240px] text-[var(--color-text-secondary)] gap-4 py-12';
const checklistItemClasses = 'flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2.5 group hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-card-bg-hover)] transition-colors';
const checklistInputClasses = 'flex-1 bg-transparent border-none text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-0 placeholder:text-[var(--color-text-secondary)]';
const deleteItemButtonClasses = 'p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-brand-danger)] hover:bg-[var(--color-brand-danger)]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100';

export default function WorkOrderTemplates() {
  const itemsPerPage = 8;
  const [templates, setTemplates] = useState<
    Record<WorkOrderTemplate, ChecklistItemTemplate[]>
  >({});
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<
    MaintenanceTask[]
  >([]);
  const [selectedType, setSelectedType] = useState<WorkOrderTemplate>("");
  const [editingItems, setEditingItems] = useState<ChecklistItemTemplate[]>([]);
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [templatePage, setTemplatePage] = useState(1);
  const [checklistPage, setChecklistPage] = useState(1);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState<string>("");
  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<string | null>(null);
  const [blockedDeleteType, setBlockedDeleteType] = useState<string | null>(
    null,
  );
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ChecklistItemTemplate | null>(null);
  const [duplicateType, setDuplicateType] = useState<string | null>(null);
  const [duplicateTypeSource, setDuplicateTypeSource] = useState<string | null>(
    null,
  );

  useBodyScrollLock(
    Boolean(
      confirmDeleteType ||
        blockedDeleteType ||
        confirmDeleteItem ||
        duplicateType,
    ),
  );

  const templateHasMaintenanceSchedule = (type: string) =>
    maintenanceSchedules.some(
      (schedule) =>
        schedule.title.trim().toLowerCase() === type.trim().toLowerCase(),
    );

  useEffect(() => {
    getChecklistTemplates()
      .then((loadedTemplates) => {
        setTemplates(loadedTemplates);
        const availableTypes = Object.keys(loadedTemplates);
        const initialType = availableTypes.length > 0 ? availableTypes[0] : "";
        setSelectedType(initialType as WorkOrderTemplate);
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

  const handleAddItem = () => {
    if (!selectedType || !isEditingChecklist) return;
    const newItem: ChecklistItemTemplate = {
      id: Date.now().toString(),
      text: "",
    };
    setEditingItems((items) => [...items, newItem]);
    setChecklistPage(Math.ceil((editingItems.length + 1) / itemsPerPage));
  };

  const handleUpdateItem = (id: string, text: string) => {
    setEditingItems((items) =>
      items.map((item) => (item.id === id ? { ...item, text } : item)),
    );
  };

  const handleDeleteItem = (item: ChecklistItemTemplate) => {
    const isUnsavedItem = !(
      templates[selectedType] ?? []
    ).some((savedItem) => savedItem.id === item.id);

    if (isUnsavedItem && item.text.trim() === "") {
      setEditingItems((items) =>
        items.filter((currentItem) => currentItem.id !== item.id),
      );
      return;
    }

    setConfirmDeleteItem(item);
  };

  const handleReorderItems = (draggedId: string, targetId: string) => {
    if (!isEditingChecklist) return;

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

  const handleCancelEditChecklist = () => {
    if (!selectedType) return;

    setEditingItems([...templates[selectedType] ?? []]);
    setIsEditingChecklist(false);
  };

  const handleSave = () => {
    if (!canSaveTemplate) return;

    const saveableItems = editingItems.filter(
      (item) => item.text.trim() !== "",
    );
    const newTemplates = {
      ...templates,
      [selectedType]: saveableItems,
    };
    setEditingItems(saveableItems);
    setTemplates(newTemplates);
    saveChecklistTemplates(newTemplates).catch((error) => {
      console.error("Failed to save templates", error);
    });
    setIsEditingChecklist(false);
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

    const newTemplates = { [trimmed]: [], ...templates };
    setTemplates(newTemplates);
    saveChecklistTemplates(newTemplates).catch((error) => {
      console.error("Failed to save templates", error);
    });
    setNewTypeName("");
    setIsAddingType(false);
    setSelectedType(trimmed);
    setTemplatePage(1);
    setChecklistPage(1);
    setEditingItems([]);
  };

  const replaceDuplicateType = () => {
    if (!duplicateType) return;
    if (
      duplicateTypeSource &&
      templateHasMaintenanceSchedule(duplicateTypeSource)
    ) {
      window.alert(
        "This template cannot be replaced because it has a maintenance schedule.",
      );
      return;
    }

    const replacementItems = duplicateTypeSource
      ? (templates[duplicateTypeSource] ?? [])
      : [];
    const newTemplates = { ...templates, [duplicateType]: replacementItems };
    if (duplicateTypeSource && duplicateTypeSource !== duplicateType) {
      delete newTemplates[duplicateTypeSource];
    }
    setTemplates(newTemplates);
    setSelectedType(duplicateType);
    setEditingItems([...replacementItems]);
    setNewTypeName("");
    setIsAddingType(false);
    setEditingType(null);
    setEditingTypeValue("");
    setDuplicateType(null);
    setDuplicateTypeSource(null);
    saveChecklistTemplates(newTemplates).catch((error) => {
      console.error("Failed to replace template", error);
    });
  };

  const handleDeleteType = (typeToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (templateHasMaintenanceSchedule(typeToDelete)) {
      setBlockedDeleteType(typeToDelete);
      return;
    }
    setConfirmDeleteType(typeToDelete);
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

  const handleStartEditType = (type: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingType(type);
    setEditingTypeValue(type);
  };

  const handleCancelEditType = () => {
    setEditingType(null);
    setEditingTypeValue("");
  };

  const handleSubmitEditType = (oldType: string) => {
    const trimmed = editingTypeValue.trim();
    if (!trimmed) {
      handleCancelEditType();
      return;
    }
    if (trimmed === oldType) {
      handleCancelEditType();
      return;
    }
    if (templateHasMaintenanceSchedule(oldType)) {
      window.alert(
        "This template cannot be renamed because it has a maintenance schedule.",
      );
      return;
    }
    const existingType = Object.keys(templates).find(
      (type) =>
        type !== oldType && type.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existingType) {
      setDuplicateType(existingType);
      setDuplicateTypeSource(oldType);
      return;
    }
    const newTemplates: Record<WorkOrderTemplate, ChecklistItemTemplate[]> = {
      ...templates,
    };
    newTemplates[trimmed] = newTemplates[oldType] ?? [];
    delete newTemplates[oldType];
    setTemplates(newTemplates);
    saveChecklistTemplates(newTemplates).catch((error) => {
      console.error("Failed to save templates", error);
    });
    if (selectedType === oldType) {
      setSelectedType(trimmed);
      setEditingItems([...newTemplates[trimmed]]);
    }
    setEditingType(null);
    setEditingTypeValue("");
  };

  const hasSelectedTemplate =
    selectedType !== "" &&
    Object.prototype.hasOwnProperty.call(templates, selectedType);
  const canSaveTemplate = hasSelectedTemplate;
  const hasTemplateSearch = searchTerm.trim().length > 0;
  const visibleTemplates = Object.keys(templates).filter((type) =>
    type.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );
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

  return (
    <div className={containerClasses}>
      <PageHeader
        icon={ClipboardCheck}
        title={"Work Order Templates"}
        subtitle={"Manage and configure work order templates"}
      />

      <div className={layoutClasses}>
        {/* Sidebar for Maintenance Types */}
        <div className={sidebarContainerClasses}>
          <div className={sidebarCardClasses}>
            <h2 className={sidebarHeadingClasses}>
              {"Work Order Templates"}
            </h2>
            <div className="mb-3">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setTemplatePage(1);
                }}
                placeholder="Search templates..."
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
              />
            </div>
            {isAddingType ? (
              <div className={addTypeContainerClasses}>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder={"Type name..."}
                  className={addTypeInputClasses}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddType();
                    if (e.key === "Escape") {
                      setIsAddingType(false);
                      setNewTypeName("");
                    }
                  }}
                />
                <div className={addTypeButtonGroupClasses}>
                  <button
                    onClick={() => {
                      setIsAddingType(false);
                      setNewTypeName("");
                    }}
                    className={addTypeCancelClasses}
                  >
                    {"Cancel"}
                  </button>
                  <button
                    onClick={handleAddType}
                    className={addTypeSubmitClasses}
                  >
                    {"Add"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingType(true)}
                className={addNewTypeButtonClasses}
              >
                <Plus className="w-4 h-4" />
                {"Add New Type"}
              </button>
            )}
            <div className={templateListClasses}>
              {visibleTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-4 text-sm text-[var(--color-text-secondary)]">
                  {hasTemplateSearch
                    ? "No templates match your search."
                    : "No templates yet. Add a new type to get started."}
                </div>
              ) : (
                paginatedTemplates.map((type) => (
                  <div
                    key={type}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (editingType === type) return;
                      setSelectedType(type);
                      setChecklistPage(1);
                      setIsEditingChecklist(false);
                      if (Object.prototype.hasOwnProperty.call(templates, type)) {
                        setEditingItems([...templates[type]]);
                      } else {
                        setEditingItems([]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (editingType === type) return;
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedType(type);
                        setChecklistPage(1);
                        setIsEditingChecklist(false);
                        if (Object.prototype.hasOwnProperty.call(templates, type)) {
                          setEditingItems([...templates[type]]);
                        } else {
                          setEditingItems([]);
                        }
                      }
                    }}
                    className={`${templateButtonBaseClasses} ${
                      selectedType === type
                        ? templateButtonSelectedClasses
                        : templateButtonUnselectedClasses
                    }`}
                  >
                    {editingType === type ? (
                      <input
                        type="text"
                        value={editingTypeValue}
                        onChange={(e) => setEditingTypeValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSubmitEditType(type);
                          if (e.key === "Escape") handleCancelEditType();
                        }}
                        className="flex-1 min-w-0 pr-2 bg-transparent border-none text-[var(--color-text-primary)] text-sm font-medium focus:outline-none truncate"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-sm truncate flex-1 min-w-0">{type}</span>
                    )}
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium bg-[var(--color-input-bg)] px-2 py-0.5 rounded-full text-[var(--color-text-primary)] border border-[var(--color-border)]">
                        {Object.prototype.hasOwnProperty.call(templates, type)
                          ? templates[type].length
                          : 0}
                      </span>
                      {editingType === type ? (
                        <>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubmitEditType(type);
                            }}
                            className="opacity-100 p-1 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] rounded transition-all"
                            title={"Save Type"}
                          >
                            <Save className="w-3.5 h-3.5" />
                          </div>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEditType();
                            }}
                            className="opacity-100 p-1 hover:bg-[var(--color-brand-danger)]/10 hover:text-[var(--color-brand-danger)] rounded transition-all"
                            title={"Cancel Type Edit"}
                          >
                            <X className="w-3.5 h-3.5" />
                          </div>
                        </>
                      ) : (
                        <div
                          onClick={(e) => handleStartEditType(type, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--color-brand-primary)]/10 hover:text-[var(--color-brand-primary)] rounded transition-all"
                          title={"Edit Type"}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div
                        onClick={(e) => handleDeleteType(type, e)}
                        className={`p-1 rounded transition-all ${
                          templateHasMaintenanceSchedule(type)
                            ? "cursor-not-allowed opacity-30"
                            : "opacity-0 group-hover:opacity-100 hover:bg-[var(--color-brand-danger)]/20 hover:text-[var(--color-brand-danger)]"
                        }`}
                        title={
                          templateHasMaintenanceSchedule(type)
                            ? "Cannot delete a template used by a maintenance schedule"
                            : "Delete Type"
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {visibleTemplates.length > itemsPerPage ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-secondary)]">
                <button
                  type="button"
                  onClick={() => setTemplatePage(Math.max(1, activeTemplatePage - 1))}
                  disabled={activeTemplatePage === 1}
                  className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span>Page {activeTemplatePage} of {templateTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setTemplatePage(Math.min(templateTotalPages, activeTemplatePage + 1))}
                  disabled={activeTemplatePage === templateTotalPages}
                  className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
                {templateTotalPages >= 20 ? (
                  <label className="flex items-center gap-1.5">
                    <span>Go to</span>
                    <input
                      type="number"
                      min={1}
                      max={templateTotalPages}
                      placeholder={String(activeTemplatePage)}
                      aria-label="Go to template page"
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        if (!event.currentTarget.value.trim()) return;
                        const requestedPage = Number(event.currentTarget.value);
                        if (!Number.isFinite(requestedPage)) return;
                        setTemplatePage(
                          Math.min(
                            templateTotalPages,
                            Math.max(1, Math.trunc(requestedPage)),
                          ),
                        );
                        event.currentTarget.value = "";
                      }}
                      className="w-14 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1.5 text-center text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Main Content Area */}
        <div className={contentContainerClasses}>
          <div className={contentCardClasses}>
            <div className={headerSectionClasses}>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {"Configure the checklist items mechanics must complete."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isEditingChecklist ? (
                  <button
                    type="button"
                    onClick={handleCancelEditChecklist}
                    className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-card-bg-hover)]"
                  >
                    Cancel Edit
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingChecklist) {
                      handleSave();
                    } else {
                      setIsEditingChecklist(true);
                    }
                  }}
                  disabled={!hasSelectedTemplate || (!canSaveTemplate && isEditingChecklist)}
                  className={`${isEditingChecklist ? saveButtonClasses : addItemButtonClasses} ${hasSelectedTemplate && (!isEditingChecklist || canSaveTemplate) ? "" : "cursor-not-allowed opacity-50"}`}
                >
                  {isEditingChecklist ? "Save Checklist" : "Edit Checklist"}
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={!hasSelectedTemplate || !isEditingChecklist}
                  className={`${addItemButtonClasses} ${hasSelectedTemplate && isEditingChecklist ? "" : "cursor-not-allowed opacity-50"}`}
                >
                  <Plus className="w-4 h-4" />
                  {"Add Item"}
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                value={itemFilter}
                onChange={(e) => {
                  setItemFilter(e.target.value);
                  setChecklistPage(1);
                }}
                placeholder="Filter checklist items..."
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none sm:max-w-xs"
              />
              <p className="text-xs text-[var(--color-text-secondary)]">
                Showing {paginatedItems.length} of {filteredItems.length} matching item{filteredItems.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className={itemsContainerClasses}>
              {filteredItems.length === 0 ? (
                <div className={emptyStateClasses}>
                  <ClipboardCheck className="w-12 h-12 opacity-50" />
                  <div className="text-center">
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      {hasChecklistItemSearch
                        ? "No checklist items match your filter."
                        : hasSelectedTemplate
                          ? "This template has no checklist items."
                          : "Select or create a work order template."}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {hasChecklistItemSearch
                        ? "Try a different search term."
                        : hasSelectedTemplate
                          ? "Choose Edit Checklist, then Add Item to begin."
                          : "Templates and their checklist items will appear here."}
                    </p>
                  </div>
                </div>
              ) : (
                paginatedItems.map((item, index) => (
                  <div
                    key={item.id}
                    draggable={isEditingChecklist}
                    onDragStart={() => setDraggedItemId(item.id)}
                    onDragEnd={() => setDraggedItemId(null)}
                    onDragOver={(event) => {
                      if (!isEditingChecklist) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();

                      if (!draggedItemId || draggedItemId === item.id || !isEditingChecklist) {
                        setDraggedItemId(null);
                        return;
                      }

                      handleReorderItems(draggedItemId, item.id);
                      setDraggedItemId(null);
                    }}
                    className={`${checklistItemClasses} ${
                      draggedItemId === item.id ? "border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-primary)]/10" : ""
                    }`}
                  >
                    <div className="cursor-grab text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="w-6 h-6 shrink-0 rounded-full bg-[var(--color-border)] text-[var(--color-text-secondary)] flex items-center justify-center text-xs font-bold border border-[var(--color-border)]">
                      {(activeChecklistPage - 1) * itemsPerPage + index + 1}
                    </div>

                    {isEditingChecklist ? (
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) =>
                          handleUpdateItem(item.id, e.target.value)
                        }
                        placeholder={"Enter checklist task description..."}
                        className={checklistInputClasses}
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 text-sm text-[var(--color-text-primary)]">
                        {item.text || "Untitled checklist item"}
                      </span>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className={deleteItemButtonClasses}
                        title={"Delete item"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {filteredItems.length > itemsPerPage ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
                <span>8 checklist items per page</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setChecklistPage(Math.max(1, activeChecklistPage - 1))}
                    disabled={activeChecklistPage === 1}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>Page {activeChecklistPage} of {checklistTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setChecklistPage(Math.min(checklistTotalPages, activeChecklistPage + 1))}
                    disabled={activeChecklistPage === checklistTotalPages}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                  {checklistTotalPages >= 20 ? (
                    <label className="flex items-center gap-2">
                      <span>Go to</span>
                      <input
                        type="number"
                        min={1}
                        max={checklistTotalPages}
                        placeholder={String(activeChecklistPage)}
                        aria-label="Go to checklist page"
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          if (!event.currentTarget.value.trim()) return;
                          const requestedPage = Number(event.currentTarget.value);
                          if (!Number.isFinite(requestedPage)) return;
                          setChecklistPage(
                            Math.min(
                              checklistTotalPages,
                              Math.max(1, Math.trunc(requestedPage)),
                            ),
                          );
                          event.currentTarget.value = "";
                        }}
                        className="w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1.5 text-center text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {confirmDeleteType && (
        <div className="modal-overlay px-4 backdrop-blur-sm">
          <div className="modal-content">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
              Confirm Delete
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Are you sure you want to delete this work order template?
              <br />
              <span className="mt-2 block font-bold text-[var(--color-text-primary)]">"{confirmDeleteType}"</span>
              <br />
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteType(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-input-bg)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performDeleteType(confirmDeleteType)}
                className="rounded-xl bg-[var(--color-brand-danger)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-danger)]/80"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {blockedDeleteType && (
        <div className="modal-overlay z-[60] px-4 backdrop-blur-sm">
          <div className="modal-content w-full max-w-md rounded-xl p-6">
            <h3 className="mb-3 text-lg font-bold text-[var(--color-text-primary)]">
              Template Cannot Be Deleted
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              <span className="font-semibold text-[var(--color-text-primary)]">
                {blockedDeleteType}
              </span>{" "}
              is used by an existing maintenance schedule. Remove or update
              the schedule before deleting this template.
            </p>
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
        </div>
      )}

      {duplicateType && (
        <div className="modal-overlay z-[60] px-4 backdrop-blur-sm">
          <div className="modal-content w-full max-w-md rounded-xl p-6">
            <h3 className="mb-3 text-lg font-bold text-[var(--color-text-primary)]">
              Existing Work Order Template
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
        </div>
      )}

      {confirmDeleteItem && (
        <div className="modal-overlay px-4 backdrop-blur-sm">
          <div className="modal-content">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
              Confirm Delete
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Are you sure you want to delete this checklist item?
              <br />
              <span className="mt-2 block font-bold text-[var(--color-text-primary)]">"{confirmDeleteItem.text}"</span>
              <br />
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-input-bg)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextItems = editingItems.filter((item) => item.id !== confirmDeleteItem.id);
                  setEditingItems(nextItems);

                  if (selectedType) {
                    const nextTemplates = {
                      ...templates,
                      [selectedType]: nextItems,
                    };

                    setTemplates(nextTemplates);
                    saveChecklistTemplates(nextTemplates).catch((error) => {
                      console.error("Failed to update checklist item", error);
                    });
                  }

                  setConfirmDeleteItem(null);
                }}
                className="rounded-xl bg-[var(--color-brand-danger)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-danger)]/80"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
