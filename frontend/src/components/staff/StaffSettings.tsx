import { useState, type FormEvent } from "react";
import type { AuthUser } from "../../api/auth";
import { readFileData } from "../../api/customer";
import { pressRequest } from "../../api/press";
import { ProfileAvatar } from "./ProfileAvatar";

export function StaffSettings({
  user,
  onSaved,
  onLogout,
}: {
  user: AuthUser;
  onSaved: (user: AuthUser) => void;
  onLogout: () => void;
}) {
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
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || reading) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      onSaved(
        await pressRequest<AuthUser>("/profile", {
          method: "PUT",
          body: JSON.stringify(form),
        }),
      );
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
    <section className="press-settings">
      <header className="counter-hero">
        <div>
          <span className="press-kicker">YOUR WORKSPACE, YOUR PROFILE</span>
          <h2>Make yourself at home.</h2>
          <p>Keep your contact details and account security up to date.</p>
        </div>
      </header>
      <form className="counter-panel" onSubmit={(event) => void save(event)}>
        <fieldset disabled={saving || reading}>
          <div className="press-photo-editor">
            <ProfileAvatar user={form} large />
            <div>
              <h3>Profile photo</h3>
              <p className="press-muted">PNG or JPEG, up to 1 MB.</p>
              <label className="btn btn-outline-secondary">
                {reading ? "Reading…" : "Choose photo"}
                <input
                  className="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
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
                    } catch {
                      setError("Unable to read this photo.");
                    } finally {
                      setReading(false);
                    }
                  }}
                />
              </label>
              {form.profile_image && (
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => setForm({ ...form, profile_image: null })}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="counter-fields">
            <label>
              Full name
              <input
                className="form-control"
                required
                maxLength={255}
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                className="form-control"
                type="email"
                required
                maxLength={255}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Phone
              <input
                className="form-control"
                type="tel"
                maxLength={50}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Address
              <input
                className="form-control"
                maxLength={500}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
          </div>
          <button className="btn press-primary mt-4" type="submit">
            {saving ? "Saving…" : "Save profile"}
          </button>
        </fieldset>
        {error && (
          <div className="alert alert-danger mt-3" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="alert alert-success mt-3" role="status">
            {message}
          </div>
        )}
      </form>
      <form
        className="counter-panel mt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (changing) return;
          setPasswordError("");
          if (password.next !== password.confirm) {
            setPasswordError("The new passwords do not match.");
            return;
          }
          setChanging(true);
          try {
            await pressRequest("/profile/password", {
              method: "PUT",
              body: JSON.stringify({
                current_password: password.current,
                new_password: password.next,
              }),
            });
            onLogout();
          } catch (failure) {
            setPasswordError(
              failure instanceof Error
                ? failure.message
                : "Unable to change password.",
            );
          } finally {
            setChanging(false);
          }
        }}
      >
        <h3>Account security</h3>
        <p className="press-muted">
          Changing your password signs you out on all devices.
        </p>
        <fieldset disabled={changing}>
          <div className="counter-fields">
            <label>
              Current password
              <input
                className="form-control"
                type="password"
                required
                autoComplete="current-password"
                value={password.current}
                onChange={(e) =>
                  setPassword({ ...password, current: e.target.value })
                }
              />
            </label>
            <label>
              New password
              <input
                className="form-control"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={password.next}
                onChange={(e) =>
                  setPassword({ ...password, next: e.target.value })
                }
              />
            </label>
            <label>
              Confirm new password
              <input
                className="form-control"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={password.confirm}
                onChange={(e) =>
                  setPassword({ ...password, confirm: e.target.value })
                }
              />
            </label>
          </div>
          <button className="btn btn-outline-secondary mt-4" type="submit">
            {changing ? "Updating…" : "Update password"}
          </button>
        </fieldset>
        {passwordError && (
          <div className="alert alert-danger mt-3" role="alert">
            {passwordError}
          </div>
        )}
      </form>
    </section>
  );
}
