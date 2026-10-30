"use client";
import Image from "next/image";
import { useState } from "react";
function Preview({
  id,
  alt,
  available,
  large,
}: {
  id: string;
  alt: string;
  available: boolean;
  large: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!available || failed)
    return (
      <span className="image-unavailable" role="status">
        Original image unavailable
        {available && (
          <button
            type="button"
            className="text-button"
            onClick={() => setFailed(false)}
          >
            Try loading again
          </button>
        )}
      </span>
    );
  return (
    <a
      href={`/asset/${id}`}
      target="_blank"
      rel="noreferrer"
      className={large ? "image-preview" : "image-link"}
      aria-label="Open full image in a new tab"
    >
      <Image
        className={large ? "preview-image" : "table-image"}
        src={`/asset/${id}`}
        alt={alt}
        width={large ? 480 : 112}
        height={large ? 320 : 84}
        unoptimized
        loading={large ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />
      {large && <small>Open full image ↗</small>}
    </a>
  );
}
export function RecordImage({
  id,
  alt = "Source image",
  available = true,
  large = false,
}: {
  id: string;
  alt?: string;
  available?: boolean;
  large?: boolean;
}) {
  return (
    <Preview key={id} id={id} alt={alt} available={available} large={large} />
  );
}
