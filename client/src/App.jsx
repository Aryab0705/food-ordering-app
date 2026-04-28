import { useEffect, useState } from 'react';
import './App.css';
import { apiRequest } from './api/client';
import AccountPage from './components/AccountPage';
import AuthForm from './components/AuthForm';
import StudentCart from './components/StudentCart';
import StudentDashboard from './components/StudentDashboard';
import VendorDashboard from './components/VendorDashboard';
import { useSessionStorage } from './hooks/useSessionStorage';

const emptyUser = null;
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App() {
  const [mode, setMode] = useState('');
  const [studentView, setStudentView] = useSessionStorage('college-food-view', 'menu');
  const [selectedStudentVendorId, setSelectedStudentVendorId] = useSessionStorage(
    'college-food-selected-vendor',
    '',
  );
  const [selectedStudentOrderId, setSelectedStudentOrderId] = useState('');
  const [vendorOrdersDate, setVendorOrdersDate] = useSessionStorage(
    'college-food-vendor-date',
    getTodayString(),
  );
  const [loginOtpSession, setLoginOtpSession] = useState(null);
  const [session, setSession] = useSessionStorage('college-food-session', {
    user: emptyUser,
    token: '',
  });
  const [menuItems, setMenuItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookmarkedVendors, setBookmarkedVendors] = useState([]);
  const [vendorItems, setVendorItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recentlyAddedFoodId, setRecentlyAddedFoodId] = useState('');
  const [paymentFeedback, setPaymentFeedback] = useState('');
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [onlinePaymentAvailable, setOnlinePaymentAvailable] = useState(false);
  const [paymentConfigMessage, setPaymentConfigMessage] = useState('');

  const user = session.user;
  const token = session.token;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const showError = (value) => {
    setError(value);
    setMessage('');
  };

  const showMessage = (value) => {
    setMessage(value);
    setError('');
  };

  const buildSessionUser = (data) => ({
    _id: data._id,
    name: data.name,
    email: data.email,
    role: data.role,
    phone: data.phone,
    shopName: data.shopName,
    shopAddress: data.shopAddress,
    upiId: data.upiId,
    bankDetails: data.bankDetails,
  });

  const loadRazorpayScript = () =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
      document.body.appendChild(script);
    });

  const openRazorpayCheckout = (checkoutConfig) =>
    new Promise((resolve, reject) => {
      if (!checkoutConfig?.key || !checkoutConfig?.orderId || !checkoutConfig?.amount) {
        reject(new Error('Payment setup is incomplete. Missing Razorpay checkout details.'));
        return;
      }

      const razorpay = new window.Razorpay({
        key: checkoutConfig.key,
        amount: checkoutConfig.amount,
        currency: checkoutConfig.currency,
        name: 'Campus Canteen Hub',
        description: 'Food order payment',
        order_id: checkoutConfig.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#1f6f4a',
        },
        handler: (response) => resolve(response),
        modal: {
          ondismiss: () => reject(new Error('Payment was cancelled. You can retry anytime.')),
        },
      });

      razorpay.on('payment.failed', (event) => {
        reject(
          new Error(event.error?.description || 'Payment failed. Please retry the payment.'),
        );
      });

      razorpay.open();
    });

  const loadMenu = async () => {
    setMenuLoading(true);

    try {
      const data = await apiRequest('/api/foods');
      setMenuItems(data);
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setMenuLoading(false);
    }
  };

  const loadStudentData = async () => {
    if (!token) {
      return;
    }

    setCartLoading(true);
    setOrderLoading(true);

    try {
      const [cartData, orderData, bookmarkData] = await Promise.all([
        apiRequest('/api/cart', { token }),
        apiRequest('/api/orders/student', { token }),
        apiRequest('/api/auth/bookmarks', { token }),
      ]);

      setCartItems(cartData);
      setOrders(orderData);
      setBookmarkedVendors(bookmarkData);
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setCartLoading(false);
      setOrderLoading(false);
    }
  };

  const loadPaymentConfig = async () => {
    if (!token || user?.role !== 'student') {
      setOnlinePaymentAvailable(false);
      setPaymentConfigMessage('');
      return;
    }

    try {
      const data = await apiRequest('/api/test-key');
      setOnlinePaymentAvailable(Boolean(data.razorpayEnabled));
      setPaymentConfigMessage(data.message || '');
    } catch {
      setOnlinePaymentAvailable(false);
      setPaymentConfigMessage('Unable to check online payment status right now.');
    }
  };

  const loadVendorData = async () => {
    if (!token) {
      return;
    }

    setVendorSaving(true);

    try {
      const [itemData, orderData] = await Promise.all([
        apiRequest('/api/foods/vendor', { token }),
        apiRequest(`/api/orders/vendor?date=${vendorOrdersDate}`, { token }),
      ]);

      setVendorItems(itemData);
      setOrders(orderData);
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setVendorSaving(false);
    }
  };

  const refreshStudentOrders = async () => {
    if (!token || user?.role !== 'student') {
      return;
    }

    try {
      const orderData = await apiRequest('/api/orders/student', { token });
      setOrders(orderData);
    } catch (apiError) {
      console.error('Student order refresh failed:', apiError);
    }
  };

  const refreshVendorOrders = async () => {
    if (!token || user?.role !== 'vendor') {
      return;
    }

    try {
      const orderData = await apiRequest(`/api/orders/vendor?date=${vendorOrdersDate}`, { token });
      setOrders(orderData);
    } catch (apiError) {
      console.error('Vendor order refresh failed:', apiError);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    if (!user || !token) {
      setCartItems([]);
      setOrders([]);
      setBookmarkedVendors([]);
      setVendorItems([]);
      setOnlinePaymentAvailable(false);
      setPaymentConfigMessage('');
      setStudentView('menu');
      setSelectedStudentVendorId('');
      setSelectedStudentOrderId('');
      return;
    }

    if (user.role === 'student') {
      loadStudentData();
      loadPaymentConfig();
    }

    if (user.role === 'vendor') {
      loadVendorData();
    }
  }, [token, user?.role, vendorOrdersDate]);

  useEffect(() => {
    if (user?.role === 'student' && studentView !== 'menu' && selectedStudentVendorId) {
      setSelectedStudentVendorId('');
    }
  }, [studentView, user?.role, selectedStudentVendorId]);

  useEffect(() => {
    if (!token || !user) {
      return undefined;
    }

    const refreshOrders = user.role === 'student' ? refreshStudentOrders : refreshVendorOrders;
    const intervalId = window.setInterval(() => {
      refreshOrders();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [token, user?.role, vendorOrdersDate]);

  const getDefaultView = (role) => (role === 'vendor' ? 'dashboard' : 'menu');

  const handleAuth = async (formData) => {
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email: formData.email, password: formData.password }
          : formData;

      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: payload,
      });

      if (mode === 'login' && data.requiresOtp) {
        setLoginOtpSession({
          email: data.email,
        });
        setError('');
        return;
      }

      if (mode === 'register') {
        setMode('login');
        setLoginOtpSession(null);
        showMessage('Account created successfully. Please login to continue.');
        return;
      }

      setSession({
        user: buildSessionUser(data),
        token: data.token,
      });
      loadMenu();
      setLoginOtpSession(null);
      setStudentView(getDefaultView(data.role));
      setVendorOrdersDate(getTodayString());
      setOnlinePaymentAvailable(false);
      setPaymentConfigMessage('');
      showMessage(`${data.role === 'student' ? 'Student' : 'Vendor'} account ready.`);
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (otp) => {
    if (!loginOtpSession?.email) {
      showError('Please login again to request a fresh OTP');
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest('/api/auth/verify-login-otp', {
        method: 'POST',
        body: {
          email: loginOtpSession.email,
          otp,
        },
      });

      setSession({
        user: buildSessionUser(data),
        token: data.token,
      });
      loadMenu();
      setLoginOtpSession(null);
      setStudentView(getDefaultView(data.role));
      setVendorOrdersDate(getTodayString());
      setOnlinePaymentAvailable(false);
      setPaymentConfigMessage('');
      showMessage(`${data.role === 'student' ? 'Student' : 'Vendor'} account ready.`);
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendLoginOtp = async () => {
    if (!loginOtpSession?.email) {
      showError('Please login again to request a fresh OTP');
      return;
    }

    setLoading(true);

    try {
      await apiRequest('/api/auth/resend-login-otp', {
        method: 'POST',
        body: {
          email: loginOtpSession.email,
        },
      });
      setError('');
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromOtp = () => {
    setLoginOtpSession(null);
    setError('');
  };

  const handleLogout = () => {
    setSession({ user: emptyUser, token: '' });
    loadMenu();
    setBookmarkedVendors([]);
    setMode('');
    setStudentView('menu');
    setSelectedStudentVendorId('');
    setSelectedStudentOrderId('');
    setVendorOrdersDate(getTodayString());
    setLoginOtpSession(null);
    setPaymentFeedback('');
    setPaymentFailed(false);
    setOnlinePaymentAvailable(false);
    setPaymentConfigMessage('');
    showMessage('You have been logged out.');
  };

  const handleAddToCart = async (foodId) => {
    try {
      const data = await apiRequest('/api/cart', {
        method: 'POST',
        token,
        body: { foodId, quantity: 1 },
      });
      setCartItems(data);
      setRecentlyAddedFoodId(foodId);
      setTimeout(() => {
        setRecentlyAddedFoodId((current) => (current === foodId ? '' : current));
      }, 1400);
      showMessage('Item added to cart.');
    } catch (apiError) {
      if (apiError.message === 'Food item is not available') {
        loadMenu();
        return;
      }

      showError(apiError.message);
    }
  };

  const handleUpdateCartItem = async (foodId, quantity) => {
    try {
      const data = await apiRequest(`/api/cart/${foodId}`, {
        method: 'PUT',
        token,
        body: { quantity },
      });
      setCartItems(data);
    } catch (apiError) {
      showError(apiError.message);
    }
  };

  const handlePlaceOrder = async () => {
    setOrderLoading(true);
    setPaymentFeedback('');
    setPaymentFailed(false);

    try {
      const totalAmount = cartItems.reduce(
  (sum, item) =>
    sum +
    (Number(item?.food?.price || 0) *
      Number(item?.quantity || 1)),
  0
);

      // Step 1: ask the backend to create a secure Razorpay order for the current cart total.
      const checkoutData = await apiRequest('/api/create-order', {
        method: 'POST',
        token,
        body: {
          totalAmount,
        },
      });
      console.log('Razorpay create-order response:', checkoutData);

      if (!checkoutData?.success || !checkoutData?.orderId) {
        throw new Error('Backend did not return a valid Razorpay order response.');
      }

      await loadRazorpayScript();
      const paymentResponse = await openRazorpayCheckout(checkoutData);
      console.log('Razorpay payment response:', paymentResponse);

      // Step 2: once Razorpay returns success, verify the payment signature on the server.
      const verificationResponse = await apiRequest('/api/verify-payment', {
        method: 'POST',
        token,
        body: paymentResponse,
      });
      console.log('Razorpay verify-payment response:', verificationResponse);

      // Step 3: save the actual food orders only after the payment is verified.
      const createdOrders = await apiRequest('/api/save-order', {
        method: 'POST',
        token,
        body: {
          ...paymentResponse,
          paymentMethod: 'razorpay',
        },
      });

      const nextOrders = Array.isArray(createdOrders) ? createdOrders : [createdOrders];
      setOrders((current) => [...nextOrders, ...current]);
      setCartItems([]);
      setStudentView('orders');
      setPaymentFeedback('Payment successful. Your order has been saved.');
      showMessage(
        nextOrders.length > 1
          ? 'Orders placed successfully for multiple restaurants.'
          : 'Order placed successfully.',
      );
    } catch (apiError) {
      console.error('Razorpay checkout flow error:', apiError);
      setPaymentFailed(true);
      setPaymentFeedback(apiError.message);
      setError('');
    } finally {
      setOrderLoading(false);
    }
  };

  const handlePlaceCashOrder = async () => {
    const shouldPlaceCashOrder = window.confirm(
      'Confirm cash payment? Your order will be placed now and you will pay the vendor directly at pickup or delivery.',
    );

    if (!shouldPlaceCashOrder) {
      return;
    }

    setOrderLoading(true);
    setPaymentFeedback('');
    setPaymentFailed(false);

    try {
      const createdOrders = await apiRequest('/api/save-cash-order', {
        method: 'POST',
        token,
      });

      const nextOrders = Array.isArray(createdOrders) ? createdOrders : [createdOrders];
      setOrders((current) => [...nextOrders, ...current]);
      setCartItems([]);
      setStudentView('orders');
      setPaymentFeedback(
        'Cash order booked successfully. Please pay the vendor directly at pickup or delivery.',
      );
      showMessage(
        nextOrders.length > 1
          ? 'Cash orders placed successfully for multiple restaurants.'
          : 'Cash order placed successfully.',
      );
    } catch (apiError) {
      setPaymentFailed(true);
      setPaymentFeedback(apiError.message);
      setError('');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleCreateItem = async (payload) => {
    setVendorSaving(true);

    try {
      const createdItem = await apiRequest('/api/foods', {
        method: 'POST',
        token,
        body: payload,
      });
      setVendorItems((current) => [createdItem, ...current]);
      loadMenu();
      showMessage('Food item added successfully.');
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setVendorSaving(false);
    }
  };

  const handleUpdateItem = async (id, payload) => {
    setVendorSaving(true);

    try {
      const updatedItem = await apiRequest(`/api/foods/${id}`, {
        method: 'PUT',
        token,
        body: payload,
      });

      setVendorItems((current) =>
        current.map((item) => (item._id === id ? updatedItem : item)),
      );
      loadMenu();
      showMessage('Food item updated successfully.');
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setVendorSaving(false);
    }
  };

  const handleDeleteItem = async (id) => {
    setVendorSaving(true);

    try {
      await apiRequest(`/api/foods/${id}`, {
        method: 'DELETE',
        token,
      });
      setVendorItems((current) => current.filter((item) => item._id !== id));
      loadMenu();
      showMessage('Food item deleted successfully.');
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setVendorSaving(false);
    }
  };

  const handleSeedItems = async () => {
    setVendorSaving(true);

    try {
      const seededItems = await apiRequest('/api/foods/seed', {
        method: 'POST',
        token,
      });
      setVendorItems(seededItems);
      loadMenu();
      showMessage('Sample menu added.');
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setVendorSaving(false);
    }
  };

  const handleUpdateOrderStatus = async (id, status) => {
    try {
      const updatedOrder = await apiRequest(`/api/orders/${id}/status`, {
        method: 'PUT',
        token,
        body: { status },
      });

      setOrders((current) =>
        current.map((order) => (order._id === id ? updatedOrder : order)),
      );
      showMessage(`Order status updated to ${status}.`);
    } catch (apiError) {
      if (apiError.message === 'Canceled orders cannot be updated') {
        return;
      }

      showError(apiError.message);
    }
  };

  const handleUpdateStudentOrder = async (orderId, foodId, nextQuantity) => {
    try {
      const currentOrder = orders.find((order) => order._id === orderId);

      if (!currentOrder) {
        return;
      }

      const items = currentOrder.items
        .map((item) => ({
          foodId: String(item.food),
          quantity: String(item.food) === String(foodId) ? nextQuantity : item.quantity,
        }))
        .filter((item) => item.quantity > 0);

      const updatedOrder = await apiRequest(`/api/orders/${orderId}`, {
        method: 'PUT',
        token,
        body: { items },
      });

      if (!updatedOrder) {
        setOrders((current) => current.filter((order) => order._id !== orderId));
        return;
      }

      setOrders((current) =>
        current.map((order) => (order._id === orderId ? updatedOrder : order)),
      );
    } catch (apiError) {
      showError(apiError.message);
    }
  };

  const handleCancelStudentOrder = async (orderId) => {
    const shouldCancel = window.confirm(
      'Are you sure you want to cancel this order?',
    );

    if (!shouldCancel) {
      return;
    }

    try {
      const updatedOrder = await apiRequest(`/api/orders/${orderId}/cancel`, {
        method: 'PUT',
        token,
      });

      if (!updatedOrder) {
        setOrders((current) => current.filter((order) => order._id !== orderId));
        return;
      }

      setOrders((current) =>
        current.map((order) => (order._id === orderId ? updatedOrder : order)),
      );
    } catch (apiError) {
      showError(apiError.message);
    }
  };

  const handleRateVendor = async (orderId, vendorId, rating) => {
    try {
      const data = await apiRequest('/api/vendor-reviews', {
        method: 'POST',
        token,
        body: {
          orderId,
          vendorId,
          rating,
        },
      });

      setOrders((current) =>
        current.map((order) =>
          order._id === orderId
            ? {
                ...order,
                vendorRatings: {
                  ...(order.vendorRatings || {}),
                  [vendorId]: rating,
                },
              }
            : order,
        ),
      );

      loadMenu();
    } catch (apiError) {
      showError(apiError.message);
    }
  };

  const handleToggleBookmark = async (vendorId) => {
    const isBookmarked = bookmarkedVendors.some((vendor) => vendor._id === vendorId);

    try {
      const updatedBookmarks = await apiRequest(
        isBookmarked ? `/api/auth/bookmarks/${vendorId}` : '/api/auth/bookmarks',
        {
          method: isBookmarked ? 'DELETE' : 'POST',
          token,
          body: isBookmarked ? undefined : { vendorId },
        },
      );

      setBookmarkedVendors(updatedBookmarks);
      showMessage(isBookmarked ? 'Restaurant removed from bookmarks.' : 'Restaurant bookmarked.');
    } catch (apiError) {
      showError(apiError.message);
    }
  };

  const handleOpenBookmarkedVendor = (vendorId) => {
    setSelectedStudentVendorId(vendorId);
    setSelectedStudentOrderId('');
    setStudentView('menu');
  };

  const handleOpenPastOrder = (orderId) => {
    setSelectedStudentOrderId(orderId);
    setSelectedStudentVendorId('');
    setStudentView('orders');
  };

  const handleSaveProfile = async (formData) => {
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        shopName: formData.shopName,
        shopAddress: formData.shopAddress,
        upiId: formData.upiId,
        bankDetails: {
          bankName: formData.bankName,
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
        },
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      const updatedUser = await apiRequest('/api/auth/me', {
        method: 'PUT',
        token,
        body: payload,
      });

      setSession({
        user: buildSessionUser(updatedUser),
        token: updatedUser.token,
      });
      showMessage('Profile updated successfully.');
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const shouldDelete = window.confirm(
      'This will permanently delete your account. Do you want to continue?',
    );

    if (!shouldDelete) {
      return;
    }

    setLoading(true);

    try {
      await apiRequest('/api/auth/me', {
        method: 'DELETE',
        token,
      });

      setSession({ user: emptyUser, token: '' });
      setMenuItems([]);
      setCartItems([]);
      setOrders([]);
      setBookmarkedVendors([]);
      setVendorItems([]);
      setStudentView('menu');
      setSelectedStudentVendorId('');
      setSelectedStudentOrderId('');
      setPaymentFeedback('');
      setPaymentFailed(false);
      setMode('login');
      setMessage('');
      setError('');
    } catch (apiError) {
      showError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <nav className="topbar panel">
        <div className="brand-block">
          <div className="brand-mark">CC</div>
          <div>
            <span className="eyebrow">Campus Food</span>
            <strong className="brand-title">Campus Canteen Hub</strong>
            <p>Fresh menus from every college food stall in one place.</p>
          </div>
        </div>

        <div className="topbar-actions">
          {!user ? (
            <div className="button-row">
              <button
                className={mode === 'login' ? 'primary-button' : 'ghost-button'}
                type="button"
                onClick={() => {
                  setMode('login');
                  setLoginOtpSession(null);
                }}
              >
                Login
              </button>
              <button
                className={mode === 'register' ? 'primary-button' : 'ghost-button'}
                type="button"
                onClick={() => {
                  setMode('register');
                  setLoginOtpSession(null);
                }}
              >
                Register
              </button>
            </div>
          ) : (
            <>
              {user.role === 'student' ? (
                <button
                  className="cart-button"
                  type="button"
                  onClick={() => setStudentView('cart')}
                >
                  <span className="cart-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="presentation">
                      <path
                        d="M3 4h2l1.2 6.1A2 2 0 0 0 8.2 12H18a2 2 0 0 0 1.9-1.4L21 7H7.1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="9" cy="19" r="1.4" fill="currentColor" />
                      <circle cx="18" cy="19" r="1.4" fill="currentColor" />
                    </svg>
                  </span>
                  <span>Cart</span>
                  <span className="cart-count">{cartCount}</span>
                </button>
              ) : null}

              {user.role === 'student' ? (
                <button
                  className={studentView === 'menu' ? 'primary-button' : 'ghost-button'}
                  type="button"
                  onClick={() => {
                    setSelectedStudentVendorId('');
                    setSelectedStudentOrderId('');
                    setStudentView('menu');
                  }}
                >
                  Menu
                </button>
              ) : null}

              {user.role === 'student' ? (
                <button
                  className={studentView === 'orders' ? 'primary-button' : 'ghost-button'}
                  type="button"
                  onClick={() => {
                    setSelectedStudentOrderId('');
                    setStudentView('orders');
                  }}
                >
                  Orders
                </button>
              ) : null}

              {user.role === 'vendor' ? (
                <button
                  className={studentView === 'dashboard' ? 'primary-button' : 'ghost-button'}
                  type="button"
                  onClick={() => setStudentView('dashboard')}
                >
                  Menu
                </button>
              ) : null}

              {user.role === 'vendor' ? (
                <button
                  className={studentView === 'vendor-orders' ? 'primary-button' : 'ghost-button'}
                  type="button"
                  onClick={() => setStudentView('vendor-orders')}
                >
                  Orders
                </button>
              ) : null}

              <button
                className="user-pill user-button"
                type="button"
                onClick={() => setStudentView('account')}
              >
                <span>{user.role === 'vendor' ? user.shopName || user.name : user.name}</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {error ? <div className="flash-message error">{error}</div> : null}

      {!user ? (
        <>
          {!mode ? (
            <section className="panel entry-hero">
              <div className="entry-hero__copy">
                <span className="eyebrow">Campus Ordering</span>
                <h1>Smart food ordering for every college canteen.</h1>
                <p>
                  Students can browse menus, compare vendors, and track orders live, while vendors
                  manage menus and incoming requests in one place.
                </p>
                <div className="entry-hero__tags">
                  <span className="entry-tag">Search Menus</span>
                  <span className="entry-tag">Live Tracking</span>
                </div>
              </div>

              <div className="entry-hero__preview">
                <div className="entry-preview-card">
                  <span className="eyebrow">Quick Access</span>
                  <strong>Step into a cleaner campus food experience.</strong>
                  <p>
                    Choose your path to start browsing menus, placing orders, and tracking every
                    update with less clutter and better flow.
                  </p>
                  <div className="entry-preview-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => setMode('login')}
                    >
                      Login
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setMode('register')}
                    >
                      Register
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {mode ? (
            <section className="panel auth-shell">
              <div className="auth-shell__header">
                <div>
                  <span className="eyebrow">{mode === 'login' ? 'Login Page' : 'Register Page'}</span>
                  <h2>{mode === 'login' ? 'Continue with your account' : 'Create your account'}</h2>
                </div>
                {!loginOtpSession ? (
                  <button className="ghost-button" type="button" onClick={() => setMode('')}>
                    Back
                  </button>
                ) : null}
              </div>

              <AuthForm
                mode={mode}
                onSubmit={handleAuth}
                loading={loading}
                otpStep={Boolean(loginOtpSession)}
                otpEmail={loginOtpSession?.email || ''}
                onVerifyOtp={handleVerifyLoginOtp}
                onResendOtp={handleResendLoginOtp}
                onBackToLogin={handleBackFromOtp}
              />
            </section>
          ) : null}
        </>
      ) : null}

      {user?.role === 'student' && studentView === 'menu' ? (
        <StudentDashboard
          menuItems={menuItems}
          orders={[]}
          bookmarkedVendorIds={bookmarkedVendors.map((vendor) => vendor._id)}
          selectedVendorId={selectedStudentVendorId}
          recentlyAddedFoodId={recentlyAddedFoodId}
          menuLoading={menuLoading}
          onAddToCart={handleAddToCart}
          onToggleBookmark={handleToggleBookmark}
          onClearSelectedVendor={() => setSelectedStudentVendorId('')}
          showOrders={false}
        />
      ) : null}

      {user?.role === 'student' && studentView === 'cart' ? (
        <StudentCart
          cartItems={cartItems}
          cartLoading={cartLoading}
          orderLoading={orderLoading}
          paymentFeedback={paymentFeedback}
          paymentFailed={paymentFailed}
          onlinePaymentAvailable={onlinePaymentAvailable}
          paymentConfigMessage={paymentConfigMessage}
          onUpdateCartItem={handleUpdateCartItem}
          onPlaceOrder={handlePlaceOrder}
          onPlaceCashOrder={handlePlaceCashOrder}
        />
      ) : null}

      {user?.role === 'student' && studentView === 'orders' ? (
        <StudentDashboard
          menuItems={[]}
          orders={orders}
          highlightedOrderId={selectedStudentOrderId}
          recentlyAddedFoodId=""
          menuLoading={false}
          onAddToCart={handleAddToCart}
          onUpdateOrderItem={handleUpdateStudentOrder}
          onCancelOrder={handleCancelStudentOrder}
          onRateVendor={handleRateVendor}
          showMenu={false}
        />
      ) : null}

      {user?.role === 'student' && studentView === 'account' ? (
        <AccountPage
          user={user}
          orders={orders}
          bookmarkedVendors={bookmarkedVendors}
          saving={loading}
          onSave={handleSaveProfile}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          onOpenBookmarkedVendor={handleOpenBookmarkedVendor}
          onOpenPastOrder={handleOpenPastOrder}
        />
      ) : null}

      {user?.role === 'vendor' && studentView === 'account' ? (
        <AccountPage
          user={user}
          orders={orders}
          saving={loading}
          onSave={handleSaveProfile}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
        />
      ) : null}

      {user?.role === 'vendor' && studentView !== 'account' ? (
        <VendorDashboard
          items={vendorItems}
          orders={orders}
          selectedDate={vendorOrdersDate}
          saving={vendorSaving}
          onCreateItem={handleCreateItem}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onSeedItems={handleSeedItems}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onDateChange={setVendorOrdersDate}
          showMenu={studentView === 'dashboard'}
          showOrders={studentView === 'vendor-orders'}
        />
      ) : null}
    </div>
  );
}

export default App;
