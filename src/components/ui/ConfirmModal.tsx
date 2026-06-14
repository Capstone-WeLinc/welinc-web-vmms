import Modal from './Modal';
import Button from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      footer={(
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={isDangerous ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      )}
    >
      <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
    </Modal>
  );
}
