import { useRef, useState } from "react";
import { Field } from "./ui";

export function ProfilePhoto({
  image,
  onChange,
}: {
  image?: string;
  onChange: (image: string | undefined) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  return (
    <div className="profile-photo-editor">
      {image && (
        <img
          className="profile-photo-preview"
          src={image}
          alt="Profile photo preview"
        />
      )}
      <Field
        label="Profile photo (optional)"
        hint="Choose a JPEG, PNG, or WebP under 5 MB. The centre is cropped into a circle. Click Save profile to keep your change."
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const version = ++revision.current;
            setError("");
            setBusy(true);
            try {
              if (
                file.size > 5 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              )
                throw new Error("Choose a JPEG, PNG, or WebP under 5 MB.");
              const bitmap = await createImageBitmap(file);
              try {
                if (
                  !bitmap.width ||
                  !bitmap.height ||
                  bitmap.width * bitmap.height > 33000000
                )
                  throw new Error("Choose a photo up to 33 megapixels.");
                const canvas = document.createElement("canvas");
                canvas.width = canvas.height = 160;
                const context = canvas.getContext("2d");
                if (!context)
                  throw new Error(
                    "Photo processing is unavailable in this browser.",
                  );
                context.fillStyle = "#fff";
                context.fillRect(0, 0, 160, 160);
                const size = Math.min(bitmap.width, bitmap.height);
                context.drawImage(
                  bitmap,
                  (bitmap.width - size) / 2,
                  (bitmap.height - size) / 2,
                  size,
                  size,
                  0,
                  0,
                  160,
                  160,
                );
                const photo = canvas.toDataURL("image/jpeg", 0.8);
                if (photo.length > 50000)
                  throw new Error("Choose a simpler or smaller photo.");
                if (revision.current === version) onChange(photo);
              } finally {
                bitmap.close();
              }
            } catch (err) {
              if (revision.current === version)
                setError(
                  err instanceof Error ? err.message : "Unable to read photo.",
                );
            } finally {
              if (revision.current === version) setBusy(false);
            }
          }}
        />
      </Field>
      {busy && <p role="status">Preparing photo…</p>}
      {image && (
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            revision.current++;
            setBusy(false);
            setError("");
            onChange(undefined);
          }}
        >
          Remove profile photo
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
