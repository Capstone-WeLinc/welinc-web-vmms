export type WorkOrderTemplate = string;

export interface ChecklistItemTemplate {
  id: string;
  text: string;
}

export const defaultChecklistTemplates: Record<
  WorkOrderTemplate,
  ChecklistItemTemplate[]
> = {
  "Oil Change": [
    { id: "1", text: "Drain old engine oil" },
    { id: "2", text: "Replace oil filter" },
    { id: "3", text: "Fill with new engine oil" },
    { id: "4", text: "Check for oil leaks" },
    { id: "5", text: "Reset maintenance light" },
  ],
  "Brake Inspection": [
    { id: "1", text: "Check brake pad thickness" },
    { id: "2", text: "Inspect brake rotors for wear" },
    { id: "3", text: "Check brake fluid level and condition" },
    { id: "4", text: "Inspect brake lines for leaks" },
    { id: "5", text: "Test brake pedal feel" },
  ],
  "Tire Rotation": [
    { id: "1", text: "Check tire pressure on all tires" },
    { id: "2", text: "Inspect tire tread depth" },
    { id: "3", text: "Rotate tires according to pattern" },
    { id: "4", text: "Torque lug nuts to specification" },
    { id: "5", text: "Check alignment if irregular wear found" },
  ],
  "Engine Tune-up": [
    { id: "1", text: "Replace spark plugs" },
    { id: "2", text: "Inspect ignition coils/wires" },
    { id: "3", text: "Replace air filter" },
    { id: "4", text: "Clean fuel injectors (if necessary)" },
    { id: "5", text: "Check engine timing and idle" },
  ],
  "General Inspection": [
    { id: "1", text: "Check all fluid levels" },
    { id: "2", text: "Inspect belts and hoses" },
    { id: "3", text: "Test battery and charging system" },
    { id: "4", text: "Check exterior and interior lights" },
    { id: "5", text: "Inspect wiper blades" },
  ],
};
