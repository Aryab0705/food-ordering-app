import { formatCurrency } from '../utils/formatters';

function StudentCart({
  cartItems,
  cartLoading,
  orderLoading,
  paymentFeedback = '',
  paymentFailed = false,
  onlinePaymentAvailable = true,
  paymentConfigMessage = '',
  onUpdateCartItem,
  onPlaceOrder,
  onPlaceCashOrder,
}) {
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.food.price * item.quantity,
    0,
  );

  return (
    <section className="panel cart-panel">
      <div className="section-heading">
        <span className="eyebrow">Cart</span>
        <h2>Your selected items</h2>
        <p>Review what you have ordered, update quantities, and see the full total.</p>
      </div>

      {cartLoading ? <p>Loading cart...</p> : null}

      <div className="stack-list">
        {cartItems.map((item) => (
          <div className="list-item" key={item.food._id}>
            <div>
              <strong>{item.food.name}</strong>
              <p>{item.food.vendor?.shopName || item.food.vendor?.name || 'Vendor'}</p>
            </div>
            <div className="list-item__actions">
              <div className="quantity-stepper">
                <button
                  className="stepper-button"
                  type="button"
                  onClick={() => onUpdateCartItem(item.food._id, item.quantity - 1)}
                  aria-label={`Decrease quantity of ${item.food.name}`}
                >
                  -
                </button>
                <span className="stepper-value">{item.quantity}</span>
                <button
                  className="stepper-button"
                  type="button"
                  onClick={() => onUpdateCartItem(item.food._id, item.quantity + 1)}
                  aria-label={`Increase quantity of ${item.food.name}`}
                >
                  +
                </button>
              </div>
              <span>{formatCurrency(item.food.price * item.quantity)}</span>
            </div>
          </div>
        ))}
      </div>

      {!cartLoading && cartItems.length === 0 ? (
        <div className="empty-state">Your cart is empty. Add items from the menu to see them here.</div>
      ) : null}

      {paymentFeedback ? (
        <div className={paymentFailed ? 'flash-message error' : 'flash-message success'}>
          {paymentFeedback}
        </div>
      ) : null}

      <div className="checkout-card">
        <div className="checkout-card__meta">
          <span className="eyebrow">Checkout</span>
          <h3>Proceed to Payment</h3>
          <p>
            {onlinePaymentAvailable
              ? `${cartItems.length} item type(s) ready for UPI, card, wallet, or cash payment.`
              : paymentConfigMessage || 'Online payment is available after Razorpay keys are configured on the server. Cash payment still works right now.'}
          </p>
        </div>

        <div className="checkout-card__total">
          <span>Total Amount</span>
          <strong>{formatCurrency(cartTotal)}</strong>
        </div>

        <div className="checkout-card__actions checkout-card__actions--stacked">
          <button
            className="primary-button checkout-button"
            type="button"
            onClick={onPlaceOrder}
            disabled={orderLoading || cartItems.length === 0 || !onlinePaymentAvailable}
          >
            {orderLoading
              ? 'Opening payment...'
              : paymentFailed && onlinePaymentAvailable
                ? 'Retry Payment'
                : onlinePaymentAvailable
                  ? 'Proceed to Payment'
                  : 'Online Payment Unavailable'}
          </button>
          <button
            className="ghost-button checkout-button"
            type="button"
            onClick={onPlaceCashOrder}
            disabled={orderLoading || cartItems.length === 0}
          >
            {orderLoading ? 'Booking order...' : 'Pay Cash to Vendor'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default StudentCart;
