import { useMemo, useState } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';

const initialFoodForm = {
  name: '',
  description: '',
  category: '',
  price: '',
  imageUrl: '',
  foodType: 'veg',
  isAvailable: true,
};

function VendorDashboard({
  items,
  orders,
  selectedDate,
  saving,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onSeedItems,
  onDateChange,
  onUpdateOrderStatus,
  showMenu = true,
  showOrders = true,
}) {
  const [formData, setFormData] = useState(initialFoodForm);
  const [editingId, setEditingId] = useState('');
  const selectedDateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const selectedDayRevenue = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          ['canceled', 'rejected'].includes(order.status)
            ? sum
            : sum + order.items.reduce((inner, item) => inner + item.price * item.quantity, 0),
        0,
      ),
    [orders],
  );

  const getVisibleOrderRevenue = (order) =>
    order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setFormData(initialFoodForm);
    setEditingId('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      ...formData,
      price: Number(formData.price),
    };

    if (editingId) {
      onUpdateItem(editingId, payload);
    } else {
      onCreateItem(payload);
    }

    resetForm();
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setFormData({
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      imageUrl: item.imageUrl || '',
      foodType: item.foodType || 'veg',
      isAvailable: item.isAvailable,
    });
  };

  return (
    <div className="dashboard-grid">
      {showMenu ? (
        <section className="panel vendor-catalog-panel">
          <div className="section-heading">
            <span className="eyebrow">Vendor Panel</span>
            <h2>Manage your food catalog</h2>
            <p>Add dishes, edit prices, and toggle availability for students.</p>
          </div>

          <form className="vendor-form vendor-form--premium" onSubmit={handleSubmit}>
            <label>
              Food Name
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="Paneer Wrap"
                required
              />
            </label>

            <label>
              Category
              <input
                name="category"
                type="text"
                value={formData.category}
                onChange={handleChange}
                placeholder="Snacks"
                required
              />
            </label>

            <label className="full-width">
              Description
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Soft wrap loaded with paneer tikka and sauces."
                rows="3"
                required
              />
            </label>

            <label>
              Price
              <input
                name="price"
                type="number"
                min="0"
                value={formData.price}
                onChange={handleChange}
                placeholder="90"
                required
              />
            </label>

            <label>
              Image URL
              <input
                name="imageUrl"
                type="text"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder="https://..."
              />
            </label>

            <label>
              Food Type
              <select name="foodType" value={formData.foodType} onChange={handleChange}>
                <option value="veg">Veg</option>
                <option value="non-veg">Non-Veg</option>
              </select>
            </label>

            <label className="checkbox-row">
              <input
                name="isAvailable"
                type="checkbox"
                checked={formData.isAvailable}
                onChange={handleChange}
              />
              Available for ordering
            </label>

            <div className="button-row full-width vendor-form__actions">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
              </button>
              <button className="ghost-button" type="button" onClick={resetForm}>
                Clear
              </button>
              <button className="secondary-button" type="button" onClick={onSeedItems}>
                Add Sample Menu
              </button>
            </div>
          </form>

          <div className="card-grid vendor-catalog-grid">
            {items.map((item) => (
              <article className="food-card vendor-item-card" key={item._id}>
                {item.imageUrl ? (
                  <img
                    className="food-card__image vendor-item-card__image"
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}

                <div className="food-card__header vendor-item-card__header">
                  <div className="food-card__meta food-card__meta--start">
                    <span className={`food-type-marker food-type-marker--${item.foodType || 'veg'}`}>
                      <span className="food-type-marker__dot"></span>
                    </span>
                    <span className="pill">{item.category}</span>
                  </div>
                  <span className="price-tag">{formatCurrency(item.price)}</span>
                </div>
                <div className="vendor-item-card__body">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
                <div className="food-card__footer vendor-item-card__footer">
                  <span
                    className={
                      item.isAvailable
                        ? 'available vendor-item-card__availability'
                        : 'unavailable vendor-item-card__availability'
                    }
                  >
                    {item.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                  <div className="inline-actions vendor-item-card__actions">
                    <button className="ghost-button" type="button" onClick={() => startEdit(item)}>
                      Edit
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => onDeleteItem(item._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {items.length === 0 ? (
            <div className="empty-state">Your menu is empty. Add an item or seed sample data.</div>
          ) : null}
        </section>
      ) : null}

      {showOrders ? (
        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">Orders</span>
            <h2>Watch incoming orders in real time</h2>
            <p>New days start fresh. Pick any date from the calendar to review past orders.</p>
          </div>

          <div className="summary-grid">
            <div className="metric-card metric-card--premium">
              <span>Total Orders</span>
              <strong>{orders.length}</strong>
              <p>{selectedDateLabel}</p>
            </div>
            <label className="date-card">
              <div className="date-card__header">
                <span>Calendar View</span>
                <strong>{selectedDateLabel}</strong>
              </div>
              <p>Jump between days to review past orders and revenue for that date.</p>
              <div className="date-card__input-shell">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => onDateChange(event.target.value)}
                />
              </div>
            </label>
          </div>

          <div className="stack-list">
            {orders.map((order) => (
              <article className="order-card" key={order._id}>
                <div className="order-card__glow"></div>
                <div className="order-card__top">
                  <div>
                    <h3>Order #{order._id.slice(-6).toUpperCase()}</h3>
                    <p>
                      {order.student?.name || 'Student'}
                      {' | '}
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  {order.status === 'canceled' ? (
                    <span className="status-badge status-canceled">canceled</span>
                  ) : order.status === 'rejected' ? (
                    <span className="status-badge status-rejected">rejected</span>
                  ) : order.status === 'delivered' ? (
                    <span className="status-badge status-delivered">delivered</span>
                  ) : (
                    <div className="status-switcher">
                      {order.status === 'pending' ? (
                        <>
                          <button
                            className="status-switcher__button status-switcher__button--accept"
                            type="button"
                            onClick={() => onUpdateOrderStatus(order._id, 'accepted')}
                          >
                            Accept
                          </button>
                          <button
                            className="status-switcher__button status-switcher__button--danger"
                            type="button"
                            onClick={() => onUpdateOrderStatus(order._id, 'rejected')}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}

                      {order.status === 'accepted' ? (
                        <>
                          <span className="status-switcher__label status-switcher__label--success">
                            Accepted
                          </span>
                          <button
                            className="status-switcher__button status-switcher__button--progress"
                            type="button"
                            onClick={() => onUpdateOrderStatus(order._id, 'prepared')}
                          >
                            Mark Prepared
                          </button>
                          <button
                            className="status-switcher__button status-switcher__button--danger"
                            type="button"
                            onClick={() => onUpdateOrderStatus(order._id, 'rejected')}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}

                      {['prepared', 'preparing'].includes(order.status) ? (
                        <>
                          <span className="status-switcher__label status-switcher__label--progress">
                            Prepared
                          </span>
                          <button
                            className="status-switcher__button status-switcher__button--success"
                            type="button"
                            onClick={() => onUpdateOrderStatus(order._id, 'delivered')}
                          >
                            Mark Delivered
                          </button>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="stack-list compact">
                  {order.items.map((item, index) => (
                    <div className="list-item" key={`${order._id}-${index}`}>
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.quantity} portion(s)</p>
                      </div>
                      <span>{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="order-revenue-bar">
                  <div className="order-revenue-bar__item">
                    <span>Items</span>
                    <strong>{order.items.length}</strong>
                  </div>
                  <div className="order-revenue-bar__item">
                    <span>
                      {['canceled', 'rejected'].includes(order.status) ? 'Revenue' : 'Order Revenue'}
                    </span>
                    <strong>
                      {['canceled', 'rejected'].includes(order.status)
                        ? formatCurrency(0)
                        : formatCurrency(getVisibleOrderRevenue(order))}
                    </strong>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {orders.length > 0 ? (
            <div className="day-revenue-card">
              <div>
                <span className="eyebrow">Daily Summary</span>
                <h3>Whole Day Revenue</h3>
                <p>Calculated for {selectedDateLabel} from accepted, prepared, and delivered orders.</p>
              </div>
              <strong>{formatCurrency(selectedDayRevenue)}</strong>
            </div>
          ) : null}

          {orders.length === 0 ? (
            <div className="empty-state">
              No orders were placed on {selectedDateLabel}. Pick another date from the calendar to
              review past activity.
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default VendorDashboard;
