import { useState } from "react";
import type { AuthUser } from "../../api/auth";

export function ProfileAvatar({
  user,
  large = false,
}: {
  user: Pick<AuthUser, "full_name" | "profile_image">;
  large?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const name = user.full_name.trim() || "Press staff";
  const parts = name.split(/\s+/);
  const initials = (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
  return (
    <span
      className={`press-avatar${large ? " press-avatar-large" : ""}`}
      role="img"
      aria-label={`${name}'s profile`}
    >
      {user.profile_image && user.profile_image !== failed ? (
        <img
          src={user.profile_image}
          alt=""
          onError={() => setFailed(user.profile_image)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
