import { useState } from "react";
import { Camera, X } from "lucide-react";
import { Field } from "./ui";
import { MealCamera, mealPhoto } from "./MealCamera";
export function PhotoInput({
  image,
  onChange,
  available,
}: {
  image: string | undefined;
  onChange: (value: string | undefined) => void;
  available: boolean;
}) {
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  return (
    <div className="photo-input">
      {available && !camera && (
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            setCamera(true);
          }}
        >
          <Camera size={17} />
          Open camera
        </button>
      )}
      {camera && available && (
        <MealCamera
          onClose={() => setCamera(false)}
          onCapture={(value) => {
            onChange(value);
            setCamera(false);
          }}
        />
      )}
      <Field label="Meal photo (optional)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={!available || camera}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError("");
            try {
              if (
                file.size > 5 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              )
                throw new Error("Choose a JPEG, PNG, or WebP under 5 MB.");
              const bitmap = await createImageBitmap(file);
              if (bitmap.width * bitmap.height > 33000000) {
                bitmap.close();
                throw new Error("Photo exceeds 33 megapixels.");
              }
              try {
                onChange(mealPhoto(bitmap, bitmap.width, bitmap.height));
              } finally {
                bitmap.close();
              }
            } catch (err) {
              setError((err as Error).message);
            }
            e.target.value = "";
          }}
        />
      </Field>
      {image && (
        <div className="photo-preview">
          <img src={image} alt="Meal photo selected for analysis" />
          <button
            className="icon-button"
            aria-label="Remove photo"
            onClick={() => onChange(undefined)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <p className="small muted">
        <Camera size={13} />{" "}
        {available
          ? "Photo is resized to 512 pixels and sent to Groq only after you consent and request an estimate. Form & Fuel does not save the photo. Add portion sizes or ingredients in the description for a better estimate."
          : "Photo analysis is unavailable until a compatible free-tier Groq model is verified and enabled. Remove the photo to use text analysis; manual entry always works."}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
