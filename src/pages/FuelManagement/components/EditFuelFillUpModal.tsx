import type { FuelFillUp } from '../types';
import EditFuelLog from './EditFuelLog';

interface EditFuelFillUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  fillUp: FuelFillUp | null;
  onSave: (updated: FuelFillUp) => void;
}

export default function EditFuelFillUpModal({
  isOpen,
  onClose,
  fillUp,
  onSave
}: EditFuelFillUpModalProps) {
  if (!isOpen || !fillUp) return null;

  return <EditFuelLog record={fillUp} onClose={onClose} onSave={onSave} />;
}
