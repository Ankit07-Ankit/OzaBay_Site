import { useEffect, useRef, useState } from "react";

export const referenceAccept = "image/jpeg,image/png,image/webp";
export function referenceError(file) {
  return file && (!referenceAccept.split(",").includes(file.type) || file.size > 3 * 1024 * 1024)
    ? "Choose a JPG, PNG or WebP image up to 3 MB." : "";
}

export function useReferencePreview(file) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : "";
    setPreview(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file]);
  return preview;
}

export default function CustomDesignUpload({ onConfirm }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const preview = useReferencePreview(file);

  function choose(next) {
    if (!next) return;
    const message = referenceError(next);
    setError(message);
    if (!message) setFile(next);
  }

  return (
    <div className="design-upload">
      <div className="custom-preview-topline"><span>Your design reference</span></div>
      <button type="button" className="design-upload__drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}
        onClick={() => input.current?.click()}>
        {preview && <img src={preview} alt="Selected design reference" style={{ maxWidth: "100%", maxHeight: 180 }} />}
        <p>{file ? file.name : "Choose a photo or sketch"}</p>
        <small>JPG, PNG or WebP up to 3 MB</small>
      </button>
      <input ref={input} hidden type="file" accept={referenceAccept} onChange={(event) => choose(event.target.files[0])} />
      <label>Design notes
        <textarea className="design-upload__note" rows="2" maxLength={2000} value={note}
          placeholder="Tell the maker about the material, size or finish" onChange={(event) => setNote(event.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="button" className="hero-action" onClick={() => onConfirm(file, note)}>Prepare design brief</button>
    </div>
  );
}
