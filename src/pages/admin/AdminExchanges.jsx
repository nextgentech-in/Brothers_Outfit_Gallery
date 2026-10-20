import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAdminUI } from '../../context/AdminUIContext';
import {
  subscribeAdminExchanges,
  approveExchangeRequest,
  rejectExchangeRequest,
  retryReversePickup,
  updateExchangeStatus
} from '../../services/exchangeService';
import { fetchAllActiveProducts } from '../../services/productService';
import {
  EXCHANGE_STATUS,
  EXCHANGE_STATUS_METADATA
} from '../../utils/exchangeConstants';
import './AdminExchanges.css';

const QUICK_REJECTION_REASONS = [
  'Requested replacement size is currently out of stock',
  'Exceeded 48-hour exchange eligibility window',
  'Garment shows signs of wear / tags missing',
  'Unboxing video proof was not provided',
  'Invalid or damaged item not covered by policy',
  'Other'
];

export default function AdminExchanges() {
  const { showToast, showConfirm } = useAdminUI();
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [productsMap, setProductsMap] = useState(new Map());

  // Drawer / Details modal state
  const [selectedExchangeId, setSelectedExchangeId] = useState(null);
  const selectedExchange = useMemo(() => {
    if (!selectedExchangeId) return null;
    return exchanges.find(e => (e.id || e.docId) === selectedExchangeId) || null;
  }, [exchanges, selectedExchangeId]);

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState({ open: false, exchange: null });
  const [rejectionReasonSelect, setRejectionReasonSelect] = useState('');
  const [rejectionCustomText, setRejectionCustomText] = useState('');

  // Dispatch Replacement modal state
  const [dispatchModal, setDispatchModal] = useState({ open: false, exchange: null });
  const [replacementAwbInput, setReplacementAwbInput] = useState('');

  // Action loading state
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Success approval popup modal state
  const [successModal, setSuccessModal] = useState({ open: false, exchange: null });

  // Preload catalog products for variant stock checking
  useEffect(() => {
    let isMounted = true;
    fetchAllActiveProducts()
      .then(prods => {
        if (!isMounted || !Array.isArray(prods)) return;
        const map = new Map();
        prods.forEach(p => {
          if (p.id) map.set(p.id, p);
          if (p.slug) map.set(p.slug.toLowerCase().trim(), p);
          if (p.name) map.set(p.name.toLowerCase().trim(), p);
        });
        setProductsMap(map);
      })
      .catch(err => {
        console.warn('Preload products error in AdminExchanges:', err);
      });
    return () => { isMounted = false; };
  }, []);

  // Subscribe to real-time exchange requests
  useEffect(() => {
    const unsubscribe = subscribeAdminExchanges((list) => {
      setExchanges(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Inventory check helper for requested variant
  const getRequestedVariantStock = useCallback((exchange) => {
    if (!exchange || !exchange.productId) return null;
    const prod = productsMap.get(exchange.productId) || productsMap.get(exchange.productName?.toLowerCase().trim());
    if (!prod || !Array.isArray(prod.variants)) return null;

    const reqSize = String(exchange.requestedVariant?.size || '').toLowerCase().trim();
    const matched = prod.variants.find(v => String(v.size || '').toLowerCase().trim() === reqSize);
    if (!matched) return { inStock: false, quantity: 0, found: false };

    const qty = parseInt(matched.stock ?? matched.quantity ?? 0, 10);
    return { inStock: qty > 0, quantity: qty, found: true };
  }, [productsMap]);

  // Filtering
  const filteredExchanges = useMemo(() => {
    return exchanges.filter(ex => {
      // Status Filter
      if (statusFilter === 'PENDING' && ex.status !== EXCHANGE_STATUS.PENDING_ADMIN_REVIEW) return false;
      if (statusFilter === 'APPROVED' && ![EXCHANGE_STATUS.APPROVED, EXCHANGE_STATUS.REVERSE_PICKUP_PENDING, EXCHANGE_STATUS.REVERSE_PICKUP_CREATED].includes(ex.status)) return false;
      if (statusFilter === 'PICKUP' && ![EXCHANGE_STATUS.PICKED_UP, EXCHANGE_STATUS.RECEIVED].includes(ex.status)) return false;
      if (statusFilter === 'QC' && ![EXCHANGE_STATUS.QC_PENDING, EXCHANGE_STATUS.QC_APPROVED].includes(ex.status)) return false;
      if (statusFilter === 'REPLACEMENT' && ex.status !== EXCHANGE_STATUS.REPLACEMENT_SHIPPED) return false;
      if (statusFilter === 'COMPLETED' && ex.status !== EXCHANGE_STATUS.COMPLETED) return false;
      if (statusFilter === 'REJECTED' && ![EXCHANGE_STATUS.REJECTED, EXCHANGE_STATUS.QC_REJECTED, EXCHANGE_STATUS.CANCELLED].includes(ex.status)) return false;

      // Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const idMatch = String(ex.id || '').toLowerCase().includes(term);
        const orderMatch = String(ex.orderId || '').toLowerCase().includes(term);
        const nameMatch = String(ex.shippingAddress?.fullName || ex.userEmail || '').toLowerCase().includes(term);
        const phoneMatch = String(ex.userPhone || ex.shippingAddress?.phone || '').includes(term);
        const prodMatch = String(ex.productName || '').toLowerCase().includes(term);
        const awbMatch = String(ex.reversePickupAwb || ex.replacementAwb || '').toLowerCase().includes(term);
        return idMatch || orderMatch || nameMatch || phoneMatch || prodMatch || awbMatch;
      }

      return true;
    });
  }, [exchanges, statusFilter, searchTerm]);

  // Metrics Count
  const metrics = useMemo(() => {
    const total = exchanges.length;
    const pending = exchanges.filter(e => e.status === EXCHANGE_STATUS.PENDING_ADMIN_REVIEW).length;
    const approved = exchanges.filter(e => [EXCHANGE_STATUS.APPROVED, EXCHANGE_STATUS.REVERSE_PICKUP_PENDING, EXCHANGE_STATUS.REVERSE_PICKUP_CREATED].includes(e.status)).length;
    const inTransitOrQC = exchanges.filter(e => [EXCHANGE_STATUS.PICKED_UP, EXCHANGE_STATUS.RECEIVED, EXCHANGE_STATUS.QC_PENDING, EXCHANGE_STATUS.QC_APPROVED].includes(e.status)).length;
    const replacement = exchanges.filter(e => e.status === EXCHANGE_STATUS.REPLACEMENT_SHIPPED).length;
    const completed = exchanges.filter(e => e.status === EXCHANGE_STATUS.COMPLETED).length;
    const rejected = exchanges.filter(e => [EXCHANGE_STATUS.REJECTED, EXCHANGE_STATUS.QC_REJECTED, EXCHANGE_STATUS.CANCELLED].includes(e.status)).length;
    return { total, pending, approved, inTransitOrQC, replacement, completed, rejected };
  }, [exchanges]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  // 1. Approve Exchange (No reverse pickup request to Delhivery)
  const handleApprove = (ex) => {
    const stockInfo = getRequestedVariantStock(ex);
    let confirmMsg = `Approve Exchange #${ex.id} for Order #${ex.orderId}? The exchange will be marked as Approved and the customer will be notified on their profile.`;
    if (stockInfo && stockInfo.found && !stockInfo.inStock) {
      confirmMsg += `\n\n⚠️ INVENTORY WARNING: Requested replacement size ${ex.requestedVariant?.size} has 0 stock in catalog!`;
    }

    showConfirm({
      title: 'Approve Exchange Request',
      message: confirmMsg,
      confirmText: 'Approve Exchange',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setActionLoadingId(ex.id);
        try {
          await approveExchangeRequest(ex.id, {}, ex.docId);
          showToast(`✓ Exchange #${ex.id} approved successfully!`, 'success');
          // Optimistically update local exchanges state immediately
          setExchanges(prev => prev.map(item => {
            if ((item.id || item.docId) === (ex.id || ex.docId)) {
              return {
                ...item,
                status: 'APPROVED',
                adminDecision: 'APPROVED'
              };
            }
            return item;
          }));
          // Open Exchange Successful Popup Modal
          setSuccessModal({
            open: true,
            exchange: { ...ex, status: 'APPROVED', adminDecision: 'APPROVED' }
          });
        } catch (err) {
          showToast(`Approval failed: ${err.message}`, 'error');
        } finally {
          setActionLoadingId(null);
        }
      }
    });
  };

  // 2. Reject Exchange (Opens Rejection Modal with mandatory reason)
  const openRejectModal = (ex) => {
    setRejectModal({ open: true, exchange: ex });
    setRejectionReasonSelect('');
    setRejectionCustomText('');
  };

  const handleConfirmReject = async () => {
    const ex = rejectModal.exchange;
    if (!ex) return;

    const finalReason = rejectionReasonSelect === 'Other'
      ? rejectionCustomText.trim()
      : (rejectionReasonSelect || rejectionCustomText.trim());

    if (!finalReason) {
      showToast('Please specify a rejection reason.', 'warning');
      return;
    }

    setActionLoadingId(ex.id);
    try {
      await rejectExchangeRequest(ex.id, finalReason, ex.docId);
      showToast(`Exchange #${ex.id} rejected. Customer notified via profile.`, 'info');
      setRejectModal({ open: false, exchange: null });
    } catch (err) {
      showToast(`Rejection failed: ${err.message}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. Retry Reverse Pickup
  const handleRetryPickup = async (ex) => {
    setActionLoadingId(ex.id);
    try {
      const res = await retryReversePickup(ex.id, ex.docId);
      showToast(`✓ Delhivery Reverse Pickup Scheduled (AWB: ${res.reversePickupAwb})`, 'success');
    } catch (err) {
      showToast(`Retry failed: ${err.message}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 4. Update Status (Received, QC, etc.) - Optimistic UI
  const handleUpdateStatus = async (ex, nextStatus, extraPayload = {}) => {
    const previousExchanges = [...exchanges];
    const meta = EXCHANGE_STATUS_METADATA[nextStatus];

    // 1. Optimistic UI update
    setExchanges(prev => prev.map(item => (item.id === ex.id || item.docId === ex.docId) ? { ...item, status: nextStatus, ...extraPayload } : item));
    showToast(`Status updated to: ${meta?.label || nextStatus}`, 'success');

    // 2. Background update
    try {
      await updateExchangeStatus(ex.id, nextStatus, extraPayload, ex.docId);
    } catch (err) {
      console.error('Failed to update exchange status:', err);
      // 3. Rollback on failure
      setExchanges(previousExchanges);
      showToast(`Update failed: ${err.message}`, 'error', 7000, {
        label: 'Retry',
        onClick: () => handleUpdateStatus(ex, nextStatus, extraPayload)
      });
    }
  };

  // 5. Open Dispatch Replacement Modal
  const openDispatchModal = (ex) => {
    setDispatchModal({ open: true, exchange: ex });
    setReplacementAwbInput('');
  };

  const handleConfirmDispatch = async () => {
    const ex = dispatchModal.exchange;
    if (!ex) return;
    if (!replacementAwbInput.trim()) {
      showToast('Please enter the Delhivery Replacement AWB.', 'warning');
      return;
    }

    setActionLoadingId(ex.id);
    try {
      await updateExchangeStatus(ex.id, EXCHANGE_STATUS.REPLACEMENT_SHIPPED, {
        replacementAwb: replacementAwbInput.trim()
      }, ex.docId);
      showToast(`✓ Replacement dispatched! AWB: ${replacementAwbInput.trim()}`, 'success');
      setDispatchModal({ open: false, exchange: null });
    } catch (err) {
      showToast(`Dispatch failed: ${err.message}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="admin-exchanges-page">
      {/* Header & Metrics */}
      <div className="admin-exchanges-header">
        <div>
          <h1 className="admin-page-title">Exchange Management</h1>
          <p className="admin-page-subtitle">
            Secure Exchange-Only Workflow • Review, Approval & Replacement Fulfillment
          </p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="admin-exchanges-metrics">
        <div className="metric-box" onClick={() => setStatusFilter('ALL')}>
          <div className="metric-label">Total Requests</div>
          <div className="metric-value">{metrics.total}</div>
        </div>
        <div className={`metric-box ${metrics.pending > 0 ? 'highlight-pending' : ''}`} onClick={() => setStatusFilter('PENDING')}>
          <div className="metric-label">Needs Review</div>
          <div className="metric-value">{metrics.pending}</div>
        </div>
        <div className="metric-box" onClick={() => setStatusFilter('APPROVED')}>
          <div className="metric-label">Approved</div>
          <div className="metric-value">{metrics.approved}</div>
        </div>
        <div className="metric-box" onClick={() => setStatusFilter('QC')}>
          <div className="metric-label">Hub & QC</div>
          <div className="metric-value">{metrics.inTransitOrQC}</div>
        </div>
        <div className="metric-box" onClick={() => setStatusFilter('REPLACEMENT')}>
          <div className="metric-label">Replacement Shipped</div>
          <div className="metric-value">{metrics.replacement}</div>
        </div>
        <div className="metric-box" onClick={() => setStatusFilter('COMPLETED')}>
          <div className="metric-label">Completed</div>
          <div className="metric-value">{metrics.completed}</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="admin-exchanges-controls">
        <div className="filter-tabs-scroll">
          <button className={`filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`} onClick={() => setStatusFilter('ALL')}>
            All ({metrics.total})
          </button>
          <button className={`filter-tab ${statusFilter === 'PENDING' ? 'active' : ''}`} onClick={() => setStatusFilter('PENDING')}>
            Pending Review ({metrics.pending})
          </button>
          <button className={`filter-tab ${statusFilter === 'APPROVED' ? 'active' : ''}`} onClick={() => setStatusFilter('APPROVED')}>
            Approved ({metrics.approved})
          </button>
          <button className={`filter-tab ${statusFilter === 'QC' ? 'active' : ''}`} onClick={() => setStatusFilter('QC')}>
            Hub & QC ({metrics.inTransitOrQC})
          </button>
          <button className={`filter-tab ${statusFilter === 'REPLACEMENT' ? 'active' : ''}`} onClick={() => setStatusFilter('REPLACEMENT')}>
            Replacement Dispatched ({metrics.replacement})
          </button>
          <button className={`filter-tab ${statusFilter === 'COMPLETED' ? 'active' : ''}`} onClick={() => setStatusFilter('COMPLETED')}>
            Completed ({metrics.completed})
          </button>
          <button className={`filter-tab ${statusFilter === 'REJECTED' ? 'active' : ''}`} onClick={() => setStatusFilter('REJECTED')}>
            Rejected ({metrics.rejected})
          </button>
        </div>

        <div className="search-box-wrap">
          <input
            type="text"
            placeholder="Search by Order ID, Exchange ID, Customer, Phone, or AWB..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-search-input"
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>
      </div>

      {/* Main Table / List */}
      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-spinner"></div>
          <p>Loading exchange requests...</p>
        </div>
      ) : filteredExchanges.length === 0 ? (
        <div className="admin-empty-state">
          <span className="empty-state-icon">🔄</span>
          <h3>No exchange requests found</h3>
          <p>
            {searchTerm
              ? `No requests match "${searchTerm}" in the current filter.`
              : 'There are no exchange requests in this category.'}
          </p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-exchanges-table">
            <thead>
              <tr>
                <th>Request & Order</th>
                <th>Customer</th>
                <th>Product & Replacement</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Logistics / Reverse AWB</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExchanges.map((ex) => {
                const meta = EXCHANGE_STATUS_METADATA[ex.status] || {
                  label: ex.status,
                  badgeClass: 'badge-pending'
                };
                const stockInfo = getRequestedVariantStock(ex);
                const isLoading = actionLoadingId === ex.id;
                const formattedDate = ex.createdAt
                  ? new Date(ex.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Recent';

                const targetProduct = (ex.productId && productsMap.get(ex.productId)) ||
                                      (ex.productName && productsMap.get(ex.productName.toLowerCase().trim())) ||
                                      null;
                const productSlug = targetProduct?.slug || ex.productSlug || ex.productId;
                const productLiveUrl = productSlug ? `/product/${productSlug}` : null;

                return (
                  <tr key={ex.id || ex.docId} className={`exchange-row ${ex.status === EXCHANGE_STATUS.PENDING_ADMIN_REVIEW ? 'row-pending' : ''}`}>
                    {/* Column 1: Request & Order */}
                    <td className="col-req-id">
                      <div className="req-id-text">#{ex.id}</div>
                      <div className="order-link-text">
                        Order: <Link to={`/admin/orders?q=${ex.orderId}`} className="table-link">#{ex.orderId}</Link>
                      </div>
                      <span className="req-time-text">{formattedDate}</span>
                    </td>

                    {/* Column 2: Customer */}
                    <td className="col-customer">
                      <div className="customer-name">{ex.shippingAddress?.fullName || 'Customer'}</div>
                      <div className="customer-contact">{ex.userPhone || ex.shippingAddress?.phone || ex.userEmail}</div>
                      <div className="customer-location">
                        {ex.shippingAddress?.city ? `${ex.shippingAddress.city}, ${ex.shippingAddress.state}` : ''}
                      </div>
                    </td>

                    {/* Column 3: Product & Replacement Variant */}
                    <td className="col-product">
                      <div className="prod-cell-wrap">
                        {productLiveUrl ? (
                          <Link
                            to={productLiveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="table-prod-img-link"
                            title={`Open live product: ${ex.productName || 'Garment Item'}`}
                          >
                            <img
                              src={ex.productImage || ex.productImageSnapshot || '/images/hero.png'}
                              alt={ex.productName}
                              className="table-prod-img"
                            />
                          </Link>
                        ) : (
                          <img
                            src={ex.productImage || ex.productImageSnapshot || '/images/hero.png'}
                            alt={ex.productName}
                            className="table-prod-img"
                          />
                        )}
                        <div className="prod-cell-info">
                          {productLiveUrl ? (
                            <Link
                              to={productLiveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="table-prod-name table-prod-link"
                              title={`Open live product in store: ${ex.productName || 'Garment Item'}`}
                            >
                              <span>{ex.productName || 'Garment Item'}</span>
                              <span className="open-ext-icon" aria-hidden="true">↗</span>
                            </Link>
                          ) : (
                            <div className="table-prod-name" title={ex.productName}>
                              {ex.productName || 'Garment Item'}
                            </div>
                          )}
                          <div className="variant-diff-row">
                            <span className="var-chip current">Size: {ex.currentVariant?.size || 'N/A'}</span>
                            <span className="var-arrow">→</span>
                            <span className="var-chip requested">Req: Size {ex.requestedVariant?.size || 'N/A'}</span>
                          </div>
                          {stockInfo && stockInfo.found && (
                            <div className={`stock-status-tag ${stockInfo.inStock ? 'in-stock' : 'out-of-stock'}`}>
                              {stockInfo.inStock ? `● Stock Available (${stockInfo.quantity})` : '✕ Out of Stock (0)'}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Column 4: Reason */}
                    <td className="col-reason">
                      <div className="reason-pill">{ex.reason}</div>
                      {ex.customerMessage && (
                        <div className="table-cust-note" title={ex.customerMessage}>
                          "{ex.customerMessage}"
                        </div>
                      )}
                    </td>

                    {/* Column 5: Status */}
                    <td className="col-status">
                      <span className={`exchange-status-pill ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                    </td>

                    {/* Column 6: Logistics / Reverse AWB */}
                    <td className="col-logistics">
                      {ex.reversePickupAwb ? (
                        <div className="logistics-cell-block">
                          <div className="awb-badge">
                            Reverse: <strong>{ex.reversePickupAwb}</strong>
                          </div>
                          <div className="logistics-sub">{ex.reversePickupStatus || 'Scheduled with Delhivery'}</div>
                        </div>
                      ) : (ex.status === 'APPROVED' || ex.status === EXCHANGE_STATUS.APPROVED) ? (
                        <span className="pickup-pending-tag" style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
                          ✓ Approved
                        </span>
                      ) : ex.status === EXCHANGE_STATUS.REVERSE_PICKUP_PENDING ? (
                        <span className="pickup-pending-tag">⚠️ Pickup Failed</span>
                      ) : (
                        <span className="no-pickup-tag">—</span>
                      )}

                      {ex.replacementAwb && (
                        <div className="replacement-awb-badge">
                          Replacement: <strong>{ex.replacementAwb}</strong>
                        </div>
                      )}
                    </td>

                    {/* Column 7: Actions */}
                    <td className="col-actions">
                      <div className="table-action-buttons">
                        {/* PENDING ACTIONS */}
                        {ex.status === EXCHANGE_STATUS.PENDING_ADMIN_REVIEW && (
                          <>
                            <button
                              type="button"
                              className="btn-admin-approve"
                              onClick={() => handleApprove(ex)}
                              disabled={isLoading}
                              title="Approve exchange request"
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              className="btn-admin-reject"
                              onClick={() => openRejectModal(ex)}
                              disabled={isLoading}
                              title="Reject exchange request"
                            >
                              ✕ Reject
                            </button>
                          </>
                        )}

                        {/* PICKUP PENDING RETRY */}
                        {ex.status === EXCHANGE_STATUS.REVERSE_PICKUP_PENDING && (
                          <button
                            type="button"
                            className="btn-admin-retry"
                            onClick={() => handleRetryPickup(ex)}
                            disabled={isLoading}
                            title="Retry scheduling Delhivery Reverse Pickup"
                          >
                            🔄 Retry Pickup
                          </button>
                        )}

                        {/* APPROVED / PICKUP IN PROGRESS */}
                        {([EXCHANGE_STATUS.APPROVED, 'APPROVED', EXCHANGE_STATUS.REVERSE_PICKUP_CREATED].includes(ex.status)) && (
                          <button
                            type="button"
                            className="btn-admin-next"
                            onClick={() => handleUpdateStatus(ex, EXCHANGE_STATUS.RECEIVED)}
                            disabled={isLoading}
                            title="Mark item received at warehouse hub"
                          >
                            Mark Received at Hub
                          </button>
                        )}

                        {ex.status === EXCHANGE_STATUS.PICKED_UP && (
                          <button
                            type="button"
                            className="btn-admin-next"
                            onClick={() => handleUpdateStatus(ex, EXCHANGE_STATUS.RECEIVED)}
                            disabled={isLoading}
                          >
                            Mark Received at Hub
                          </button>
                        )}

                        {/* QC STAGE */}
                        {ex.status === EXCHANGE_STATUS.RECEIVED && (
                          <button
                            type="button"
                            className="btn-admin-next"
                            onClick={() => handleUpdateStatus(ex, EXCHANGE_STATUS.QC_PENDING)}
                            disabled={isLoading}
                          >
                            Start QC Check
                          </button>
                        )}

                        {ex.status === EXCHANGE_STATUS.QC_PENDING && (
                          <>
                            <button
                              type="button"
                              className="btn-admin-qc-pass"
                              onClick={() => handleUpdateStatus(ex, EXCHANGE_STATUS.QC_APPROVED)}
                              disabled={isLoading}
                            >
                              ✓ QC Passed
                            </button>
                            <button
                              type="button"
                              className="btn-admin-qc-fail"
                              onClick={() => handleUpdateStatus(ex, EXCHANGE_STATUS.QC_REJECTED, {
                                rejectionReason: 'QC inspection failed: garment damaged or unverified'
                              })}
                              disabled={isLoading}
                            >
                              ✕ QC Failed
                            </button>
                          </>
                        )}

                        {/* REPLACEMENT DISPATCH */}
                        {ex.status === EXCHANGE_STATUS.QC_APPROVED && (
                          <button
                            type="button"
                            className="btn-admin-dispatch"
                            onClick={() => openDispatchModal(ex)}
                            disabled={isLoading}
                          >
                            🚚 Dispatch Replacement
                          </button>
                        )}

                        {ex.status === EXCHANGE_STATUS.REPLACEMENT_SHIPPED && (
                          <button
                            type="button"
                            className="btn-admin-complete"
                            onClick={() => handleUpdateStatus(ex, EXCHANGE_STATUS.COMPLETED)}
                            disabled={isLoading}
                          >
                            ✓ Mark Completed
                          </button>
                        )}

                        {/* View Details Drawer Button */}
                        <button
                          type="button"
                          className="btn-admin-view"
                          onClick={() => setSelectedExchangeId(ex.id || ex.docId)}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Drawer / Modal */}
      {selectedExchange && (
        <div className="admin-drawer-overlay" onClick={() => setSelectedExchangeId(null)}>
          <div className="admin-drawer-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-drawer-header">
              <div>
                <h2>Exchange Request #{selectedExchange.id}</h2>
                <p>Order #{selectedExchange.orderId}</p>
              </div>
              <button className="admin-drawer-close" onClick={() => setSelectedExchangeId(null)}>✕</button>
            </div>

            <div className="admin-drawer-body">
              {/* Status Bar */}
              <div className="drawer-status-bar">
                <span className="status-label">Current Status:</span>
                <span className={`exchange-status-pill ${EXCHANGE_STATUS_METADATA[selectedExchange.status]?.badgeClass || 'badge-pending'}`}>
                  {EXCHANGE_STATUS_METADATA[selectedExchange.status]?.label || selectedExchange.status}
                </span>
              </div>

              {/* Product & Variant Exchange Details */}
              <div className="drawer-section">
                <div className="drawer-section-title">Product & Replacement Details</div>
                {(() => {
                  const drawerTargetProd = (selectedExchange.productId && productsMap.get(selectedExchange.productId)) ||
                                           (selectedExchange.productName && productsMap.get(selectedExchange.productName.toLowerCase().trim())) ||
                                           null;
                  const drawerProductSlug = drawerTargetProd?.slug || selectedExchange.productSlug || selectedExchange.productId;
                  const drawerProductLiveUrl = drawerProductSlug ? `/product/${drawerProductSlug}` : null;
                  const drawerAdminEditUrl = drawerTargetProd?.id ? `/admin/products/${drawerTargetProd.id}/edit` : null;

                  return (
                    <div className="drawer-product-row">
                      {drawerProductLiveUrl ? (
                        <Link
                          to={drawerProductLiveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="drawer-product-img-link"
                          title="Open live product page"
                        >
                          <img
                            src={selectedExchange.productImage || selectedExchange.productImageSnapshot || '/images/hero.png'}
                            alt={selectedExchange.productName}
                            className="drawer-product-img"
                          />
                        </Link>
                      ) : (
                        <img
                          src={selectedExchange.productImage || selectedExchange.productImageSnapshot || '/images/hero.png'}
                          alt={selectedExchange.productName}
                          className="drawer-product-img"
                        />
                      )}
                      <div className="drawer-product-info-wrap">
                        <div className="drawer-product-title-row">
                          <h3 className="drawer-product-name">{selectedExchange.productName}</h3>
                          {drawerProductLiveUrl && (
                            <Link
                              to={drawerProductLiveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-open-live-product"
                              title="Open product page in store"
                            >
                              <span>View Product</span>
                              <span className="open-ext-arrow" aria-hidden="true">↗</span>
                            </Link>
                          )}
                          {drawerAdminEditUrl && (
                            <Link
                              to={drawerAdminEditUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-edit-catalog-product"
                              title="Edit in product catalog"
                            >
                              <span>Edit Item</span>
                              <span aria-hidden="true">✎</span>
                            </Link>
                          )}
                        </div>
                        <div className="drawer-variant-summary">
                          <div>Current Size: <strong>{selectedExchange.currentVariant?.size || 'Standard'}</strong></div>
                          <div>Requested Replacement: <strong className="highlight-req">Size {selectedExchange.requestedVariant?.size || 'N/A'}</strong></div>
                        </div>
                        {/* Catalog inventory stock status */}
                        {(() => {
                          const stock = getRequestedVariantStock(selectedExchange);
                          if (!stock || !stock.found) return null;
                          return (
                            <div className={`drawer-stock-badge ${stock.inStock ? 'in-stock' : 'out-of-stock'}`}>
                              {stock.inStock
                                ? `✓ Replacement size in stock (${stock.quantity} units available)`
                                : '⚠️ Replacement size is OUT OF STOCK (0 units)'}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Customer Information & Pickup Address */}
              <div className="drawer-section">
                <div className="drawer-section-title">Pickup Address & Customer Info</div>
                <div className="drawer-info-grid">
                  <div><strong>Customer:</strong> {selectedExchange.shippingAddress?.fullName || 'Customer'}</div>
                  <div><strong>Phone:</strong> {selectedExchange.userPhone || selectedExchange.shippingAddress?.phone}</div>
                  <div><strong>Email:</strong> {selectedExchange.userEmail}</div>
                  <div>
                    <strong>Address:</strong> {selectedExchange.shippingAddress?.addressLine || selectedExchange.shippingAddress?.address || ''}, {selectedExchange.shippingAddress?.city} ({selectedExchange.shippingAddress?.pincode})
                  </div>
                </div>
              </div>

              {/* Exchange Reason & Message */}
              <div className="drawer-section">
                <div className="drawer-section-title">Reason & Customer Explanation</div>
                <div className="drawer-reason-box">
                  <strong>Selected Reason:</strong> {selectedExchange.reason}
                </div>
                {selectedExchange.customerMessage && (
                  <div className="drawer-message-box">
                    <strong>Customer Message:</strong> "{selectedExchange.customerMessage}"
                  </div>
                )}
                {selectedExchange.rejectionReason && (
                  <div className="drawer-rejection-box">
                    <strong>Rejection Reason:</strong> {selectedExchange.rejectionReason}
                  </div>
                )}
              </div>

              {/* Logistics Details */}
              <div className="drawer-section">
                <div className="drawer-section-title">Logistics Details</div>
                <div className="drawer-logistics-box">
                  {selectedExchange.reversePickupAwb ? (
                    <>
                      <div><strong>Reverse Pickup AWB:</strong> {selectedExchange.reversePickupAwb}</div>
                      <div><strong>Reverse Pickup Status:</strong> {selectedExchange.reversePickupStatus || 'Pending'}</div>
                    </>
                  ) : (
                    <div><strong>Reverse Pickup:</strong> {selectedExchange.status === EXCHANGE_STATUS.APPROVED ? 'Approved (No courier request)' : 'Not requested'}</div>
                  )}
                  {selectedExchange.replacementAwb && (
                    <div><strong>Replacement Shipment AWB:</strong> {selectedExchange.replacementAwb}</div>
                  )}
                </div>
              </div>

              {/* Audit History Log */}
              {Array.isArray(selectedExchange.history) && selectedExchange.history.length > 0 && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Audit History</div>
                  <div className="drawer-history-timeline">
                    {selectedExchange.history.map((h, i) => (
                      <div key={i} className="drawer-history-item">
                        <span className="history-dot">●</span>
                        <div className="history-info">
                          <span className="history-status">{EXCHANGE_STATUS_METADATA[h.status]?.label || h.status}</span>
                          <span className="history-note">{h.note}</span>
                          <span className="history-time">
                            By {h.actor || 'System'} • {new Date(h.timestamp).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Actions Footer */}
            <div className="admin-drawer-footer">
              {selectedExchange.status === EXCHANGE_STATUS.PENDING_ADMIN_REVIEW && (
                <>
                  <button
                    type="button"
                    className="btn-admin-approve"
                    onClick={() => {
                      handleApprove(selectedExchange);
                    }}
                  >
                    ✓ Approve Exchange
                  </button>
                  <button
                    type="button"
                    className="btn-admin-reject"
                    onClick={() => {
                      openRejectModal(selectedExchange);
                    }}
                  >
                    ✕ Reject Exchange
                  </button>
                </>
              )}

              {selectedExchange.status === EXCHANGE_STATUS.APPROVED && (
                <button
                  type="button"
                  className="btn-admin-action"
                  onClick={() => handleUpdateStatus(selectedExchange.id, EXCHANGE_STATUS.RECEIVED_AT_HUB, 'Item received at warehouse')}
                >
                  📥 Mark Received at Hub
                </button>
              )}

              {selectedExchange.status === EXCHANGE_STATUS.REVERSE_PICKUP_PENDING && (
                <button
                  type="button"
                  className="btn-admin-retry"
                  onClick={() => handleRetryPickup(selectedExchange)}
                >
                  🔄 Retry Reverse Pickup
                </button>
              )}

              <button
                type="button"
                className="btn-admin-close"
                onClick={() => setSelectedExchangeId(null)}
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal (Mandatory Reason Required) */}
      {rejectModal.open && typeof document !== 'undefined' && createPortal(
        <div className="cancel-overlay" onClick={() => setRejectModal({ open: false, exchange: null })}>
          <div className="cancel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cancel-modal-header">
              <h3>Reject Exchange #{rejectModal.exchange?.id}</h3>
              <button className="cancel-modal-close" onClick={() => setRejectModal({ open: false, exchange: null })}>✕</button>
            </div>

            <div className="cancel-modal-body">
              <p className="cancel-modal-desc">
                Select or provide the reason for rejecting this exchange.
                This explanation will be delivered directly to the customer's profile notifications.
              </p>

              <div className="rejection-quick-reasons">
                {QUICK_REJECTION_REASONS.map((r) => (
                  <label key={r} className={`rejection-reason-radio ${rejectionReasonSelect === r ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="adminRejectionReason"
                      value={r}
                      checked={rejectionReasonSelect === r}
                      onChange={(e) => setRejectionReasonSelect(e.target.value)}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>

              {rejectionReasonSelect === 'Other' && (
                <textarea
                  className="cancel-modal-textarea"
                  placeholder="Enter detailed reason for the customer..."
                  value={rejectionCustomText}
                  onChange={(e) => setRejectionCustomText(e.target.value)}
                  rows={3}
                  required
                />
              )}

              <div className="cancel-modal-actions">
                <button
                  type="button"
                  className="cancel-modal-btn-ghost"
                  onClick={() => setRejectModal({ open: false, exchange: null })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cancel-modal-btn-danger"
                  onClick={handleConfirmReject}
                  disabled={!rejectionReasonSelect || (rejectionReasonSelect === 'Other' && !rejectionCustomText.trim())}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dispatch Replacement Modal (Enter Replacement AWB) */}
      {dispatchModal.open && typeof document !== 'undefined' && createPortal(
        <div className="cancel-overlay" onClick={() => setDispatchModal({ open: false, exchange: null })}>
          <div className="cancel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cancel-modal-header">
              <h3>Dispatch Replacement Shipment</h3>
              <button className="cancel-modal-close" onClick={() => setDispatchModal({ open: false, exchange: null })}>✕</button>
            </div>

            <div className="cancel-modal-body">
              <p className="cancel-modal-desc">
                Enter the Delhivery tracking AWB for the replacement garment dispatched to the customer.
              </p>

              <div className="form-group" style={{ margin: '14px 0' }}>
                <label className="exchange-field-label">Delhivery Replacement Waybill / AWB:</label>
                <input
                  type="text"
                  placeholder="e.g. 1403291048291"
                  value={replacementAwbInput}
                  onChange={(e) => setReplacementAwbInput(e.target.value)}
                  className="exchange-text-input"
                  required
                />
              </div>

              <div className="cancel-modal-actions">
                <button
                  type="button"
                  className="cancel-modal-btn-ghost"
                  onClick={() => setDispatchModal({ open: false, exchange: null })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cancel-modal-btn-primary"
                  onClick={handleConfirmDispatch}
                  disabled={!replacementAwbInput.trim()}
                >
                  Mark Replacement Shipped
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Success Popup Modal */}
      {successModal.open && successModal.exchange && createPortal(
        <div className="admin-modal-overlay" onClick={() => setSuccessModal({ open: false, exchange: null })}>
          <div className="admin-modal-content exchange-success-popup" onClick={(e) => e.stopPropagation()}>
            <div className="exchange-success-header">
              <div className="exchange-success-icon-badge">🎉</div>
              <div>
                <span className="exchange-success-kicker">EXCHANGE UPDATED</span>
                <h2 className="exchange-success-title">Exchange Approved Successfully!</h2>
              </div>
            </div>

            <div className="exchange-success-body">
              <div className="exchange-success-details-card">
                <div className="success-detail-row">
                  <span className="label">Exchange ID:</span>
                  <span className="value font-mono">#{successModal.exchange.id}</span>
                </div>
                <div className="success-detail-row">
                  <span className="label">Order ID:</span>
                  <span className="value font-mono">#{successModal.exchange.orderId}</span>
                </div>
                <div className="success-detail-row">
                  <span className="label">Product:</span>
                  <span className="value">{successModal.exchange.productName || 'Garment Item'}</span>
                </div>
                <div className="success-detail-row">
                  <span className="label">Requested Size:</span>
                  <span className="value font-bold">{successModal.exchange.requestedVariant?.size || 'New Size'}</span>
                </div>
                <div className="success-detail-row">
                  <span className="label">Status:</span>
                  <span className="status-badge-approved">✓ APPROVED</span>
                </div>
              </div>

              <div className="exchange-success-notice">
                <div className="notice-icon">ℹ️</div>
                <p>
                  <strong>Reverse Pickup:</strong> Not requested to Delhivery courier.<br />
                  <strong>Customer Notification:</strong> The exchange is marked as Approved. The customer will now see it as Approved on their Exchange / Profile page.
                </p>
              </div>
            </div>

            <div className="exchange-success-footer">
              <button
                type="button"
                className="btn-success-view-approved"
                onClick={() => {
                  setStatusFilter('APPROVED');
                  setSuccessModal({ open: false, exchange: null });
                }}
              >
                View in Approved Tab →
              </button>
              <button
                type="button"
                className="btn-success-done"
                onClick={() => setSuccessModal({ open: false, exchange: null })}
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
