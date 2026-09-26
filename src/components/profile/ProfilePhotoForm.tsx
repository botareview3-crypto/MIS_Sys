"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2, Save } from "lucide-react";

export function ProfilePhotoForm({
  initials,
  profileImagePath,
}: {
  initials: string;
  profileImagePath: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(profileImagePath);
  const [fileName, setFileName] = useState<string>(profileImagePath ? "Current photo" : "No photo selected");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function pickFile(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
    setError("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (!selectedFile) {
        setError("Choose a new photo or select Remove Photo.");
        return;
      }
      const body = new FormData();
      body.set("profile_image", selectedFile);
      const res = await fetch("/api/profile/photo", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Your profile photo could not be updated. Please try again.");
        return;
      }
      setSuccess("Your profile photo was updated successfully.");
      setSelectedFile(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/profile/photo", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Your profile photo could not be updated. Please try again.");
        return;
      }
      setPreview(null);
      setSelectedFile(null);
      setFileName("No photo selected");
      setSuccess("Your profile photo was removed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-6 p-6">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      )}

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your profile photo" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>

        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-semibold text-slate-900">Photo shown across AUC MIS</p>
          <p className="mt-0.5 text-xs text-slate-500">JPG, PNG, or WebP. Maximum file size: 5 MB.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Camera size={16} aria-hidden /> Choose Photo
            </button>
            {preview && (
              <button
                type="button"
                disabled={busy}
                onClick={remove}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 size={16} aria-hidden /> Remove Photo
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <p className="mt-2 text-xs text-slate-400">{fileName}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" disabled={busy || !selectedFile} onClick={save} className="btn-primary">
          <span className="inline-flex items-center gap-2">
            <Save size={16} aria-hidden /> {busy ? "Saving…" : "Save Profile Photo"}
          </span>
        </button>
      </div>
    </div>
  );
}
