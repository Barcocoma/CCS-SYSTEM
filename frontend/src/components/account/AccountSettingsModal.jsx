import React, { useMemo, useState } from 'react';
import { KeyRound, Mail, Save, User2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useUI } from '../ui/UIProvider';
import { ModalShell } from '../ui/ModalShell';
import { useSession } from '../../context/SessionProvider';

export function AccountSettingsModal({ onClose }) {
  const { user, setUser, setAccessRole } = useSession();
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useUI();

  const passwordError = useMemo(() => {
    if (!formData.password && !formData.confirmPassword) {
      return '';
    }

    if (formData.password.length > 0 && formData.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match.';
    }

    return '';
  }, [formData.password, formData.confirmPassword]);

  const handleChange = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.id || passwordError) return;

    try {
      setSaving(true);
      const response = await apiRequest(`/api/auth/account/${user.id}`, {
        method: 'PUT',
        body: {
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password || undefined,
        },
      });

      const nextUser = {
        ...user,
        ...response.data,
      };

      setUser(nextUser);
      setAccessRole(nextUser.role || 'FACULTY');

      showSuccess('Account updated', 'Your settings were saved successfully.');
      onClose();
    } catch (error) {
      showError('Unable to update account', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      title="Account Settings"
      description="Update your presentation account details and demo login information."
      size="max-w-2xl"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="account-settings-form" disabled={saving || Boolean(passwordError)}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <form id="account-settings-form" onSubmit={handleSubmit} className="space-y-5">
        {/* form content unchanged */}
      </form>
    </ModalShell>
  );
}