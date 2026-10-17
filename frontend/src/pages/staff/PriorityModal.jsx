import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { PRIORITIES } from '../../utils/constants';
import { titleCase } from '../../utils/format';

// Asks for the new priority AND a reason (the reason is saved in priorityLogs)
export default function PriorityModal({ entry, onClose, onSave, saving }) {
  const [priority, setPriority] = useState('URGENT');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (entry) {
      setPriority(entry.priority === 'NORMAL' ? 'URGENT' : 'NORMAL');
      setReason('');
    }
  }, [entry]);

  const tooShort = reason.trim().length < 5;

  return (
    <Modal
      show={!!entry}
      title={entry ? `Change priority of ${entry.tokenLabel}` : ''}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={saving || tooShort || priority === entry?.priority}
            onClick={() => onSave(priority, reason.trim())}
          >
            {saving ? 'Saving...' : 'Change priority'}
          </button>
        </>
      }
    >
      <div className="mb-3">
        <label htmlFor="prio" className="form-label">
          New priority
        </label>
        <select id="prio" className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p} disabled={p === entry?.priority}>
              {titleCase(p)}
              {p === entry?.priority ? ' (current)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="reason" className="form-label">
          Reason
        </label>
        <textarea
          id="reason"
          className="form-control"
          rows={3}
          maxLength={300}
          placeholder="For example: elderly customer, medical condition"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="form-text">At least 5 characters. Admins can see this in the priority history.</div>
      </div>
    </Modal>
  );
}
