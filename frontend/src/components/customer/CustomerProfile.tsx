import { useState, type FormEvent } from "react";
import type { AuthUser } from "../../api/auth";
import {
  changeCustomerPassword,
  readFileData,
  saveCustomerProfile,
} from "../../api/customer";
import { CustomerAvatar } from "./CustomerAvatar";

interface Props {
  user: AuthUser;
  onSaved: (user: AuthUser) => void;
  onLogout: () => void;
}

export function CustomerProfile({ user, onSaved, onLogout }: Props) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    email: user.email,
    phone: user.phone ?? "",
    address: user.address ?? "",
    profile_image: user.profile_image,
  });
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || reading) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await saveCustomerProfile(form);
      onSaved(saved);
      setMessage("Your profile has been saved.");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to save profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="customer-profile-page">
      <div className="customer-section-heading">
        <div>
          <span className="customer-kicker">A LITTLE MORE YOU</span>
          <h2>Your profile, your studio.</h2>
          <span className={`storefront-role ${user.role === 'wholesaler' ? 'is-wholesale' : ''}`}>{user.role === 'wholesaler' ? 'Wholesaler · wholesale pricing' : 'Customer'}</span>
          <p>
            Keep your details up to date so we can reach you about your prints.
          </p>
        </div>
      </div>
      <form
        className="customer-profile-panel"
        onSubmit={(event) => void save(event)}
      >
        <fieldset disabled={saving || reading}>
          <div className="customer-profile-photo">
            <CustomerAvatar user={{ ...user, ...form }} large />
            <div>
              <h3>Profile picture</h3>
              <p>PNG or JPG, up to 1 MB.</p>
              <label className="customer-upload-button">
                {reading ? "Reading…" : "Choose a photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  aria-label="Profile picture"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setError("");
                    if (
                      !["image/png", "image/jpeg"].includes(file.type) ||
                      file.size > 1024 * 1024
                    ) {
                      setError("Choose a PNG or JPEG photo up to 1 MB.");
                      return;
                    }
                    setReading(true);
                    try {
                      const image = await readFileData(file);
                      setForm((current) => ({
                        ...current,
                        profile_image: image,
                      }));
                    } catch (failure) {
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : "Unable to read photo.",
                      );
                    } finally {
                      setReading(false);
                    }
                  }}
                />
              </label>
              {form.profile_image && (
                <button
                  className="btn btn-sm btn-link"
                  type="button"
                  onClick={() => setForm({ ...form, profile_image: null })}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <div className="customer-profile-fields">
            <label className="customer-field">
              <span>Full name</span>
              <input
                className="form-control"
                required
                maxLength={255}
                value={form.full_name}
                onChange={(event) =>
                  setForm({ ...form, full_name: event.target.value })
                }
              />
            </label>
            <label className="customer-field">
              <span>Email address</span>
              <input
                className="form-control"
                type="email"
                required
                maxLength={255}
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label className="customer-field">
              <span>Phone number</span>
              <input
                className="form-control"
                type="tel"
                maxLength={50}
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </label>
            <label className="customer-field">
              <span>Address</span>
              <input
                className="form-control"
                maxLength={500}
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
            </label>
          </div>
          <button
            className="customer-button mt-4"
            disabled={saving || reading}
            type="submit"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </fieldset>
        {error && (
          <div className="alert alert-danger mt-3" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="customer-notice mt-3" role="status">
            {message}
          </div>
        )}
      </form>
      <form
        className="customer-profile-panel mt-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (changingPassword) return;
          setPasswordError("");
          if (password.next !== password.confirm) {
            setPasswordError("The new passwords do not match.");
            return;
          }
          setChangingPassword(true);
          try {
            await changeCustomerPassword(password.current, password.next);
            onLogout();
          } catch (failure) {
            setPasswordError(
              failure instanceof Error
                ? failure.message
                : "Unable to change password.",
            );
          } finally {
            setChangingPassword(false);
          }
        }}
      >
        <h3>Account security</h3>
        <p className="customer-form-hint">
          Changing your password signs you out on all devices.
        </p>
        <fieldset
          disabled={changingPassword}
          className="customer-profile-fields"
        >
          <label className="customer-field">
            <span>Current password</span>
            <input
              className="form-control"
              type="password"
              autoComplete="current-password"
              required
              value={password.current}
              onChange={(event) =>
                setPassword({ ...password, current: event.target.value })
              }
            />
          </label>
          <label className="customer-field">
            <span>New password</span>
            <input
              className="form-control"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={password.next}
              onChange={(event) =>
                setPassword({ ...password, next: event.target.value })
              }
            />
          </label>
          <label className="customer-field">
            <span>Confirm new password</span>
            <input
              className="form-control"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={password.confirm}
              onChange={(event) =>
                setPassword({ ...password, confirm: event.target.value })
              }
            />
          </label>
        </fieldset>
        <button
          className="customer-button customer-button-outline mt-4"
          type="submit"
          disabled={changingPassword}
        >
          {changingPassword ? "Updating…" : "Update password"}
        </button>
        {passwordError && (
          <div className="alert alert-danger mt-3" role="alert">
            {passwordError}
          </div>
        )}
      </form>
    </div>
  );
}
