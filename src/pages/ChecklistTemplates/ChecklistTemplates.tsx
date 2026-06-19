import { useEffect, useState } from "react";
import {
  CheckCircle2,
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
  ActionButton,
  ActionMenu,
  ConfirmationModal,
  DataTable,
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
  const [openTemplateActionMenuId, setOpenTemplateActionMenuId] = useState<
    string | null
  >(null);
  const [openItemActionMenuId, setOpenItemActionMenuId] = useState<
    string | null
  >(null);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);

  useBodyScrollLock(
    Boolean(
      confirmDeleteType ||
        blockedDeleteType ||
        confirmDeleteItem ||
        duplicateType,
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
      setOpenItemActionMenuId(null);
    };
    document.addEventListener("click", closeActionMenus);
    return () => document.removeEventListener("click", closeActionMenus);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleAddItem = () => {
    if (!selectedType || !isEditingChecklist) return;
    if (templateHasMaintenanceSchedule(selectedType)) {
      showStructureLockedMessage();
      return;
    }
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

  const handleCancelEditChecklist = () => {
    if (!selectedType) return;

    setEditingItems([...templates[selectedType] ?? []]);
    setIsEditingChecklist(false);
  };

  const handleSave = () => {
    if (!canSaveTemplate) return;
    if (templateHasMaintenanceSchedule(selectedType)) {
      showStructureLockedMessage();
      return;
    }

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
    if (templateHasMaintenanceSchedule(duplicateType)) {
      showStructureLockedMessage();
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

  const performDeleteItem = () => {
    if (!confirmDeleteItem) return;
    const nextItems = editingItems.filter(
      (item) => item.id !== confirmDeleteItem.id,
    );
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
    const existingType = Object.keys(templates).find(
      (type) =>
        type !== oldType && type.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existingType) {
      setDuplicateType(existingType);
      setDuplicateTypeSource(oldType);
      return;
    }
    const newTemplates: Record<ChecklistTemplateName, ChecklistItemTemplate[]> = {
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

  const selectTemplate = (type: string) => {
    if (editingType === type) return;
    const changedTemplate = selectedType !== type;
    setSelectedType(type);
    setChecklistPage(1);
    setIsEditingChecklist(false);
    setEditingItems(
      Object.prototype.hasOwnProperty.call(templates, type)
        ? [...templates[type]]
        : [],
    );
    if (changedTemplate) {
      setToast({
        type: "success",
        message: `Now using template: ${type}.`,
      });
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] xl:items-start">
      <section className="min-w-0 space-y-5">
        <div className="flex flex-col gap-3">
          <SearchInput
            className="w-full"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setTemplatePage(1);
            }}
            placeholder="Search templates..."
          />

          {isAddingType ? (
            <div className="flex w-full flex-col gap-2 rounded-xl border border-[#d8dee8] bg-white p-3">
              <input
                type="text"
                value={newTypeName}
                onChange={(event) => setNewTypeName(event.target.value)}
                placeholder="Type name..."
                className="h-10 rounded-lg border border-[#cbd3df] bg-white px-3 text-sm text-[#141827] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleAddType();
                  if (event.key === "Escape") {
                    setIsAddingType(false);
                    setNewTypeName("");
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <ActionButton
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setIsAddingType(false);
                    setNewTypeName("");
                  }}
                >
                  Cancel
                </ActionButton>
                <ActionButton className="w-full" onClick={handleAddType}>Add</ActionButton>
              </div>
            </div>
          ) : (
            <ActionButton className="w-full" onClick={() => setIsAddingType(true)}>
              <Plus className="h-4 w-4" />
              Add New Type
            </ActionButton>
          )}
        </div>

        <DataTable
          data={paginatedTemplates}
          getRowKey={(type) => type}
          minWidth="100%"
          onRowClick={selectTemplate}
          emptyMessage={
            hasTemplateSearch
              ? "No templates match your search."
              : "No templates yet. Add a new type to get started."
          }
          columns={[
            {
              key: "template",
              header: "Template",
              width: "58%",
              render: (type) =>
                editingType === type ? (
                  <input
                    type="text"
                    value={editingTypeValue}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setEditingTypeValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSubmitEditType(type);
                      if (event.key === "Escape") handleCancelEditType();
                    }}
                    className="h-9 w-full rounded-lg border border-[#cbd3df] bg-white px-3 text-sm font-semibold text-[#141827] outline-none focus:border-[#070b45]"
                    autoFocus
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-semibold ${
                        selectedType === type ? "text-[#070b45]" : "text-[#2f3b52]"
                      }`}
                    >
                      {type}
                    </span>
                    {selectedType === type ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#070b45] bg-[#eef2ff] px-2.5 py-1 text-[10px] font-bold uppercase text-[#070b45]">
                        <CheckCircle2 className="h-3 w-3" />
                        Current
                      </span>
                    ) : null}
                  </div>
                ),
            },
            {
              key: "items",
              header: "Items",
              width: "18%",
              render: (type) => templates[type]?.length ?? 0,
            },
            {
              key: "actions",
              header: "Actions",
              width: "24%",
              align: "center",
              render: (type) =>
                editingType === type ? (
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSubmitEditType(type);
                      }}
                      className="rounded-lg p-2 text-[#070b45] transition hover:bg-[#eef2ff]"
                      title="Save Type"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCancelEditType();
                      }}
                      className="rounded-lg p-2 text-[#ff4040] transition hover:bg-[#fff1f1]"
                      title="Cancel Type Edit"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
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
                        label: "Edit",
                        icon: Edit,
                        onClick: () => {
                          setOpenTemplateActionMenuId(null);
                          handleStartEditType(type);
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
                ),
            },
          ]}
        />

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

      <section className="min-w-0 space-y-5">
        {hasSelectedTemplate ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#070b45] bg-[#eef2ff] px-4 py-3 text-[#070b45]">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wide">
              Current Template
            </span>
            <span className="text-sm font-semibold">{selectedType}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 border-b border-[#dde4ef] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#141827]">
              {hasSelectedTemplate ? selectedType : "Checklist Items"}
            </h2>
            <p className="mt-1 text-sm text-[#6f7790]">
              Configure the checklist items mechanics must complete.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isEditingChecklist ? (
              <ActionButton variant="secondary" onClick={handleCancelEditChecklist}>
                Cancel Edit
              </ActionButton>
            ) : null}
            <ActionButton
              onClick={() => {
                if (isEditingChecklist) {
                  handleSave();
                } else {
                  if (templateHasMaintenanceSchedule(selectedType)) {
                    showStructureLockedMessage();
                    return;
                  }
                  setIsEditingChecklist(true);
                }
              }}
              disabled={!hasSelectedTemplate || (!canSaveTemplate && isEditingChecklist)}
            >
              {isEditingChecklist ? "Save Checklist" : "Edit Checklist"}
            </ActionButton>
            <ActionButton
              onClick={handleAddItem}
              disabled={!hasSelectedTemplate || !isEditingChecklist}
            >
              <Plus className="h-4 w-4" />
              Add Item
            </ActionButton>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput
            className="w-full max-w-xl"
            value={itemFilter}
            onChange={(event) => {
              setItemFilter(event.target.value);
              setChecklistPage(1);
            }}
            placeholder="Filter checklist items..."
          />
          <p className="text-sm text-[#6f7790]">
            Showing {paginatedItems.length} of {filteredItems.length} matching item{filteredItems.length === 1 ? "" : "s"}
          </p>
        </div>

        <DataTable
          data={paginatedItems}
          getRowKey={(item) => item.id}
          minWidth="100%"
          emptyMessage={
            hasChecklistItemSearch
              ? "No checklist items match your filter."
              : hasSelectedTemplate
                ? "This template has no checklist items."
                : "Select or create a checklist template."
          }
          columns={[
            {
              key: "order",
              header: "item no.",
              width: "10%",
              render: (item) =>
                (activeChecklistPage - 1) * itemsPerPage +
                filteredItems.findIndex((current) => current.id === item.id) +
                1,
            },
            {
              key: "item",
              header: "Checklist Item",
              width: "72%",
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
                    className={`flex items-center gap-3 ${
                      draggedItemId === item.id ? "text-[#070b45]" : ""
                    }`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#6f7790]" />
                    <input
                      type="text"
                      value={item.text}
                      onChange={(event) =>
                        handleUpdateItem(item.id, event.target.value)
                      }
                      placeholder="Enter checklist task description..."
                      className="h-9 w-full rounded-lg border border-[#cbd3df] bg-white px-3 text-sm text-[#141827] outline-none focus:border-[#070b45]"
                    />
                  </div>
                ) : (
                  <span className="text-[#141827]">
                    {item.text || "Untitled checklist item"}
                  </span>
                ),
            },
            {
              key: "actions",
              header: "Actions",
              width: "20%",
              align: "center",
              render: (item) => (
                <ActionMenu
                  open={openItemActionMenuId === item.id}
                  onToggle={(event) => {
                    event.stopPropagation();
                    setOpenItemActionMenuId((current) =>
                      current === item.id ? null : item.id,
                    );
                  }}
                  items={[
                    {
                      label: "Delete",
                      icon: Trash2,
                      danger: true,
                      onClick: () => {
                        setOpenItemActionMenuId(null);
                        handleDeleteItem(item);
                      },
                    },
                  ]}
                />
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
      </section>
      </div>

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
        </div>
      )}

      {duplicateType && (
        <div className="modal-overlay z-[60] px-4 backdrop-blur-sm">
          <div className="modal-content w-full max-w-md rounded-xl p-6">
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

      <ConfirmationModal
        isOpen={Boolean(confirmDeleteItem)}
        variant="danger"
        message={
          confirmDeleteItem ? (
            <>
              Are you sure you want to delete this checklist item?
              <span className="mt-2 block font-bold">
                {confirmDeleteItem.text || "Untitled checklist item"}
              </span>
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Yes"
        onConfirm={performDeleteItem}
        onCancel={() => setConfirmDeleteItem(null)}
      />
    </div>
  );
}
