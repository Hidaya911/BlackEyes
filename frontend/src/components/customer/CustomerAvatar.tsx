import { useState } from "react";
import type { AuthUser } from "../../api/auth";

export function CustomerAvatar({
  user,
  large = false,
}: {
  user: AuthUser;
  large?: boolean;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const words = user.full_name.trim().split(/\s+/);
  const initials =
    `${words[0]?.[0] ?? "C"}${words.length > 1 ? words[words.length - 1][0] : ""}`.toUpperCase();
  return (
    <span
      className={`customer-avatar${large ? " customer-avatar-large" : ""}`}
      role="img"
      aria-label={`${user.full_name}'s profile`}
    >
      {user.profile_image && user.profile_image !== failedImage ? (
        <img
          src={user.profile_image}
          alt=""
          onError={() => setFailedImage(user.profile_image)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
