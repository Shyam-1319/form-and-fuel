import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

export function mealPhoto(
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  if (!width || !height)
    throw new Error("The camera is not ready yet. Try again.");
  const ratio = Math.min(1, 512 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Photo capture is unavailable in this browser.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function MealCamera({
  onCapture,
  onClose,
}: {
  onCapture: (image: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    const stop = () => stream?.getTracks().forEach((track) => track.stop());
    const leave = () => {
      active = false;
      stop();
      close.current();
    };
    const hide = () => {
      if (document.hidden) leave();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera preview is unavailable in this browser. Use Choose file to take or select a photo.",
      );
    } else {
      void navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        .then(async (acquired) => {
          stream = acquired;
          if (!active) {
            stop();
            return;
          }
          for (const track of stream.getVideoTracks())
            track.addEventListener("ended", () => {
              if (active) {
                setReady(false);
                setError(
                  "The camera stopped. Close the preview and open it again, or choose a photo.",
                );
              }
            });
          if (video.current) {
            video.current.srcObject = stream;
            await video.current.play();
          }
        })
        .catch((err) => {
          stop();
          if (!active) return;
          const name = err instanceof Error ? err.name : "";
          setError(
            name === "NotAllowedError"
              ? "Camera access was blocked. Allow camera access in your browser, or use Choose file instead."
              : name === "NotFoundError"
                ? "No camera was found. Use Choose file to select a photo."
                : "Could not open the camera. Close other camera apps and try again, or use Choose file.",
          );
          setReady(false);
        });
    }
    return () => {
      active = false;
      stop();
      if (video.current) video.current.srcObject = null;
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
    };
  }, []);
  return (
    <section className="meal-camera" aria-label="Food camera">
      <div className="section-heading">
        <h3>Frame your food</h3>
        <button
          className="icon-button"
          aria-label="Close camera"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        aria-label="Live food camera preview"
        onLoadedData={() => setReady(true)}
      />
      {!ready && !error && <p role="status">Waiting for camera access…</p>}
      {error && <p role="alert">{error}</p>}
      <p className="small muted">
        The preview stays on your device. Capture a photo, then consent and
        request an estimate.
      </p>
      <button
        className="button"
        disabled={!ready || !!error}
        onClick={() => {
          try {
            if (!video.current) return;
            onCapture(
              mealPhoto(
                video.current,
                video.current.videoWidth,
                video.current.videoHeight,
              ),
            );
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <Camera size={17} />
        Capture food photo
      </button>
    </section>
  );
}
