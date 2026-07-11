import { PreferenceModal } from './PreferenceModal.js';

interface OnboardingModalProps {
  onClose: () => void;
  onSave: (preferences: any) => Promise<void> | void;
}

export function OnboardingModal({ onClose, onSave }: OnboardingModalProps) {
  return (
    <PreferenceModal
      isOpen={true}
      onClose={onClose}
      onSave={onSave}
      currentPreferences={{}}
    />
  );
}
