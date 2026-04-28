import { useEffect, useState } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';

function AccountPage({
  user,
  orders,
  bookmarkedVendors = [],
  saving,
  onSave,
  onLogout,
  onDeleteAccount,
  onOpenBookmarkedVendor,
  onOpenPastOrder,
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    shopName: '',
    shopAddress: '',
    upiId: '',
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
  });
  const [showBankDetails, setShowBankDetails] = useState(false);

  useEffect(() => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      password: '',
      shopName: user?.shopName || '',
      shopAddress: user?.shopAddress || '',
      upiId: user?.upiId || '',
      bankName: user?.bankDetails?.bankName || '',
      accountHolderName: user?.bankDetails?.accountHolderName || '',
      accountNumber: user?.bankDetails?.accountNumber || '',
      ifscCode: user?.bankDetails?.ifscCode || '',
    });
    setShowBankDetails(
      Boolean(
        user?.upiId ||
          user?.bankDetails?.bankName ||
          user?.bankDetails?.accountHolderName ||
          user?.bankDetails?.accountNumber ||
          user?.bankDetails?.ifscCode,
      ),
    );
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <div className="dashboard-grid">
      <section className="panel account-panel">
        <div className="account-hero">
          <div>
            <span className="eyebrow">Settings</span>
            <h2>Manage your profile</h2>
            <p>
              Update your account details, strengthen your login, and control your profile
              experience from one place.
            </p>
          </div>
          <div className="account-badge">
            <span>{user?.role === 'vendor' ? 'Vendor Account' : 'Student Account'}</span>
            <strong>{user?.role === 'vendor' ? user?.shopName || user?.name : user?.name}</strong>
          </div>
        </div>

        <form className="vendor-form account-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Email
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Phone
            <input
              name="phone"
              type="text"
              value={formData.phone}
              onChange={handleChange}
            />
          </label>

          <label>
            New Password
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Leave blank to keep current password"
            />
          </label>

          {user?.role === 'vendor' ? (
            <label>
              Shop Name
              <input
                name="shopName"
                type="text"
                value={formData.shopName}
                onChange={handleChange}
                required
              />
            </label>
          ) : null}

          {user?.role === 'vendor' ? (
            <label>
              Shop Address
              <input
                name="shopAddress"
                type="text"
                value={formData.shopAddress}
                onChange={handleChange}
                required
              />
            </label>
          ) : null}

          {user?.role === 'vendor' ? (
            <div className="full-width bank-account-panel">
              <div className="bank-account-panel__header">
                <div>
                  <span className="eyebrow">Payout Details</span>
                  <h3>Bank account and UPI</h3>
                  <p>Add the account details you want to use for future vendor payouts.</p>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setShowBankDetails((current) => !current)}
                >
                  {showBankDetails
                    ? 'Hide Bank Details'
                    : user?.upiId ||
                        user?.bankDetails?.bankName ||
                        user?.bankDetails?.accountNumber
                      ? 'Edit Bank Account'
                      : 'Add Bank Account'}
                </button>
              </div>

              {showBankDetails ? (
                <div className="bank-account-grid">
                  <label>
                    UPI ID
                    <input
                      name="upiId"
                      type="text"
                      value={formData.upiId}
                      onChange={handleChange}
                      placeholder="vendor@upi"
                    />
                  </label>

                  <label>
                    Bank Name
                    <input
                      name="bankName"
                      type="text"
                      value={formData.bankName}
                      onChange={handleChange}
                      placeholder="State Bank of India"
                    />
                  </label>

                  <label>
                    Account Holder
                    <input
                      name="accountHolderName"
                      type="text"
                      value={formData.accountHolderName}
                      onChange={handleChange}
                      placeholder="Restaurant Owner Name"
                    />
                  </label>

                  <label>
                    Account Number
                    <input
                      name="accountNumber"
                      type="text"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      placeholder="1234567890"
                    />
                  </label>

                  <label>
                    IFSC Code
                    <input
                      name="ifscCode"
                      type="text"
                      value={formData.ifscCode}
                      onChange={handleChange}
                      placeholder="SBIN0001234"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="button-row full-width account-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            <button className="ghost-button" type="button" onClick={onLogout}>
              Logout
            </button>
            <button className="danger-button" type="button" onClick={onDeleteAccount}>
              Delete Account
            </button>
          </div>
        </form>
      </section>

      {user?.role === 'student' ? (
        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">Favorites</span>
            <h2>Bookmarked restaurants</h2>
            <p>Keep your go-to hotels saved here for quick access.</p>
          </div>

          <div className="stack-list">
            {bookmarkedVendors.map((vendor) => (
              <button
                className="bookmark-card"
                key={vendor._id}
                type="button"
                onClick={() => onOpenBookmarkedVendor?.(vendor._id)}
              >
                <div>
                  <strong>{vendor.shopName || vendor.name}</strong>
                  <p>{vendor.shopAddress || 'Address not provided'}</p>
                </div>
                <div className="bookmark-card__meta">
                  {vendor.reviewCount ? (
                    <span className="rating-pill">★ {vendor.averageRating.toFixed(1)}</span>
                  ) : null}
                  <span className="hotel-rating__count">
                    {vendor.reviewCount
                      ? `${vendor.reviewCount} rating${vendor.reviewCount > 1 ? 's' : ''}`
                      : 'No ratings yet'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {bookmarkedVendors.length === 0 ? (
            <div className="empty-state">You have not bookmarked any restaurant yet.</div>
          ) : null}
        </section>
      ) : null}

      {user?.role === 'student' ? (
        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">History</span>
            <h2>Past orders</h2>
            <p>Quickly revisit the hotel and total for each order.</p>
          </div>

          <div className="stack-list">
            {orders.map((order) => {
              const vendorNames = [
                ...new Set(
                  order.items
                    .map((item) => item.vendor?.shopName || item.vendor?.name)
                    .filter(Boolean),
                ),
              ];

              return (
                <button
                  className="history-card"
                  key={order._id}
                  type="button"
                  onClick={() => onOpenPastOrder?.(order._id)}
                >
                  <div className="history-card__top">
                    <div>
                      <span className="eyebrow">Order #{order._id.slice(-6).toUpperCase()}</span>
                      <h3>{vendorNames.join(', ') || 'Vendor'}</h3>
                      <p>{formatDateTime(order.createdAt)}</p>
                    </div>
                    <span className={`status-badge status-${order.status}`}>{order.status}</span>
                  </div>

                  <div className="history-card__footer">
                    <span className="history-card__label">Order Total</span>
                    <strong>{formatCurrency(order.totalAmount)}</strong>
                  </div>
                </button>
              );
            })}
          </div>

          {orders.length === 0 ? (
            <div className="empty-state">No past activity available for this account yet.</div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default AccountPage;
