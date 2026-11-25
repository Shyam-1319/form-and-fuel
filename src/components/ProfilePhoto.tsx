import { useEffect, useRef, useState } from "react";
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
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const preview = useRef<HTMLCanvasElement>(null);
  const revision = useRef(0);
  function adjust(canvas: HTMLCanvasElement) {
    setSource(canvas);
    setZoom(1);
    setHorizontal(50);
    setVertical(50);
  }
  useEffect(() => {
    const canvas = preview.current;
    if (!source || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const size = Math.min(source.width, source.height) / zoom;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 160, 160);
    context.drawImage(
      source,
      ((source.width - size) * horizontal) / 100,
      ((source.height - size) * vertical) / 100,
      size,
      size,
      0,
      0,
      160,
      160,
    );
  }, [source, zoom, horizontal, vertical]);
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
        hint="Choose a JPEG, PNG, or WebP under 5 MB. Adjust the crop, click Use this crop, then Save profile."
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
                const scale = Math.min(
                  1,
                  1024 / Math.max(bitmap.width, bitmap.height),
                );
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                const context = canvas.getContext("2d");
                if (!context)
                  throw new Error(
                    "Photo processing is unavailable in this browser.",
                  );
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                if (revision.current === version) adjust(canvas);
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
      {source && (
        <section className="profile-crop" aria-label="Adjust profile photo">
          <h3>Adjust your photo</h3>
          <canvas
            ref={preview}
            width={160}
            height={160}
            className="profile-crop-preview"
            role="img"
            aria-label="Circular crop preview"
          />
          <Field label="Zoom">
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </Field>
          <Field label="Horizontal position">
            <input
              type="range"
              min="0"
              max="100"
              value={horizontal}
              onChange={(e) => setHorizontal(Number(e.target.value))}
            />
          </Field>
          <Field label="Vertical position">
            <input
              type="range"
              min="0"
              max="100"
              value={vertical}
              onChange={(e) => setVertical(Number(e.target.value))}
            />
          </Field>
          <div className="split">
            <button
              type="button"
              className="button"
              onClick={() => {
                const photo = preview.current?.toDataURL("image/jpeg", 0.8);
                if (!photo || photo.length > 50000) {
                  setError("Unable to prepare photo. Try another image.");
                  return;
                }
                onChange(photo);
                setSource(null);
                setError("");
              }}
            >
              Use this crop
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setZoom(1);
                setHorizontal(50);
                setVertical(50);
              }}
            >
              Reset crop
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setSource(null);
                setError("");
              }}
            >
              Cancel crop
            </button>
          </div>
          <p className="small muted">
            Only the crop you apply is saved when you click Save profile.
          </p>
        </section>
      )}
      {image && (
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            revision.current++;
            setBusy(false);
            setSource(null);
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
