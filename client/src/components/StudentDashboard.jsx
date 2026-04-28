import { useEffect, useState } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';

function StudentDashboard({
  menuItems,
  orders,
  bookmarkedVendorIds = [],
  selectedVendorId: selectedVendorIdProp = '',
  highlightedOrderId = '',
  recentlyAddedFoodId = '',
  menuLoading,
  onAddToCart,
  onUpdateOrderItem,
  onCancelOrder,
  onRateVendor,
  onToggleBookmark,
  onClearSelectedVendor,
  showMenu = true,
  showOrders = true,
}) {
  const [activeOrderMenu, setActiveOrderMenu] = useState('');
  const [editingOrderId, setEditingOrderId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  useEffect(() => {
    setSelectedVendorId(selectedVendorIdProp || '');
  }, [selectedVendorIdProp]);

  useEffect(() => {
    if (!highlightedOrderId || !showOrders) {
      return;
    }

    const orderElement = document.querySelector(`[data-order-id="${highlightedOrderId}"]`);

    if (orderElement) {
      orderElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [highlightedOrderId, showOrders, orders]);

  const visibleMenuItems = menuItems.filter((item) => item.vendor);
  const vendorDirectory = visibleMenuItems.reduce((groups, item) => {
    const vendorId = item.vendor._id;

    if (!groups[vendorId]) {
      groups[vendorId] = {
        vendorId,
        vendorName: item.vendor.shopName || item.vendor.name,
        vendorAddress: item.vendor.shopAddress || 'Address not provided',
        averageRating: item.vendor.averageRating || 0,
        reviewCount: item.vendor.reviewCount || 0,
        items: [],
        availableItems: 0,
        bestseller: null,
      };
    }

    groups[vendorId].items.push(item);

    if (item.isAvailable) {
      groups[vendorId].availableItems += 1;
    }

    if (!groups[vendorId].bestseller && item.isAvailable) {
      groups[vendorId].bestseller = item;
    }

    return groups;
  }, {});
  const selectedVendor = selectedVendorId ? vendorDirectory[selectedVendorId] : null;
  const scopedMenuItems = selectedVendorId
    ? visibleMenuItems.filter((item) => item.vendor._id === selectedVendorId)
    : visibleMenuItems;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredMenuItems = scopedMenuItems.filter((item) => {
    if (!normalizedSearch) {
      return true;
    }

    return item.name.toLowerCase().includes(normalizedSearch);
  });

  const groupedMenu = filteredMenuItems.reduce((groups, item) => {
    const vendorId = item.vendor._id;

    if (!groups[vendorId]) {
      groups[vendorId] = {
        vendorId,
        vendorName: item.vendor.shopName || item.vendor.name,
        vendorAddress: item.vendor.shopAddress || 'Address not provided',
        averageRating: item.vendor.averageRating || 0,
        reviewCount: item.vendor.reviewCount || 0,
        items: [],
      };
    }

    groups[vendorId].items.push(item);
    return groups;
  }, {});

  const vendorMenus = Object.values(groupedMenu);

  const toggleOrderMenu = (orderId) => {
    setActiveOrderMenu((current) => (current === orderId ? '' : orderId));
  };

  const openOrderEditor = (orderId) => {
    setEditingOrderId((current) => (current === orderId ? '' : orderId));
    setActiveOrderMenu('');
  };

  return (
    <div className="dashboard-grid">
      {showMenu ? (
        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">Menu</span>
            <h2>Browse today&apos;s campus specials</h2>
            <p>Students can add items from any vendor and place their order in seconds.</p>
            {selectedVendor ? (
              <button
                className="ghost-button menu-back-button"
                type="button"
                onClick={() => {
                  setSelectedVendorId('');
                  onClearSelectedVendor?.();
                }}
              >
                Back to Menu
              </button>
            ) : null}
          </div>

          <div className="search-shell">
            <div className="search-bar">
              <span className="search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <circle
                    cx="11"
                    cy="11"
                    r="6.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M16 16l4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                className="search-input"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search an item like dosa, burger, coffee..."
              />
              {searchTerm ? (
                <button
                  className="ghost-button search-clear"
                  type="button"
                  onClick={() => setSearchTerm('')}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="search-caption">
              {selectedVendor
                ? `Showing the full menu for ${selectedVendor.vendorName}.`
                : normalizedSearch
                  ? `Showing restaurants serving "${searchTerm}".`
                  : 'Search for a dish to see which restaurants serve it.'}
            </div>
          </div>

          {menuLoading ? <p>Loading menu...</p> : null}

          <div className="stack-list">
            {vendorMenus.map((vendorMenu) => (
              <article className="vendor-menu" key={vendorMenu.vendorId}>
                {(() => {
                  const isFocusedVendor = selectedVendorId === vendorMenu.vendorId;
                  const visibleItemsForVendor =
                    !normalizedSearch && !isFocusedVendor
                      ? vendorMenu.items.slice(0, 3)
                      : vendorMenu.items;

                  return (
                    <>
                <button
                  className={
                    isFocusedVendor
                      ? 'vendor-menu__header vendor-menu__header--interactive vendor-menu__header--active'
                      : 'vendor-menu__header vendor-menu__header--interactive'
                  }
                  type="button"
                  onClick={() => setSelectedVendorId(vendorMenu.vendorId)}
                >
                  <div>
                    <span className="eyebrow">Hotel</span>
                    <h3>{vendorMenu.vendorName}</h3>
                    <p>{vendorMenu.vendorAddress}</p>
                    {vendorMenu.reviewCount ? (
                      <div className="hotel-rating">
                        <span className="rating-pill">★ {vendorMenu.averageRating.toFixed(1)}</span>
                        <span className="hotel-rating__count">
                          {vendorMenu.reviewCount} rating{vendorMenu.reviewCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="vendor-menu__header-actions">
                    <span className="pill">
                      {isFocusedVendor || normalizedSearch
                        ? `${vendorMenu.items.length} item(s)`
                        : `${visibleItemsForVendor.length} of ${vendorMenu.items.length} items`}
                    </span>
                    {onToggleBookmark ? (
                      <button
                        className={
                          bookmarkedVendorIds.includes(vendorMenu.vendorId)
                            ? 'bookmark-button bookmark-button--active'
                            : 'bookmark-button'
                        }
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleBookmark(vendorMenu.vendorId);
                        }}
                      >
                        <span className="bookmark-button__icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" role="presentation">
                            <path
                              d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1Z"
                              fill={
                                bookmarkedVendorIds.includes(vendorMenu.vendorId)
                                  ? 'currentColor'
                                  : 'none'
                              }
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span>
                          {bookmarkedVendorIds.includes(vendorMenu.vendorId)
                            ? 'Saved'
                            : 'Save'}
                        </span>
                      </button>
                    ) : null}
                    <span className="vendor-menu__link">
                      {isFocusedVendor ? 'Full Menu Open' : 'View Full Menu'}
                    </span>
                  </div>
                </button>

                {vendorMenu.bestseller ? (
                  <div className="vendor-highlight">
                    <div className="vendor-highlight__copy">
                      <span className="eyebrow">Best Seller</span>
                      <h4>{vendorMenu.bestseller.name}</h4>
                      <p>{vendorMenu.bestseller.description}</p>
                    </div>
                    <div className="vendor-highlight__meta">
                      <span className="pill">{vendorMenu.bestseller.category}</span>
                      <strong>{formatCurrency(vendorMenu.bestseller.price)}</strong>
                    </div>
                  </div>
                ) : null}

                <div
                  className={
                    normalizedSearch ? 'card-grid search-results-grid' : 'card-grid'
                  }
                >
                  {visibleItemsForVendor.map((item) => (
                    <article
                      className={item.isAvailable ? 'food-card' : 'food-card food-card--unavailable'}
                      key={item._id}
                    >
                      {item.imageUrl ? (
                        <img
                          className="food-card__image"
                          src={item.imageUrl}
                          alt={item.name}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}

                      <div className="food-card__header">
                        <div className="food-card__meta food-card__meta--start">
                          <span
                            className={`food-type-marker food-type-marker--${item.foodType || 'veg'}`}
                          >
                            <span className="food-type-marker__dot"></span>
                          </span>
                          <span className="pill">{item.category}</span>
                        </div>
                        <div className="food-card__meta">
                          {!item.isAvailable ? (
                            <span className="status-badge status-unavailable">Unavailable</span>
                          ) : null}
                          <span className="price-tag">{formatCurrency(item.price)}</span>
                        </div>
                      </div>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className="food-card__footer">
                        <span>{vendorMenu.vendorName}</span>
                        <button
                          className={
                            item.isAvailable
                              ? recentlyAddedFoodId === item._id
                                ? 'secondary-button add-cart-button add-cart-button--added'
                                : 'secondary-button add-cart-button'
                              : 'ghost-button'
                          }
                          type="button"
                          onClick={() => onAddToCart(item._id)}
                          disabled={!item.isAvailable}
                        >
                          {item.isAvailable
                            ? recentlyAddedFoodId === item._id
                              ? 'Added'
                              : 'Add to Cart'
                            : 'Currently Unavailable'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                    </>
                  );
                })()}
              </article>
            ))}
          </div>

          {!menuLoading && filteredMenuItems.length === 0 ? (
            <div className="empty-state">
              {normalizedSearch
                ? `No restaurants are serving "${searchTerm}" right now.`
                : 'No food items are available yet.'}
            </div>
          ) : null}

          {!menuLoading && visibleMenuItems.length === 0 ? (
            <div className="empty-state">No food items are available yet.</div>
          ) : null}
        </section>
      ) : null}

      {showOrders ? (
        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">Tracking</span>
            <h2>Track your recent orders</h2>
            <p>Order statuses move through pending, accepted, prepared, delivered, or canceled.</p>
          </div>

          <div className="stack-list">
            {orders.map((order) => (
              <article
                className={
                  highlightedOrderId === order._id
                    ? 'order-card order-card--highlighted'
                    : 'order-card'
                }
                data-order-id={order._id}
                key={order._id}
              >
                {(() => {
                  const vendorMap = order.items.reduce((groups, item) => {
                    const vendorId = item.vendor?._id || item.vendor;

                    if (!vendorId || groups[vendorId]) {
                      return groups;
                    }

                    groups[vendorId] = item.vendor;
                    return groups;
                  }, {});

                  const orderVendors = Object.values(vendorMap);

                  return (
                    <>
                <div className="order-card__top">
                  <div>
                    <h3>Order #{order._id.slice(-6).toUpperCase()}</h3>
                    <p>{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="order-card__actions">
                    <span className={`status-badge status-${order.status}`}>{order.status}</span>

                    {order.status === 'pending' ? (
                      <div className="order-menu">
                        <button
                          className="ghost-button order-menu__trigger"
                          type="button"
                          onClick={() => toggleOrderMenu(order._id)}
                        >
                          Manage Order
                        </button>

                        {activeOrderMenu === order._id ? (
                          <div className="order-menu__dropdown">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => openOrderEditor(order._id)}
                            >
                              {editingOrderId === order._id ? 'Hide Edit Panel' : 'Edit Items'}
                            </button>
                            <button
                              className="danger-button"
                              type="button"
                              onClick={() => {
                                setActiveOrderMenu('');
                                onCancelOrder(order._id);
                              }}
                            >
                              Cancel Order
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="stack-list compact">
                  {order.items.map((item, index) => (
                    <div className="list-item" key={`${order._id}-${index}`}>
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.vendor?.shopName || item.vendor?.name || 'Vendor'}</p>
                      </div>
                      <span>
                        {item.quantity} x {formatCurrency(item.price)}
                      </span>
                    </div>
                  ))}
                </div>

                {order.status === 'delivered' && orderVendors.length ? (
                  <div className="vendor-rating-panel">
                    <span className="eyebrow">Rate Hotel</span>
                    <div className="vendor-rating-list">
                      {orderVendors.map((vendor) => {
                        const vendorId = vendor?._id || '';
                        const savedRating = order.vendorRatings?.[vendorId] || 0;

                        return (
                          <div className="vendor-rating-row" key={`${order._id}-${vendorId}`}>
                            <div>
                              <strong>{vendor?.shopName || vendor?.name || 'Hotel'}</strong>
                              <p>Share your overall experience with this hotel.</p>
                            </div>
                            {savedRating ? (
                              <span className="rating-pill">Rated ★ {savedRating.toFixed(1)}</span>
                            ) : (
                              <div className="rating-stars">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    className="rating-star-button"
                                    key={`${order._id}-${vendorId}-${star}`}
                                    type="button"
                                    onClick={() => onRateVendor(order._id, vendorId, star)}
                                    aria-label={`Rate ${vendor?.shopName || vendor?.name || 'hotel'} ${star} stars`}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {order.status === 'pending' && editingOrderId === order._id ? (
                  <div className="order-edit-panel">
                    <div className="order-edit-panel__header">
                      <div>
                        <span className="eyebrow">Edit Order</span>
                        <h3>Adjust quantities</h3>
                      </div>
                    </div>

                    <div className="stack-list compact">
                      {order.items.map((item, index) => (
                        <div className="list-item" key={`${order._id}-edit-${index}`}>
                          <div>
                            <strong>{item.name}</strong>
                            <p>Change quantity or remove this item before preparation starts.</p>
                          </div>
                          <div className="list-item__actions">
                            <div className="quantity-stepper">
                              <button
                                className="stepper-button"
                                type="button"
                                onClick={() =>
                                  onUpdateOrderItem(order._id, item.food, item.quantity - 1)
                                }
                                aria-label={`Decrease quantity of ${item.name}`}
                              >
                                -
                              </button>
                              <span className="stepper-value">{item.quantity}</span>
                              <button
                                className="stepper-button"
                                type="button"
                                onClick={() =>
                                  onUpdateOrderItem(order._id, item.food, item.quantity + 1)
                                }
                                aria-label={`Increase quantity of ${item.name}`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="button-row">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setEditingOrderId('')}
                      >
                        Done
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => onCancelOrder(order._id)}
                      >
                        Cancel Order
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="summary-box">
                  <span>Order Total</span>
                  <strong>{formatCurrency(order.totalAmount)}</strong>
                </div>
                    </>
                  );
                })()}
              </article>
            ))}
          </div>

          {orders.length === 0 ? (
            <div className="empty-state">You have not placed any orders yet.</div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default StudentDashboard;
