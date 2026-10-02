import { useState } from 'react';
import type { AuthUser } from '../../api/auth';

export function AdminAvatar({ profile }: { profile: AuthUser | null }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const name = profile?.full_name.trim() || 'Super Administrator';
  const words = name.split(/\s+/);
  const initials = (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  const image = profile?.profile_image;

  return (
    <span
      className="d-inline-flex align-items-center justify-content-center rounded-circle overflow-hidden shadow-sm"
      role="img"
      aria-label={`${name}'s profile`}
      title={name}
      style={{
        width: 42,
        height: 42,
        flexShrink: 0,
        background: 'linear-gradient(135deg, #1b718d, #513b73)',
        border: '2px solid #ffffffb3',
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {image && image !== failedImage ? (
        <img
          src={image}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setFailedImage(image)}
        />
      ) : initials}
    </span>
  );
}

