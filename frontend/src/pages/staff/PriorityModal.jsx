import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { PriorityBadge } from '../../components/Badges';
import { PRIORITIES } from '../../utils/constants';
import { titleCase } from '../../utils/format';

/**
 * PriorityModal allows staff members to change the priority of a waiting queue token.
 * Features a token selection dropdown to switch between waiting tokens in the assigned service,
 * a read-only display of the current priority, a new priority selector, and a required reason field.
 */
export default function PriorityModal({
  entry,
  waitingTokens = [],
  onClose,
  onSave,
  saving = false,
}) {
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [priority, setPriority] = useState('URGENT');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Combine waitingTokens with the clicked entry, ensuring uniqueness by ID
  const tokenList = useMemo(() => {
    const map = new Map();
    if (entry && entry._id) {
      map.set(entry._id, entry);
    }
    (waitingTokens || []).forEach((t) => {
      if (t && t._id) {
        map.set(t._id, t);
      }
    });
    return Array.from(map.values());
  }, [entry, waitingTokens]);

  // Synchronize selectedTokenId when modal opens with a clicked entry or token list changes
  useEffect(() => {
    if (entry) {
      setSelectedTokenId(entry._id);
      const defaultNextPriority = entry.priority === 'NORMAL' ? 'URGENT' : 'NORMAL';
      setPriority(defaultNextPriority);
      setReason('');
      setTouched(false);
    } else if (tokenList.length > 0) {
      setSelectedTokenId(tokenList[0]._id);
      const defaultNext = tokenList[0].priority === 'NORMAL' ? 'URGENT' : 'NORMAL';
      setPriority(defaultNext);
      setReason('');
      setTouched(false);
    } else {
      setSelectedTokenId('');
    }
  }, [entry, tokenList.length]);

  // Currently selected token object
  const selectedToken = useMemo(() => {
    return tokenList.find((t) => t._id === selectedTokenId) || entry || null;
  }, [tokenList, selectedTokenId, entry]);

  // When staff chooses another waiting token from the dropdown without closing modal
  const handleTokenChange = (e) => {
    const newId = e.target.value;
    setSelectedTokenId(newId);
    const token = tokenList.find((t) => t._id === newId);
    if (token) {
      // If current chosen priority equals token's current priority, adjust it
      if (priority === token.priority) {
        const alt = PRIORITIES.find((p) => p !== token.priority) || 'URGENT';
        setPriority(alt);
      }
    }
  };

  const trimmedReason = reason.trim();
  const isReasonTooShort = trimmedReason.length < 5;
  const showReasonError = touched && isReasonTooShort;
  const isPriorityUnchanged = selectedToken ? priority === selectedToken.priority : false;
  const isValid = Boolean(selectedToken && !isPriorityUnchanged && !isReasonTooShort);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setTouched(true);
    if (!isValid || saving) return;
    onSave(selectedToken._id, priority, trimmedReason);
  };

  return (
    <Modal
      show={Boolean(entry || selectedTokenId)}
      title={selectedToken ? `Change Priority – ${selectedToken.tokenLabel}` : 'Change Priority'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary d-inline-flex align-items-center gap-2"
            disabled={saving || !isValid}
            onClick={handleSubmit}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              'Change Priority'
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* 1. Select Token Dropdown at the top */}
        <div className="mb-3">
          <label htmlFor="tokenSelect" className="form-label fw-semibold">
            Select Token
          </label>
          {tokenList.length === 0 ? (
            <div className="alert alert-secondary py-2 px-3 small mb-0">
              No waiting tokens currently available in this queue.
            </div>
          ) : (
            <select
              id="tokenSelect"
              className="form-select"
              value={selectedToken?._id || ''}
              onChange={handleTokenChange}
              disabled={saving}
              aria-label="Select waiting token"
            >
              {tokenList.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.tokenLabel} – {t.user?.name || 'Customer'}
                </option>
              ))}
            </select>
          )}
          <div className="form-text">
            All waiting customers for your assigned service. Switching tokens updates the fields below.
          </div>
        </div>

        {/* 6. Current Priority (Read-only) */}
        <div className="mb-3">
          <label htmlFor="currentPriority" className="form-label fw-semibold text-muted small text-uppercase">
            Current Priority
          </label>
          <div className="input-group">
            <input
              type="text"
              id="currentPriority"
              className="form-control bg-light"
              readOnly
              disabled
              value={selectedToken ? titleCase(selectedToken.priority) : '—'}
            />
            {selectedToken && (
              <span className="input-group-text bg-light border-start-0">
                <PriorityBadge priority={selectedToken.priority} />
              </span>
            )}
          </div>
        </div>

        {/* 7. New Priority Dropdown */}
        <div className="mb-3">
          <label htmlFor="newPrioritySelect" className="form-label fw-semibold">
            New Priority
          </label>
          <select
            id="newPrioritySelect"
            className="form-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={saving || !selectedToken}
            aria-label="New priority selection"
          >
            {PRIORITIES.map((p) => {
              const isCurrent = selectedToken?.priority === p;
              return (
                <option key={p} value={p} disabled={isCurrent}>
                  {titleCase(p)}
                  {isCurrent ? ' (current)' : ''}
                </option>
              );
            })}
          </select>
          {isPriorityUnchanged && (
            <div className="text-warning small mt-1">
              Please choose a new priority different from the current priority.
            </div>
          )}
        </div>

        {/* 8. Reason Field with validation */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label htmlFor="priorityReason" className="form-label fw-semibold mb-0">
              Reason <span className="text-danger">*</span>
            </label>
            <span className={`small ${isReasonTooShort && touched ? 'text-danger' : 'text-muted'}`}>
              {trimmedReason.length}/300 characters (min 5)
            </span>
          </div>
          <textarea
            id="priorityReason"
            className={`form-control ${showReasonError ? 'is-invalid' : ''}`}
            rows={3}
            maxLength={300}
            placeholder="For example: elderly customer, medical condition, emergency situation"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (!touched && e.target.value.length > 0) {
                setTouched(true);
              }
            }}
            onBlur={() => setTouched(true)}
            disabled={saving || !selectedToken}
            aria-describedby="reasonValidation"
          />
          {showReasonError ? (
            <div id="reasonValidation" className="invalid-feedback d-block">
              Reason is required and must be at least 5 characters.
            </div>
          ) : (
            <div id="reasonValidation" className="form-text">
              At least 5 characters. This reason is recorded in the administrative priority history log.
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
