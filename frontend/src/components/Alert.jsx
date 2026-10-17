// Small reusable message box. Renders nothing when there is no message.
export default function Alert({ type = 'danger', message, onClose }) {
  if (!message) return null;
  return (
    <div className={`alert alert-${type} d-flex justify-content-between align-items-start gap-2`} role="alert">
      <span>{message}</span>
      {onClose && <button type="button" className="btn-close" aria-label="Dismiss" onClick={onClose} />}
    </div>
  );
}
