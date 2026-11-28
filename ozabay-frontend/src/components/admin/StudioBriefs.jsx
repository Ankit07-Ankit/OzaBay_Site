import { useEffect, useState } from "react";

function ReferenceImage({ brief, request }) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    let url;
    request(`/studio-briefs/${brief._id}/reference`, {}, true).then((blob) => {
      if (active) {
        url = URL.createObjectURL(blob);
        setImage(url);
      }
    }).catch(() => { if (active) setError("Unable to load the reference image."); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [brief._id, open, request]);
  return <div>
    <button type="button" onClick={() => { setOpen(!open); setImage(""); setError(""); }}>
      {open ? "Hide reference" : "View reference"} · {brief.referenceName}
    </button>
    {open && (image ? <img src={image} alt="Customer design reference" style={{ display: "block", maxWidth: "100%", maxHeight: 320 }} />
      : <p role="status">{error || "Loading reference…"}</p>)}
  </div>;
}

export default function StudioBriefs({ briefs, request }) {
  return <div className="admin-support-list">
    {briefs.map((brief) => {
      const { customer, design } = brief;
      return <article className="admin-support-card" key={brief._id}>
        <h3>{customer.name} · {design.form}</h3>
        <small>Request {brief._id} · {new Date(brief.createdAt).toLocaleDateString()}</small>
        <p>{customer.email} · {customer.phone}</p>
        <p>{customer.address} · {customer.city}</p>
        <p>{[design.material, design.finish, design.size, design.tone].filter(Boolean).join(" · ")} · Quantity {customer.quantity}</p>
        {design.engraving && <p>Engraving · {design.engraving}</p>}
        {design.notes && <p>{design.notes}</p>}
        {customer.budget && <p>Budget · {customer.budget}</p>}
        {customer.neededBy && <p>Needed by · {customer.neededBy}</p>}
        {customer.purpose && <p>Occasion · {customer.purpose}</p>}
        {brief.referenceName && <ReferenceImage brief={brief} request={request} />}
      </article>;
    })}
    {!briefs.length && <p className="admin-empty">No design briefs found.</p>}
  </div>;
}
