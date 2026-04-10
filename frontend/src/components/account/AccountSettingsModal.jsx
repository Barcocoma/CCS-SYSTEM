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
    if (!user?.id || passwordError) {
      return;
    }

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
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="account-settings-form"
            disabled={saving || Boolean(passwordError)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <form id="account-settings-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <User2 size={14} />
              Username
            </span>
            <input
              type="text"
              required
              autoComplete="off"
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              value={formData.username}
              onChange={(event) => handleChange('username', event.target.value)}
            />
          </label>

          <label className="block rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <Mail size={14} />
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="off"
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              value={formData.email}
              onChange={(event) => handleChange('email', event.target.value)}
            />
          </label>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 px-5 py-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <KeyRound size={16} className="text-orange-600" />
            Security
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block rounded-3xl border border-white/80 bg-white px-4 py-3 shadow-sm">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                New Password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
                value={formData.password}
                onChange={(event) => handleChange('password', event.target.value)}
                placeholder="Leave blank to keep current"
              />
            </label>

            <label className="block rounded-3xl border border-white/80 bg-white px-4 py-3 shadow-sm">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Confirm Password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
                value={formData.confirmPassword}
                onChange={(event) => handleChange('confirmPassword', event.target.value)}
                placeholder="Repeat new password"
              />
            </label>
          </div>

          <p className={`mt-3 text-sm ${passwordError ? 'text-red-600' : 'text-slate-500'}`}>
            {passwordError || 'Use a minimum of 6 characters if you want to change your password.'}
          </p>
        </div>
      </form>
    </ModalShell>
  );
}
