import { useState, useEffect } from 'react';
import { getAdminCustomers } from '../../services/adminService';
import './AdminCustomers.css';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getAdminCustomers();
      setCustomers(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = customers.filter(c => 
    c.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.birthdate?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportCustomersCsv = () => {
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['Name', 'Email', 'Phone', 'Birthdate', 'Age', 'City', 'State', 'Role'];
    const rows = filtered.map(customer => [
      customer.fullName || '',
      customer.email || '',
      customer.phone || '',
      customer.birthdate || '',
      customer.age || '',
      customer.address?.city || '',
      customer.address?.state || '',
      customer.isAdmin ? 'Admin' : 'Customer'
    ]);
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brothers-outfit-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-customers-page">
      <div className="admin-header">
        <h1 className="admin-title">Customers ({customers.length})</h1>
        <button type="button" className="admin-export-customers-btn" onClick={exportCustomersCsv} disabled={loading || filtered.length === 0}>
          Export CSV{filtered.length !== customers.length ? ` (${filtered.length})` : ''}
        </button>
      </div>

      <div className="admin-customers-controls">
        <input 
          type="text" 
          placeholder="Search customers by name, email or phone..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="admin-search-input"
        />
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th>PHONE</th>
              <th>DOB & AGE</th>
              <th>CITY / STATE</th>
              <th>ROLE</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>Loading customers...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>No customers registered yet.</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td><strong>{c.fullName || 'N/A'}</strong></td>
                <td>{c.email || 'N/A'}</td>
                <td>{c.phone || 'N/A'}</td>
                <td>
                  {c.birthdate ? (
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                        {new Date(c.birthdate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        {c.age ? `(${c.age} yrs)` : ''}
                      </span>
                    </div>
                  ) : (
                    c.age ? `${c.age} yrs` : '-'
                  )}
                </td>
                <td>{c.address ? `${c.address.city || ''}, ${c.address.state || ''}` : '-'}</td>
                <td>
                  <span className={`admin-badge admin-badge--${c.isAdmin ? 'active' : 'neutral'}`}>
                    {c.isAdmin ? 'Admin' : 'Customer'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
